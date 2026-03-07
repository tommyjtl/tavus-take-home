import { NextResponse } from "next/server";
import { defaultChassisPayload } from "@/lib/contracts";

export async function GET() {
  return NextResponse.json({
    ...defaultChassisPayload,
    personaId: process.env.TAVUS_PERSONA_ID ?? defaultChassisPayload.personaId,
    replicaId: process.env.TAVUS_REPLICA_ID ?? defaultChassisPayload.replicaId,
  });
}
