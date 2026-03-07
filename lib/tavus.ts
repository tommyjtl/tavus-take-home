import { type ConversationRequestBody } from "@/lib/contracts";

const TAVUS_API_URL = "https://tavusapi.com/v2/conversations";

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

export function getTavusConfig() {
  return {
    apiKey: process.env.TAVUS_API_KEY,
    defaultPersonaId: process.env.TAVUS_PERSONA_ID,
    defaultReplicaId: process.env.TAVUS_REPLICA_ID,
    callbackUrl: process.env.TAVUS_CALLBACK_URL,
    testMode: parseBoolean(process.env.TAVUS_TEST_MODE, false),
    requireAuth: parseBoolean(process.env.TAVUS_REQUIRE_AUTH, false),
  };
}

export function getMissingConfigMessage(payload: ConversationRequestBody) {
  const config = getTavusConfig();
  const resolvedPersonaId = payload.personaId ?? config.defaultPersonaId;
  const resolvedReplicaId = payload.replicaId ?? config.defaultReplicaId;

  if (!config.apiKey) {
    return "Missing TAVUS_API_KEY. Add it to .env.local before creating conversations.";
  }

  if (!resolvedPersonaId && !resolvedReplicaId) {
    return "Set TAVUS_PERSONA_ID or TAVUS_REPLICA_ID in .env.local, or provide one from the chassis payload.";
  }

  return null;
}

export async function createTavusConversation(payload: ConversationRequestBody) {
  const config = getTavusConfig();
  const resolvedPersonaId = payload.personaId ?? config.defaultPersonaId;
  const resolvedReplicaId = payload.replicaId ?? config.defaultReplicaId;

  const body = {
    conversation_name: payload.conversationName,
    conversational_context: payload.conversationalContext,
    persona_id: resolvedPersonaId ?? undefined,
    replica_id: resolvedReplicaId ?? undefined,
    callback_url: config.callbackUrl,
    require_auth: config.requireAuth,
    test_mode: config.testMode,
    max_participants: 2,
  };

  console.info("[tavus] creating conversation", {
    conversationName: body.conversation_name,
    personaId: body.persona_id,
    replicaId: body.replica_id,
    testMode: body.test_mode,
    requireAuth: body.require_auth,
    hasCallbackUrl: Boolean(body.callback_url),
  });

  const response = await fetch(TAVUS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey ?? "",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Tavus conversation creation failed.");
  }

  const data = (await response.json()) as {
    conversation_id: string;
    conversation_url: string;
    status: string;
    meeting_token?: string;
  };

  console.info("[tavus] conversation created", {
    conversationId: data.conversation_id,
    status: data.status,
    conversationUrl: data.conversation_url,
    hasMeetingToken: Boolean(data.meeting_token),
  });

  return {
    conversationId: data.conversation_id,
    conversationUrl: data.conversation_url,
    status: data.status,
    meetingToken: data.meeting_token ?? null,
  };
}

export async function endTavusConversation(conversationId: string) {
  const config = getTavusConfig();

  if (!config.apiKey) {
    throw new Error("Missing TAVUS_API_KEY. Add it to .env.local before ending conversations.");
  }

  const response = await fetch(`${TAVUS_API_URL}/${conversationId}/end`, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Tavus conversation end failed.");
  }

  console.info("[tavus] conversation ended", { conversationId });
}
