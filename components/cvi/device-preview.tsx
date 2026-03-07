"use client";

import { DailyVideo } from "@daily-co/daily-react";
import { Camera, Mic, ShieldAlert } from "lucide-react";
import { type DevicePermissionState } from "@/components/cvi/use-device-readiness";
import { cn } from "@/lib/utils";

interface DevicePreviewProps {
  localSessionId: string;
  permissionState: DevicePermissionState;
  permissionError: string | null;
  hasVideoPreview: boolean;
  hasAudioAccess: boolean;
  selectedCamera: string;
  selectedMicrophone: string;
}

export function DevicePreview({
  localSessionId,
  permissionState,
  permissionError,
  hasVideoPreview,
  hasAudioAccess,
  selectedCamera,
  selectedMicrophone,
}: DevicePreviewProps) {
  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-white/50 bg-slate-950 shadow-2xl shadow-slate-950/20">
        {hasVideoPreview ? (
          <DailyVideo
            mirror
            sessionId={localSessionId}
            type="video"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.3),_transparent_42%),linear-gradient(160deg,_#0f172a_0%,_#111827_100%)] text-white">
            <div className="space-y-3 px-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <Camera className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/60">
                  Preview
                </p>
                <p className="mt-2 text-base text-white/88">
                  Request access to verify your camera framing before joining.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.25em] text-white/75">
          {permissionState === "granted" ? "Ready" : "Not ready"}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-black/8 bg-white/70 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-black/45">
            <Camera className="h-3.5 w-3.5" /> Camera
          </div>
          <p className="mt-2 text-sm font-medium text-black/80">{selectedCamera}</p>
        </div>
        <div className="rounded-[20px] border border-black/8 bg-white/70 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-black/45">
            <Mic className="h-3.5 w-3.5" /> Microphone
          </div>
          <p className="mt-2 text-sm font-medium text-black/80">
            {selectedMicrophone}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "flex items-start gap-3 rounded-[20px] border px-4 py-3 text-sm",
          permissionError
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-900",
        )}
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">
            {permissionError
              ? "Browser permissions need attention"
              : "Device status"}
          </p>
          <p className="mt-1 text-sm">
            {permissionError
              ? permissionError
              : hasVideoPreview && hasAudioAccess
                ? "Camera and microphone are available for the Tavus join flow."
                : "Permissions will be requested during onboarding."}
          </p>
        </div>
      </div>
    </div>
  );
}
