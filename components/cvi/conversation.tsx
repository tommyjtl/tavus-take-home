"use client";

import {
  DailyAudio,
  DailyVideo,
  useDailyEvent,
  useAudioTrack,
  useDaily,
  useLocalSessionId,
  useMeetingState,
  useParticipantIds,
  useVideoTrack,
} from "@daily-co/daily-react";
import { Bug, Braces, Mic, MicOff, Phone, Video, VideoOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ContextSyncState,
  type OverwriteConversationContextEvent,
} from "@/lib/contracts";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ConversationProps {
  conversationId: string;
  conversationUrl: string;
  contextDebugPayload: string;
  candidateName: string;
  lastContextSyncAt: string | null;
  liveContext: OverwriteConversationContextEvent | null;
  onLeave: () => void;
  onError: (message: string) => void;
  onContextSync: (state: ContextSyncState, message?: string) => void;
}

export function Conversation({
  conversationId,
  conversationUrl,
  contextDebugPayload,
  candidateName,
  lastContextSyncAt,
  liveContext,
  onLeave,
  onError,
  onContextSync,
}: ConversationProps) {
  const hasAttemptedJoinRef = useRef<string | null>(null);
  const isHandlingFailureRef = useRef(false);
  const lastSentContextRef = useRef<string | null>(null);
  const daily = useDaily();
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const localSessionId = useLocalSessionId();
  const meetingState = useMeetingState();
  const localAudioTrack = useAudioTrack(localSessionId);
  const localVideoTrack = useVideoTrack(localSessionId);
  const remoteParticipantId = remoteParticipantIds[0];
  const [debugEvents, setDebugEvents] = useState<string[]>([]);
  const serializedLiveContext = liveContext ? JSON.stringify(liveContext) : null;

  const pushDebugEvent = useCallback((label: string, details?: unknown) => {
    const timestamp = new Date().toLocaleTimeString();
    const suffix = details ? ` ${formatDebugDetails(details)}` : "";
    const entry = `${timestamp} ${label}${suffix}`;

    console.info("[daily]", label, details ?? "");
    setDebugEvents((current) => [entry, ...current].slice(0, 12));
  }, []);

  const reportFatalError = useCallback(
    async (message: string) => {
      if (isHandlingFailureRef.current) {
        return;
      }

      isHandlingFailureRef.current = true;

      try {
        await daily?.leave();
      } catch (error) {
        pushDebugEvent("leave-after-error-failed", error);
      }

      onError(message);
    },
    [daily, onError, pushDebugEvent],
  );

  useDailyEvent("joining-meeting", useCallback(() => {
    pushDebugEvent("joining-meeting");
  }, [pushDebugEvent]));
  useDailyEvent("joined-meeting", useCallback((event) => {
    pushDebugEvent("joined-meeting", {
      localSessionId: event?.participants?.local?.session_id,
    });
  }, [pushDebugEvent]));
  useDailyEvent("left-meeting", useCallback(() => {
    pushDebugEvent("left-meeting");
  }, [pushDebugEvent]));
  useDailyEvent("participant-joined", useCallback((event) => {
    pushDebugEvent("participant-joined", {
      participantId: event?.participant?.session_id,
      local: event?.participant?.local,
    });
  }, [pushDebugEvent]));
  useDailyEvent("participant-updated", useCallback((event) => {
    pushDebugEvent("participant-updated", {
      participantId: event?.participant?.session_id,
      local: event?.participant?.local,
    });
  }, [pushDebugEvent]));
  useDailyEvent("participant-left", useCallback((event) => {
    pushDebugEvent("participant-left", {
      participantId: event?.participant?.session_id,
    });
  }, [pushDebugEvent]));
  useDailyEvent("error", useCallback((event) => {
    pushDebugEvent("error", event);
    void reportFatalError(
      event?.errorMsg ?? event?.error?.message ?? "The live interview room entered an error state.",
    );
  }, [pushDebugEvent, reportFatalError]));
  useDailyEvent("camera-error", useCallback((event) => {
    pushDebugEvent("camera-error", event);
  }, [pushDebugEvent]));
  useDailyEvent("nonfatal-error", useCallback((event) => {
    pushDebugEvent("nonfatal-error", event);
  }, [pushDebugEvent]));
  useDailyEvent("app-message", useCallback((event) => {
    pushDebugEvent("app-message", event?.data?.event_type ?? event?.data?.message_type);
  }, [pushDebugEvent]));

  useEffect(() => {
    lastSentContextRef.current = null;
    isHandlingFailureRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (!daily || !conversationUrl) {
      return;
    }

    if (hasAttemptedJoinRef.current === conversationUrl) {
      return;
    }

    const call = daily;
    const currentMeetingState = call.meetingState();

    if (
      currentMeetingState === "joining-meeting" ||
      currentMeetingState === "joined-meeting"
    ) {
      return;
    }

    hasAttemptedJoinRef.current = conversationUrl;

    let isDisposed = false;

    async function joinCall() {
      try {
        pushDebugEvent("join-call", {
          conversationUrl,
          currentMeetingState,
        });
        await call.join({ url: conversationUrl });
      } catch (error) {
        if (!isDisposed) {
          pushDebugEvent("join-call-failed", error);
          void reportFatalError(
            error instanceof Error
              ? error.message
              : "Unable to join the Tavus meeting.",
          );
        }
      }
    }

    void joinCall();

    return () => {
      isDisposed = true;
      hasAttemptedJoinRef.current = null;
    };
  }, [conversationUrl, daily, pushDebugEvent, reportFatalError]);

  useEffect(() => {
    if (!daily || !liveContext || !serializedLiveContext) {
      return;
    }

    if (meetingState !== "joined-meeting") {
      return;
    }

    if (lastSentContextRef.current === serializedLiveContext) {
      return;
    }

    try {
      onContextSync("syncing");
      daily.sendAppMessage(liveContext, "*");
      lastSentContextRef.current = serializedLiveContext;
      console.info("[daily] context-overwrite-sent", {
        conversationId,
        characters: liveContext.properties.context.length,
      });
      onContextSync("synced");
    } catch (error) {
      console.error("[daily] context-overwrite-failed", error);
      onContextSync(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to send live context to Tavus.",
      );
    }
  }, [conversationId, daily, liveContext, meetingState, onContextSync, serializedLiveContext]);

  async function handleLeave() {
    await daily?.leave();
    onLeave();
  }

  async function handleToggleMicrophone() {
    await daily?.setLocalAudio(localAudioTrack.isOff);
  }

  async function handleToggleCamera() {
    await daily?.setLocalVideo(localVideoTrack.isOff);
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[32px] bg-[linear-gradient(180deg,_rgba(11,15,20,0.92),_rgba(18,24,37,0.96))] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
            Live interview
          </p>
          <p className="mt-2 text-sm text-white/72">
            Meeting state: <span className="font-medium text-white">{meetingState}</span>
          </p>
        </div>
        <div className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-white/60">
          {remoteParticipantId ? "Interviewer connected" : "Connecting"}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-[26px] border border-white/10 bg-black/30">
        {remoteParticipantId ? (
          <DailyVideo
            sessionId={remoteParticipantId}
            type="video"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_32%),linear-gradient(160deg,_rgba(15,23,42,0.9),_rgba(15,23,42,1))]">
            <div className="max-w-sm text-center text-white/78">
              <p className="text-[11px] uppercase tracking-[0.32em] text-white/42">
                Tavus room
              </p>
              <p className="mt-4 text-xl font-medium text-white">
                Waiting for the interviewer video stream to attach.
              </p>
              <p className="mt-3 text-sm text-white/60">
                The room is created server-side, then Daily joins this container using the Tavus conversation URL.
              </p>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 right-4 h-32 w-24 overflow-hidden rounded-[18px] border border-white/12 bg-black/45 shadow-xl shadow-black/35 md:h-40 md:w-30">
          <DailyVideo
            mirror
            sessionId={localSessionId}
            type="video"
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleToggleMicrophone}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              localAudioTrack.isOff
                ? "border-white/10 bg-white/8 text-white/70 hover:bg-white/12"
                : "border-emerald-400/20 bg-emerald-400/14 text-white hover:bg-emerald-400/18",
            )}
          >
            {localAudioTrack.isOff ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {localAudioTrack.isOff ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={handleToggleCamera}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              localVideoTrack.isOff
                ? "border-white/10 bg-white/8 text-white/70 hover:bg-white/12"
                : "border-sky-400/20 bg-sky-400/14 text-white hover:bg-sky-400/18",
            )}
          >
            {localVideoTrack.isOff ? (
              <VideoOff className="h-4 w-4" />
            ) : (
              <Video className="h-4 w-4" />
            )}
            {localVideoTrack.isOff ? "Camera off" : "Camera on"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleLeave}
          className="inline-flex items-center gap-2 rounded-full bg-[#d15a46] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#bc4a36]"
        >
          <Phone className="h-4 w-4" /> Leave interview
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/72 transition hover:bg-white/12"
            >
              <Bug className="h-3.5 w-3.5" /> Debug
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="top"
            sideOffset={12}
            className="w-[min(44rem,calc(100vw-2rem))] rounded-[20px] border border-black/8 bg-[rgba(255,251,246,0.98)] p-4 text-black shadow-2xl"
          >
            <PopoverHeader className="gap-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-black/45">
                    Live diagnostics
                  </p>
                  <PopoverTitle className="mt-2 text-lg font-semibold tracking-[-0.03em] text-black/88">
                    Interview debug panel
                  </PopoverTitle>
                </div>
                <span className="rounded-full border border-black/8 bg-white/72 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">
                  {lastContextSyncAt ? `sent ${lastContextSyncAt}` : "waiting for live room"}
                </span>
              </div>
            </PopoverHeader>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="space-y-4">
                <div className="grid gap-2 text-xs text-black/70 md:grid-cols-2 lg:grid-cols-1">
                  <DebugRow light label="Conversation ID" value={conversationId} />
                  <DebugRow light label="Conversation URL" value={conversationUrl} />
                  <DebugRow light label="Meeting state" value={meetingState ?? "unknown"} />
                  <DebugRow light label="Remote session" value={remoteParticipantId ?? "not attached"} />
                  <DebugRow light label="Local session" value={localSessionId} />
                  <DebugRow light label="Remote participants" value={String(remoteParticipantIds.length)} />
                </div>

                <div className="rounded-[18px] border border-black/8 bg-black/[0.035] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/42">
                    Daily events
                  </p>
                  <div className="mt-3 max-h-40 overflow-auto rounded-[16px] border border-black/8 bg-black/90 p-3 font-mono text-[11px] text-white/72">
                    {debugEvents.length > 0 ? (
                      <ul className="space-y-2">
                        {debugEvents.map((entry, index) => (
                          <li key={`${index}-${entry}`}>{entry}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No Daily events captured yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[18px] border border-black/8 bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/42">
                      Candidate
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-black/8 bg-black/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/48">
                      <Braces className="h-3 w-3" /> Context
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-black/82">
                    {candidateName || "Not set yet"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-black/62">
                    This is the current overwrite-context payload sent to Tavus while the interview is live.
                  </p>
                </div>

                <div className="rounded-[18px] border border-black/8 bg-[#f7f2eb] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/42">
                    Prompt payload
                  </p>
                  <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words font-[var(--font-ibm-plex-mono)] text-[12px] leading-6 text-black/72">
                    {contextDebugPayload}
                  </pre>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <DailyAudio />
    </div>
  );
}

function DebugRow({
  label,
  value,
  light = false,
}: {
  label: string;
  value: string;
  light?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] px-3 py-2",
        light ? "border border-black/8 bg-black/[0.035]" : "border border-white/8 bg-white/4",
      )}
    >
      <p
        className={cn(
          "text-[10px] uppercase tracking-[0.22em]",
          light ? "text-black/38" : "text-white/38",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-all font-mono text-[11px]",
          light ? "text-black/76" : "text-white/76",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function formatDebugDetails(details: unknown) {
  if (details instanceof Error) {
    return details.message;
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return "[unserializable]";
  }
}
