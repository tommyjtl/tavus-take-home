# Implementation Plan

## Product Shape

- Use `/` as the app entry point and main interview shell. No separate marketing homepage.
- On first load, show a full-screen onboarding dialog over a blurred interview background.
- Fetch onboarding copy, interview settings, and persona/session metadata from the chassis/backend.
- Keep v1 stateless. No database unless you later need saved history or analytics.
- Request camera and microphone access during onboarding.
- Defer screen sharing for now.

## Tech Stack

- Next.js App Router for the host application
- Tavus CVI React component library for live video and audio conversation
- shadcn/ui + Tailwind CSS for the app shell and custom product UI
- `@monaco-editor/react` for the in-app code editor
- pnpm as the package manager
- `.env` for Tavus API credentials and related server-side configuration

Implementation notes:

- Use `pnpm` for package installation and scripts throughout the project.
- Keep the Tavus API key in `.env` and only access it from server-side code.

## Inputs

- `video`: provided by Tavus CVI UI
- `audio`: provided by Tavus CVI UI
- `code editor`: Monaco via `@monaco-editor/react`, owned by the app shell
- `hidden context`: send current problem, code snapshot, language, and interview phase to Tavus as ephemeral conversational context

## Suggested UI States

1. `onboarding`: blurred background + dialog from chassis
2. `device-check`: camera/mic preview + readiness checks
3. `live-interview`: Tavus conversation room + code editor + sidebar
4. `summary`: post-call evaluation and key takeaways

## UI Ownership

- Use Tavus CVI UI as the default streaming and conversation layer.
- Use shadcn/ui for the surrounding app shell: onboarding, layout, metadata, sidebar, and summary.
- Treat the Monaco editor as a custom product layer that sits beside Tavus.
- Use Tavus hidden conversational context to keep the persona aware of the latest code and interview state.
- Prefer embedding Tavus as-is for live call controls instead of rebuilding video primitives yourself.

## Context Strategy

- Use `conversation.overwrite_llm_context` for the latest authoritative state.
- Use it to send the current coding problem, latest code snapshot, selected language, interview phase, and candidate progress.
- Use `conversation.append_llm_context` only for additive notes that should accumulate during the session.
- Treat this as session-scoped context, not memory or persistence.

Example overwrite payload:

```json
{
  "problem": "two sum",
  "code": "function twoSum(nums: number[], target: number) {\n  return [];\n}",
  "language": "typescript",
  "phase": "implementation",
  "candidateProgress": "has described a hash map approach and is writing the first pass"
}
```

## Custom Persona Architecture

- `Role`: Technical Interviewer
- `Replica`: Anna or another professional Tavus avatar
- `System Prompt`: define tone, hinting behavior, evaluation style, and how to use hidden context
- `Objectives`: greeting, explain problem, candidate thinking, hint, evaluation, closing
- `Guardrails`: do not reveal the full solution too early, stay on task, do not overclaim what the model can see or infer
- `Turn Detection`: Sparrow
- `Perception`: Raven
- `STT`: Tavus speech-to-text layer
- `LLM`: Tavus hosted LLM
- `Tools`: optional, only if needed for structured scoring or note-taking
- `TTS`: Tavus speech layer
- `Knowledge Base`: optional, skip in v1 unless supporting interview docs are clearly needed

Implementation note:

- Create the first custom persona in the Tavus dashboard or via API after the base room integration is working.

## Phase 1: App Shell, Onboarding, and Tavus Integration

- Set up shadcn/ui, base design tokens, and a full-height app shell.
- Initialize Tavus CVI UI and wrap the app with `CVIProvider`.
- Add a server endpoint that creates a Tavus conversation URL securely.
- Build the onboarding dialog as the first-run experience.
- Fetch onboarding content from the chassis/backend so the copy and interview setup can be controlled externally.
- Request camera and microphone access in the dialog.
- Store readiness state locally so the user can move from onboarding into the live room cleanly.
- Use an example or stock persona first so you can prove the end-to-end Tavus integration before persona tuning.

Output:
- User can open the app, complete onboarding, create a Tavus conversation, and successfully join it from your UI.

Resources:
- Tavus CVI component overview: https://docs.tavus.io/sections/conversational-video-interface/component-library/overview
- Tavus create conversation API: https://docs.tavus.io/api-reference/conversations/create-conversation
- shadcn/ui docs: https://ui.shadcn.com/docs

## Phase 2: Live Interview Experience and Custom Persona

- Render Tavus `Conversation` inside the main content area.
- Keep the Tavus room as the core call surface, with your app shell around it.
- Add a Monaco-based in-app code editor beside the Tavus room.
- Add a lightweight right sidebar for timer, problem metadata, transcript snippets, and session status.
- On meaningful code-editor changes, broadcast `conversation.overwrite_llm_context` so the persona has the latest code and task state.
- Use `conversation.append_llm_context` only for additive milestones when accumulating context is useful.
- Create your own interviewer persona in Tavus.
- Start with a strong system prompt and instruct the persona to use hidden conversational context when it is present.
- Add a simple objective chain only if the base conversation already feels stable.
- Wire leave/end events so the app can transition into summary state.

Recommended persona behavior:

- ask the candidate to think out loud
- use the latest hidden context about the problem, code, and interview phase when available
- give hints without revealing the solution too early
- ask about complexity, tradeoffs, and edge cases
- end with a concise evaluation

Output:
- Full interview flow works with Tavus AV, the in-app editor, hidden context updates, and your custom interviewer persona.

Resources:
- Tavus CVI component overview: https://docs.tavus.io/sections/conversational-video-interface/component-library/overview
- Tavus interaction hooks and events: https://docs.tavus.io/llms-full.txt?utm_source=chatgpt.com
- Tavus overwrite context event: https://docs.tavus.io/sections/event-schemas/conversation-overwrite-context
- Tavus append context event: https://docs.tavus.io/sections/event-schemas/conversation-append-context
- Tavus LLM layer: https://docs.tavus.io/sections/conversational-video-interface/persona/llm
- Tavus objectives: https://docs.tavus.io/sections/conversational-video-interface/persona/objectives

## Phase 3: Summary, Refinement, and Optional Enhancements

- Keep session state in memory for the duration of the interview.
- Optionally consume Tavus callbacks or frontend events to assemble the final summary without writing to a database.
- Show a concise summary view after the interview ends.
- Keep the rubric lightweight: problem solving, communication, debugging, correctness.
- Tune when to send overwrite vs append context events so the persona stays current without excessive churn.
- Add one LLM tool for structured scoring or note-taking only if the core flow is already solid.
- Add a chassis-driven variant system only if time remains.

Output:
- The app ends as a complete product and shows at least one layer of refinement beyond the basic integration.

Resources:
- Tavus conversation callbacks and events: https://docs.tavus.io/sections/webhooks-and-callbacks
- Tavus LLM tool calling: https://docs.tavus.io/sections/conversational-video-interface/persona/llm-tool
- Tavus perception tool calling: https://docs.tavus.io/sections/conversational-video-interface/persona/perception-tool

## Recommended Order Tonight

1. Build the app shell, onboarding flow, and Tavus conversation creation path.
2. Prove that you can join a Tavus conversation from your UI using an example persona.
3. Add the Monaco editor, sidebar, and hidden context updates.
4. Swap in your custom interviewer persona and tune the prompt.
5. Finish the summary view and any final polish.
6. Add one optional advanced feature only if the core flow is stable.

## Database Decision

- Do not add a database in v1.
- Tavus handles the live conversation layer; your app only needs transient session state and a secure server endpoint for conversation creation.
- Add storage later only if you need interview history, user accounts, analytics, or saved evaluations.

## Key Constraint

- Camera and microphone can be requested during onboarding.
- Hidden conversational context is session-scoped only. It helps the current interview but does not persist as memory after the session ends.

## Suggested Chassis Contract

Return a small payload that the frontend can render directly:

```json
{
  "title": "AI Coding Interview",
  "intro": "You will talk to the interviewer face-to-face while solving one problem in the in-app editor.",
  "checklist": [
    "Enable camera",
    "Enable microphone",
    "Open the code editor",
    "Think out loud while solving"
  ],
  "interviewMode": "typescript",
  "difficulty": "medium",
  "personaId": "..."
}
```

This keeps onboarding copy and session configuration owned by the backend while the frontend stays simple.