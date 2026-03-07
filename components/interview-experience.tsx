"use client";

import { LoaderCircle, Mic, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditor } from "@/components/cvi/code-editor";
import { Conversation } from "@/components/cvi/conversation";
import { DevicePreview } from "@/components/cvi/device-preview";
import { useDeviceReadiness } from "@/components/cvi/use-device-readiness";
import {
  type CodeLine,
  type ContextSyncState,
  defaultChassisPayload,
  type ChassisPayload,
  type ConversationResponseBody,
  type InterviewEvaluation,
  type InterviewPhase,
  type LiveCodingContextPayload,
  type OverwriteConversationContextEvent,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";

type AppStage = "loading" | "onboarding" | "joining" | "live";

const stageCopy: Record<AppStage, string> = {
  loading: "Loading shell",
  onboarding: "Onboarding",
  joining: "Creating room",
  live: "In session",
};

const editorLanguage = "typescript" as const;
const layoutDebugMode = false;
const editorPrompt =
  "Implement bubble sort in TypeScript. Talk through your reasoning, then be ready to discuss correctness, edge cases, time complexity, space complexity, stability, and early-exit optimization.";
const starterEditorCode = `function bubbleSort(nums: number[]): number[] {
  const result = [...nums];

  return result;
}

const sampleInput = [5, 1, 4, 2, 8];
console.log(bubbleSort(sampleInput));
`;

export function InterviewExperience() {
  const device = useDeviceReadiness();

  const [appStage, setAppStage] = useState<AppStage>("loading");
  const [chassis, setChassis] = useState<ChassisPayload>(defaultChassisPayload);
  const [candidateName, setCandidateName] = useState("");
  const [conversation, setConversation] =
    useState<ConversationResponseBody | null>(null);
  const [editorCode, setEditorCode] = useState(starterEditorCode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interviewStartedAt, setInterviewStartedAt] = useState<number | null>(null);
  const [interviewPhase, setInterviewPhase] =
    useState<InterviewPhase>("implementation");
  const [contextSyncState, setContextSyncState] =
    useState<ContextSyncState>("idle");
  const [lastContextSyncAt, setLastContextSyncAt] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const conversationRef = useRef<ConversationResponseBody | null>(null);
  const trimmedCandidateName = candidateName.trim();
  const timeRemainingMinutes = getTimeRemainingMinutes(interviewStartedAt, clockNow);
  const evaluation = buildInterviewEvaluation({
    code: editorCode,
    phase: interviewPhase,
    timeRemainingMinutes,
  });
  const liveCodingContext = buildLiveCodingContext({
    chassis,
    candidateName: trimmedCandidateName,
    code: editorCode,
    evaluation,
    phase: interviewPhase,
    timeRemainingMinutes,
  });
  const overwriteContextEvent = buildOverwriteContextEvent(
    conversation?.conversationId,
    liveCodingContext,
  );
  const debugConversationContext = JSON.stringify(liveCodingContext, null, 2);
  const showLiveInterview = !layoutDebugMode && appStage === "live" && conversation;
  const hasGrantedPermissions = device.permissionState === "granted";
  const canStartInterview = trimmedCandidateName.length > 0 && appStage !== "joining";

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    if (appStage !== "live" || !interviewStartedAt) {
      return;
    }

    setClockNow(Date.now());

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appStage, interviewStartedAt]);

  useEffect(() => {
    let isMounted = true;

    async function loadChassis() {
      try {
        const response = await fetch("/api/chassis", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Unable to fetch onboarding configuration.");
        }

        const payload = (await response.json()) as ChassisPayload;

        if (!isMounted) {
          return;
        }

        setChassis(payload);
        setAppStage("onboarding");
      } catch {
        if (!isMounted) {
          return;
        }

        setChassis(defaultChassisPayload);
        setErrorMessage(
          "The chassis route did not respond, so the app is using local fallback copy.",
        );
        setAppStage("onboarding");
      }
    }

    void loadChassis();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    async function cleanupConversation(conversationId: string) {
      try {
        await fetch("/api/conversation", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ conversationId }),
        });
      } catch (error) {
        console.error("Failed to end Tavus conversation", error);
      }
    }

    function handleBeforeUnload() {
      const activeConversation = conversationRef.current;

      if (!activeConversation) {
        return;
      }

      void fetch("/api/conversation", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversationId: activeConversation.conversationId }),
        keepalive: true,
      });
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      const activeConversation = conversationRef.current;

      if (activeConversation) {
        void cleanupConversation(activeConversation.conversationId);
      }
    };
  }, []);

  const handleStartInterview = useCallback(async function handleStartInterview() {
    if (appStage === "joining" || appStage === "live" || conversationRef.current) {
      return;
    }

    if (!trimmedCandidateName) {
      setErrorMessage("Enter your name before starting the interview.");
      return;
    }

    if (device.permissionState !== "granted") {
      setErrorMessage("Grant camera and microphone access before joining the interview.");
      return;
    }

    setAppStage("joining");
    setErrorMessage(null);
    setContextSyncState("idle");
    setLastContextSyncAt(null);

    try {
      const conversationName = `${chassis.conversationName} - ${trimmedCandidateName}`;
      const conversationalContext = buildConversationContext(
        chassis.conversationalContext,
        trimmedCandidateName,
      );

      const response = await fetch("/api/conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationName,
          conversationalContext,
          personaId: chassis.personaId,
          replicaId: chassis.replicaId,
        }),
      });

      const payload = (await response.json()) as
        | ConversationResponseBody
        | { message?: string };

      if (!response.ok) {
        const message = "message" in payload ? payload.message : undefined;
        throw new Error(message ?? "Unable to create Tavus conversation.");
      }

      setInterviewStartedAt(Date.now());
      setClockNow(Date.now());
      setConversation(payload as ConversationResponseBody);
      setAppStage("live");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create Tavus conversation.",
      );
      setAppStage("onboarding");
    }
  }, [appStage, chassis.conversationName, chassis.conversationalContext, chassis.personaId, chassis.replicaId, device.permissionState, trimmedCandidateName]);

  const endConversation = useCallback(async (conversationId: string) => {
    try {
      await fetch("/api/conversation", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversationId }),
      });
    } catch (error) {
      console.error("Failed to end Tavus conversation", error);
    }
  }, []);

  const resetSessionState = useCallback(() => {
    setConversation(null);
    setEditorCode(starterEditorCode);
    setInterviewStartedAt(null);
    setInterviewPhase("implementation");
    setContextSyncState("idle");
    setLastContextSyncAt(null);
    setAppStage("onboarding");
  }, []);

  const handleContextSync = useCallback((state: ContextSyncState) => {
    setContextSyncState(state);

    if (state === "synced") {
      setLastContextSyncAt(new Date().toLocaleTimeString());
    }
  }, []);

  const handleLeaveInterview = useCallback(async () => {
    const activeConversation = conversationRef.current;

    if (activeConversation) {
      await endConversation(activeConversation.conversationId);
    }

    resetSessionState();
  }, [endConversation, resetSessionState]);

  const handleConversationError = useCallback(async (message: string) => {
    const activeConversation = conversationRef.current;

    if (activeConversation) {
      await endConversation(activeConversation.conversationId);
    }

    setErrorMessage(message);
    resetSessionState();
  }, [endConversation, resetSessionState]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="absolute left-[8%] top-12 h-48 w-48 rounded-full bg-[#e29f61]/25 blur-3xl" />
      <div className="absolute right-[8%] top-28 h-72 w-72 rounded-full bg-[#0b766e]/20 blur-3xl" />
      <div className="absolute bottom-10 left-1/3 h-52 w-52 rounded-full bg-sky-300/20 blur-3xl" />

      <div className="relative mx-auto flex h-[calc(100vh-2rem)] max-w-7xl flex-col rounded-[36px] border border-black/6 bg-white/28 p-4 shadow-[0_30px_90px_rgba(39,29,18,0.10)] backdrop-blur-sm sm:h-[calc(100vh-3rem)] sm:p-6 lg:h-[calc(100vh-3rem)] lg:p-7">
        <header className="flex flex-col gap-6 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-balance text-black/90 sm:text-4xl">
              AI Mock Coding Interview Practice
            </h1>
            <p className="max-w-2xl text-base leading-7 text-black/62 sm:text-md">
              Practice how you think when coding.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-1">
            <StatCard label="Stage" value={layoutDebugMode ? "Layout debug" : stageCopy[appStage]} />
          </div>
        </header>

        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px]">
          {showLiveInterview ? (
            <div className="grid min-h-0 flex-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Conversation
                conversationId={conversation.conversationId}
                conversationUrl={conversation.conversationUrl}
                contextDebugPayload={debugConversationContext}
                candidateName={trimmedCandidateName}
                lastContextSyncAt={lastContextSyncAt}
                liveContext={overwriteContextEvent}
                onLeave={handleLeaveInterview}
                onError={handleConversationError}
                onContextSync={handleContextSync}
              />
              <CodeEditor
                problemTitle={chassis.title}
                prompt={editorPrompt}
                value={editorCode}
                language={editorLanguage}
                syncState={contextSyncState}
                onChange={(nextCode) => {
                  setEditorCode(nextCode);
                  setInterviewPhase("implementation");
                }}
              />
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <LayoutDebugPanel chassis={chassis} />
              <CodeEditor
                problemTitle={chassis.title}
                prompt={editorPrompt}
                value={editorCode}
                language={editorLanguage}
                syncState={contextSyncState}
                onChange={(nextCode) => {
                  setEditorCode(nextCode);
                  setInterviewPhase("implementation");
                }}
              />
            </div>
          )}
        </section>
      </div>

      {!layoutDebugMode && appStage !== "live" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(250,246,240,0.42)] px-4 backdrop-blur-xl">
          <div className="grid w-full max-w-5xl gap-4 rounded-[36px] border border-white/60 bg-[rgba(255,251,246,0.86)] p-4 shadow-[0_42px_120px_rgba(39,29,18,0.18)] sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <div className="rounded-[30px] border border-black/8 bg-[linear-gradient(180deg,_rgba(255,254,252,0.96),_rgba(244,238,230,0.92))] p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-black/45">
                    Onboarding
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-black/90">
                    {chassis.title}
                  </h2>
                </div>
                {appStage === "joining" ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-accent-strong">
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Joining
                  </div>
                ) : null}
              </div>

              <p className="mt-5 max-w-xl text-base leading-7 text-black/65">
                {chassis.intro}
              </p>

              {errorMessage ? (
                <div className="mt-6 rounded-[22px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                  {errorMessage}
                </div>
              ) : null}

              <div className="mt-7 space-y-3">
                <div className="space-y-2">
                  <label
                    htmlFor="candidate-name"
                    className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/50"
                  >
                    Your name
                  </label>
                  <Input
                    id="candidate-name"
                    value={candidateName}
                    onChange={(event) => {
                      setCandidateName(event.target.value);
                      if (errorMessage) {
                        setErrorMessage(null);
                      }
                    }}
                    placeholder="Enter your name"
                    autoComplete="name"
                    maxLength={60}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={device.requestPermissions}
                  disabled={device.permissionState === "requesting"}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black/82 transition enabled:hover:bg-black enabled:hover:text-white disabled:cursor-default disabled:opacity-60"
                >
                  <Video className="h-4 w-4" />
                  {device.permissionState === "requesting"
                    ? "Requesting access"
                    : device.permissionState === "granted"
                      ? "Permissions granted"
                      : "Enable camera and mic"}
                </button>

                {hasGrantedPermissions ? (
                  <button
                    type="button"
                    onClick={handleStartInterview}
                    disabled={!canStartInterview}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition",
                      canStartInterview
                        ? "bg-emerald-600 text-white hover:bg-emerald-500"
                        : "bg-black/10 text-black/40",
                      "disabled:cursor-default",
                    )}
                  >
                    <Mic className="h-4 w-4" /> Start interview
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-[30px] border border-black/8 bg-[rgba(255,252,246,0.85)] p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-black/45">
                Device check
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-black/90">
                Preview before the Tavus join.
              </h3>
              <p className="mt-2 text-sm leading-6 text-black/62">
                This preview happens before the room mounts so permission failures are visible in onboarding instead of after the room boots.
              </p>
              <div className="mt-6">
                <DevicePreview
                  localSessionId={device.localSessionId}
                  permissionState={device.permissionState}
                  permissionError={device.permissionError}
                  hasVideoPreview={device.hasVideoPreview}
                  hasAudioAccess={device.hasAudioAccess}
                  selectedCamera={device.selectedCamera}
                  selectedMicrophone={device.selectedMicrophone}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function LayoutDebugPanel({ chassis }: { chassis: ChassisPayload }) {
  return (
    <div className="relative flex h-full min-h-[560px] flex-col justify-between rounded-[28px] border border-white/35 bg-[linear-gradient(160deg,_rgba(255,255,255,0.78),_rgba(239,243,248,0.5))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="grid gap-8">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-black/55 shadow-sm">
            Layout debug
          </div>
          <div>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-black/90 sm:text-4xl">
              Video interview UI is disabled so the shell can be tuned in isolation.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/62">
              The left column is now a static placeholder instead of a simulated live meeting. The editor remains mounted so spacing, height, and panel balance are easier to inspect.
            </p>
          </div>

          <div className="rounded-[26px] border border-dashed border-black/10 bg-[linear-gradient(180deg,_rgba(252,249,244,0.92),_rgba(240,244,248,0.82))] p-6">
            <div className="flex h-[360px] items-center justify-center rounded-[22px] border border-black/8 bg-[radial-gradient(circle_at_top,_rgba(226,159,97,0.14),_transparent_30%),linear-gradient(160deg,_rgba(255,255,255,0.92),_rgba(235,240,245,0.9))]">
              <div className="max-w-sm text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-black/42">
                  Left panel placeholder
                </p>
                <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-black/88">
                  No camera preview
                </p>
                <p className="mt-3 text-sm leading-6 text-black/62">
                  Use this state to debug panel height, borders, spacing, and overall composition without joining a Tavus room.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <BackdropCard
              label="Problem"
              value={chassis.title}
              tone="default"
            />
            <BackdropCard
              label="Persona wiring"
              value={chassis.personaId ?? chassis.replicaId ?? "Waiting for .env.local"}
              tone={chassis.personaId ?? chassis.replicaId ? "positive" : "default"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[132px] rounded-[24px] border border-black/8 bg-white/68 px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/45">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold capitalize tracking-[-0.03em] text-black/88">
        {value}
      </p>
    </div>
  );
}

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-black/35 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "border-black/10 bg-white/82 text-black/88",
        className,
      )}
    />
  );
}

function buildConversationContext(baseContext: string, candidateName: string) {
  if (!candidateName) {
    return baseContext;
  }

  return `${baseContext} The candidate's name is ${candidateName}. Greet them by name at the start of the interview and continue addressing them by name naturally when appropriate.`;
}

function buildLiveCodingContext({
  chassis,
  candidateName,
  code,
  evaluation,
  phase,
  timeRemainingMinutes,
}: {
  chassis: ChassisPayload;
  candidateName: string;
  code: string;
  evaluation: InterviewEvaluation;
  phase: InterviewPhase;
  timeRemainingMinutes: number;
}): LiveCodingContextPayload {
  const hasEditedStarter = code.trim() !== starterEditorCode.trim();

  return {
    problem: chassis.title,
    code: toCodeLines(code),
    language: editorLanguage,
    phase,
    timeRemainingMinutes,
    candidateProgress: hasEditedStarter
      ? "The candidate is actively editing the solution in the TypeScript editor and may ask for hints about correctness, edge cases, or tradeoffs."
      : "The candidate is reviewing the prompt and starter code before modifying the implementation.",
    candidateName: candidateName || undefined,
    evaluation,
  };
}

function buildInterviewEvaluation({
  code,
  phase,
  timeRemainingMinutes,
}: {
  code: string;
  phase: InterviewPhase;
  timeRemainingMinutes: number;
}): InterviewEvaluation {
  const hasEditedStarter = code.trim() !== starterEditorCode.trim();
  const isWrapUpWindow = timeRemainingMinutes <= 3;

  return {
    problemSolving: hasEditedStarter
      ? "A working draft is in progress. Probe for loop bounds, swap behavior, early exit, and whether the candidate can reason about already-sorted input."
      : "The candidate has not materially changed the starter code yet. Keep the conversation focused on approach, loop structure, and the first concrete implementation step.",
    communication:
      "The app cannot directly score speech quality. Ask the candidate to think out loud and treat repeated basic clarification questions as a possible signal of weaker conceptual understanding.",
    correctness:
      phase === "debugging"
        ? "The candidate is in debugging or refinement mode. Verify correctness with edge cases and termination conditions."
        : hasEditedStarter
          ? "An implementation draft exists. Verify correctness, adjacent comparisons, swap logic, and whether the best-case early exit is considered."
          : "No implementation signal is available yet. Delay correctness judgment until the candidate commits to a concrete approach.",
    tradeoffAwareness:
      "Ask about time complexity, space complexity, stability, and whether an early-exit optimization changes best-case performance.",
    timeManagement: isWrapUpWindow
      ? "Three minutes or less remain. Tighten the interview toward correctness, complexity, and concise closing feedback."
      : timeRemainingMinutes <= 6
        ? "The interview is in the middle stretch. Keep follow-ups focused and avoid long explanations."
        : "The interview is still early. Let the candidate establish an approach before pressing into evaluation.",
    hintLevel:
      "No explicit hint escalation is tracked by the app. If the candidate asks for help, start with a brief guiding question. Do not turn the interview into a lecture unless the candidate explicitly asks for clarification.",
    summary: hasEditedStarter
      ? "The candidate is actively iterating on bubble sort. Keep pressure on reasoning clarity, correctness, and tradeoff awareness."
      : "The candidate is still orienting to the problem. Use short prompts to move them into implementation and avoid over-explaining unless asked.",
  };
}

function buildOverwriteContextEvent(
  conversationId: string | undefined,
  payload: LiveCodingContextPayload,
): OverwriteConversationContextEvent | null {
  if (!conversationId) {
    return null;
  }

  return {
    message_type: "conversation",
    event_type: "conversation.overwrite_llm_context",
    conversation_id: conversationId,
    properties: {
      context: formatLiveCodingContext(payload),
    },
  };
}

function formatLiveCodingContext(payload: LiveCodingContextPayload) {
  return [
    "Current coding context:",
    "Interviewer behavior instructions: keep turns concise, ask one substantive question at a time, do not stack multiple follow-up questions in a single message, do not repeat previously established information, do not volunteer long teaching explanations unless the candidate explicitly asks for clarification, and keep evaluation notes internal rather than reading them aloud.",
    `Problem: ${payload.problem}`,
    `Language: ${payload.language}`,
    `Phase: ${payload.phase}`,
    `Time remaining: ${payload.timeRemainingMinutes} minute(s)`,
    `Candidate name: ${payload.candidateName ?? "unknown"}`,
    `Candidate progress: ${payload.candidateProgress}`,
    "Evaluation:",
    `- Problem solving: ${payload.evaluation.problemSolving}`,
    `- Communication: ${payload.evaluation.communication}`,
    `- Correctness: ${payload.evaluation.correctness}`,
    `- Tradeoff awareness: ${payload.evaluation.tradeoffAwareness}`,
    `- Time management: ${payload.evaluation.timeManagement}`,
    `- Hint level: ${payload.evaluation.hintLevel}`,
    `- Summary: ${payload.evaluation.summary}`,
    "Latest code:",
    ...payload.code.map(({ line, code }) => `${line}: ${code}`),
  ].join("\n");
}

function toCodeLines(sourceCode: string): CodeLine[] {
  return sourceCode.split("\n").map((lineOfCode, index) => ({
    line: index,
    code: lineOfCode,
  }));
}

function getTimeRemainingMinutes(
  interviewStartedAt: number | null,
  clockNow: number,
) {
  if (!interviewStartedAt) {
    return 10;
  }

  const elapsedMilliseconds = Math.max(0, clockNow - interviewStartedAt);
  const remainingMilliseconds = Math.max(0, 10 * 60_000 - elapsedMilliseconds);

  return Math.max(0, Math.ceil(remainingMilliseconds / 60_000));
}

function BackdropCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "positive";
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-4",
        tone === "positive"
          ? "border-emerald-200 bg-emerald-50/80"
          : "border-black/8 bg-white/72",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/45">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-black/82">{value}</p>
    </div>
  );
}