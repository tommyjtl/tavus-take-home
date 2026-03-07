import { NextResponse } from "next/server";
import {
  createTavusConversation,
  endTavusConversation,
  getMissingConfigMessage,
} from "@/lib/tavus";
import {
  type ConversationRequestBody,
  type EndConversationRequestBody,
} from "@/lib/contracts";

export async function POST(request: Request) {
  const payload = (await request.json()) as ConversationRequestBody;
  const missingConfigMessage = getMissingConfigMessage(payload);

  if (missingConfigMessage) {
    return NextResponse.json(
      { message: missingConfigMessage },
      { status: 503 },
    );
  }

  try {
    const conversation = await createTavusConversation(payload);
    return NextResponse.json(conversation);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to create Tavus conversation.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const payload = (await request.json()) as EndConversationRequestBody;

  if (!payload.conversationId) {
    return NextResponse.json(
      { message: "conversationId is required to end a conversation." },
      { status: 400 },
    );
  }

  try {
    await endTavusConversation(payload.conversationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to end Tavus conversation.",
      },
      { status: 500 },
    );
  }
}
