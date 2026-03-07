"use client";

import {
  useAudioTrack,
  useDaily,
  useDevices,
  useLocalSessionId,
  useVideoTrack,
} from "@daily-co/daily-react";
import { useState } from "react";

export type DevicePermissionState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied";

export function useDeviceReadiness() {
  const daily = useDaily();
  const { currentCam, currentMic } = useDevices();
  const localSessionId = useLocalSessionId();
  const audioTrack = useAudioTrack(localSessionId);
  const videoTrack = useVideoTrack(localSessionId);

  const [permissionState, setPermissionState] =
    useState<DevicePermissionState>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  async function requestPermissions() {
    if (!daily) {
      setPermissionError("Video stack is still initializing. Try again in a moment.");
      return;
    }

    setPermissionState("requesting");
    setPermissionError(null);

    try {
      await daily.startCamera({
        startAudioOff: false,
        startVideoOff: false,
        audioSource: "default",
      });
      setPermissionState("granted");
    } catch (error) {
      setPermissionState("denied");
      setPermissionError(
        error instanceof Error
          ? error.message
          : "Camera or microphone permission was denied.",
      );
    }
  }

  return {
    permissionState,
    permissionError,
    requestPermissions,
    localSessionId,
    hasVideoPreview: Boolean(videoTrack.track) && !videoTrack.isOff,
    hasAudioAccess: !audioTrack.isOff,
    selectedCamera: currentCam?.device.label ?? "Camera not selected yet",
    selectedMicrophone:
      currentMic?.device.label ?? "Microphone not selected yet",
  };
}
