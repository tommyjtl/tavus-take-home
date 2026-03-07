"use client";

import Editor from "@monaco-editor/react";
import { Code2, FileCode2, LoaderCircle } from "lucide-react";
import { type ContextSyncState } from "@/lib/contracts";
import { cn } from "@/lib/utils";

interface CodeEditorProps {
    problemTitle: string;
    prompt: string;
    value: string;
    language: "typescript";
    syncState: ContextSyncState;
    onChange: (value: string) => void;
}

const syncStateLabel: Record<ContextSyncState, string> = {
    idle: "Local draft",
    syncing: "Syncing context",
    synced: "Context already synced",
    error: "Sync issue",
};

export function CodeEditor({
    problemTitle,
    prompt,
    value,
    language,
    syncState,
    onChange,
}: CodeEditorProps) {
    return (
        <div className="flex h-full min-h-0 flex-col rounded-[32px] border border-black/8 bg-[linear-gradient(180deg,_rgba(255,252,247,0.94),_rgba(242,236,227,0.88))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.66)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-black/42">
                        Coding workspace
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-black/90">
                        {problemTitle}
                    </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                    <StatusPill active={syncState === "synced" || syncState === "syncing"}>
                        {syncState === "syncing" ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Code2 className="h-3.5 w-3.5" />
                        )}
                        {syncStateLabel[syncState]}
                    </StatusPill>
                    <StatusPill active>
                        <FileCode2 className="h-3.5 w-3.5" />
                        {language}
                    </StatusPill>
                </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-black/8 bg-white/76 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/45">
                    Prompt
                </p>
                <p className="mt-2 text-sm leading-6 text-black/68">{prompt}</p>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[24px] border border-black/10 bg-[#f8f8f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <Editor
                    height="100%"
                    defaultLanguage="typescript"
                    language={language}
                    path="interview.ts"
                    theme="vs-light"
                    value={value}
                    onChange={(nextValue) => {
                        onChange(nextValue ?? "");
                    }}
                    options={{
                        automaticLayout: true,
                        fontFamily: "var(--font-ibm-plex-mono)",
                        fontLigatures: false,
                        fontSize: 13,
                        lineHeight: 22,
                        minimap: { enabled: false },
                        padding: { top: 18, bottom: 18 },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        tabSize: 2,
                    }}
                />
            </div>

            <p className="mt-4 text-xs leading-5 text-black/52">
                The latest code snapshot is sent to Tavus as overwrite-context while the room is live.
            </p>
        </div>
    );
}

function StatusPill({
    active,
    children,
}: {
    active: boolean;
    children: React.ReactNode;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em]",
                active
                    ? "border-accent/18 bg-accent-soft text-accent-strong"
                    : "border-black/8 bg-white/72 text-black/50",
            )}
        >
            {children}
        </span>
    );
}