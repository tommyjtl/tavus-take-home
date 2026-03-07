# Tavus AI Mock Coding Interview Companion

An AI mock coding interview app built with Next.js, Monaco Editor, and Tavus + Daily. The app lets a candidate complete a short coding interview while a Tavus persona conducts the conversation and receives hidden context updates from the in-app code editor.

![](./assets/Screenshot%202026-03-07%20at%2015.53.40.png)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A Tavus API key
- A Tavus persona ID or replica ID

### Environment

Create a `.env.local` file with:

```bash
TAVUS_API_KEY=your_api_key
TAVUS_PERSONA_ID=your_persona_id
TAVUS_REPLICA_ID=your_replica_id
# optional
TAVUS_CALLBACK_URL=https://your-callback-url
TAVUS_TEST_MODE=false
TAVUS_REQUIRE_AUTH=false
```

### Run Locally

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:3000`.

## Architecture Overview

### Main Flow

```text
Candidate
	-> onboarding dialog
	-> device permission check + preview
	-> create Tavus conversation via Next.js API
	-> join Daily room using Tavus conversation URL
	-> edit code in Monaco
	-> send overwrite-context updates to Tavus persona
	-> leave interview
```

### App Structure

- `app/page.tsx`: mounts the interview experience.
- `components/interview-experience.tsx`: owns onboarding, session state, layout, and live context generation.
- `components/cvi/conversation.tsx`: Daily/Tavus live interview panel and debug diagnostics.
- `components/cvi/code-editor.tsx`: Monaco editor and prompt panel.
- `components/cvi/use-device-readiness.ts`: camera and microphone permission flow.
- `app/api/conversation/route.ts`: creates and ends Tavus conversations.
- `app/api/chassis/route.ts`: serves chassis and persona configuration to the client.
- `lib/tavus.ts`: Tavus API integration.
- `lib/contracts.ts`: shared types and default chassis payload.

### Data Path

```text
Monaco editor state
	-> InterviewExperience builds live coding context
	-> Conversation sends overwrite-context app message
	-> Tavus persona responds using latest available hidden context
```

## Known Problems

- [ ] The Tavus persona does not reliably speak first when the interview starts, so the opening turn can stall instead of naturally kicking off the session.
- [ ] Hidden context updates are not fully reliable yet. After the candidate changes code, the Tavus persona can sometimes continue responding to stale context and ask questions based on outdated code state.
- [ ] The interview currently ends without a dedicated post-interview evaluation summary for the candidate.
- [ ] There is no visible session timer in the live UI.
- [ ] Server endpoints currently do not include authentication, authorization, or rate limiting

## Improvements

- [ ] Add a candidate-facing post-interview evaluation dialog with summary feedback.
- [ ] Add a visible live timer for elapsed and remaining interview time.
- [ ] Improve reliability of hidden context synchronization so the persona consistently reacts to the latest code state.
- [ ] Evaluate Tavus `conversation.respond` as a fallback or supplement for pushing code state and opening prompts to the persona, instead of relying only on hidden overwrite-context updates.
- [ ] Add authenticated API access, rate limiting, and stronger request validation.
- [ ] Add better conversation end-state UX, including a clearer transition from live interview to summary.