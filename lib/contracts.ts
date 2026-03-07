export type InterviewPhase = "problem-review" | "implementation" | "debugging";
export type ContextSyncState = "idle" | "syncing" | "synced" | "error";

export interface InterviewEvaluation {
  problemSolving: string;
  communication: string;
  correctness: string;
  tradeoffAwareness: string;
  timeManagement: string;
  hintLevel: string;
  summary: string;
}

export interface ChassisPayload {
  title: string;
  intro: string;
  checklist: string[];
  personaId: string | null;
  replicaId: string | null;
  interviewerName: string;
  sessionLabel: string;
  conversationName: string;
  conversationalContext: string;
}

export interface ConversationRequestBody {
  conversationName?: string;
  conversationalContext?: string;
  personaId?: string | null;
  replicaId?: string | null;
}

export interface ConversationResponseBody {
  conversationId: string;
  conversationUrl: string;
  status: string;
  meetingToken: string | null;
}

export interface CodeLine {
  line: number;
  code: string;
}

export interface LiveCodingContextPayload {
  problem: string;
  code: CodeLine[];
  language: "typescript";
  phase: InterviewPhase;
  timeRemainingMinutes: number;
  candidateProgress: string;
  candidateName?: string;
  evaluation: InterviewEvaluation;
}

export interface OverwriteConversationContextEvent {
  message_type: "conversation";
  event_type: "conversation.overwrite_llm_context";
  conversation_id: string;
  properties: {
    context: string;
  };
}

export interface EndConversationRequestBody {
  conversationId: string;
}

export const defaultChassisPayload: ChassisPayload = {
  title: "Bubble Sort Interview",
  intro:
    "Talk through bubble sort face-to-face with an AI interviewer while solving the problem in the in-app TypeScript editor.",
  checklist: [
    "Enable camera access",
    "Enable microphone access",
    "Confirm your devices in the preview",
    "Join the interview and reason through bubble sort out loud",
  ],
  personaId: null,
  replicaId: null,
  interviewerName: "Thomas",
  sessionLabel: "Live interview",
  conversationName: "Bubble Sort Interview Practice",
  conversationalContext:
    "This session is a 10-minute bubble sort interview in TypeScript. Greet the candidate by name, ask them to think out loud, keep interviewer turns concise, ask one substantive question at a time, avoid stacking multiple follow-up questions in a single turn, avoid repeating points that were already established, and do not volunteer long teaching explanations unless the candidate explicitly asks for clarification. If the candidate keeps asking basic conceptual questions, treat that as a signal of weaker understanding and keep the response brief rather than becoming an instructor. Use hidden context updates as the source of truth for the latest code, phase, time remaining, and evaluation notes. Keep evaluation notes internal rather than speaking them aloud during the call.",
};
