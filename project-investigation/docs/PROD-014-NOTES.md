# PROD-014 — AI grounding & context discipline (GAP-09)

## Problem

PRD 7.2/7.4/12.3 require one shared inference architecture with role-specific
voices, bounded context (recent windows, rolling summaries, evidence/character
retrieval) and strict conversation boundaries. The old `/chat` route sent a
hand-built string with the **entire** visible evidence list and journal to the
model, had no persisted summary, no suspect projection and no response/context
caps; role selection was scattered across hard-coded fallback branches.

## Design

New pure module `src/ai-grounding.ts` — all inputs are player-safe; it never
imports or reads `canonical_truth`, so it cannot leak the hidden solution:

- **Role-aware voice:** `detectTeamRole(message)` picks `lead | forensic | field |
  digital` from intent keywords (priority forensic → digital → field → lead).
  The role drives the local-LLM system prompt (`roleSystemHint`/label) and the
  deterministic fallback voice. Responses expose `teamRole`, `responderLabel`
  and start with the label, so the UI can name the speaker.
- **Suspect knowledge projection:** `findAddressedSuspectNames` resolves full
  names first (so "Victor Sterling" does not also match Martha Sterling), then
  distinct first/last names. The chat route feeds the **PROD-013 vetted safe
  suspect board** (`toPublicSuspectBoard`) into the context — only apparent
  motive, public background, alibi/relationship labels, and evidence the player
  has actually examined. `knowledge`/`beliefs`/`secrets`/`dialogue_constraints`
  and canonical truth are never read on this path.
- **Rolling summary:** `updateRollingSummary` folds in only messages not yet
  summarized (cursor in `conversations.context_references.summarizedMessageCount`)
  and keeps the most recent `maxSummaryChars` (1200). New db helper
  `updateConversationMemory` persists `summary` + cursor atomically. No schema
  change — both columns already exist.
- **Bounded retrieval:** `buildGroundedContext` uses the last 6 messages, the
  bounded summary, top-3 keyword-relevant evidence (recent-items fallback), only
  1–2 addressed suspects, and last 2 journal entries. The assembled prompt is
  capped at 6000 chars; responses at 2000 chars (LLM also `max_tokens: 220`).
- **Safety preserved:** auth/ownership from `investigationRouter`, chat rate
  limiter unchanged, local LLM first with deterministic fallback retained.
  `USE_LLM=false` is forced only inside the HTTP test harness for reproducibility.

Chat response shape (additive; old `role`/`content`/`timestamp` unchanged):

```jsonc
{
  "role": "investigator",
  "teamRole": "forensic",
  "responderLabel": "Forensic specialist",
  "addressedSuspects": ["Victor Sterling"],
  "context": { "window": 6, "recentMessages": 4, "retrievedEvidence": 3,
               "chars": 2100, "maxChars": 6000 },
  "content": "...", "timestamp": "..."
}
```

## Verification

`npm run typecheck`, `npm run test:smoke`, frontend `npm run build` and
`npm run test:http` all pass. `test:http` is **49/49** (45 pre-existing + 4 new):
role-aware shape/voice and bounded context, addressed-suspect public projection
with no hidden/canonical leak, bounded persisted rolling summary, and chat
auth/ownership.

## Risks / follow-ups

- Public character `background` prose can contain soft hints already exposed by
  `/characters` (not canonical truth); this task deliberately did not rewrite seed content.
- The summary cursor assumes serialized chat requests. Concurrent simultaneous
  chats on one investigation could interleave (MVP single-session limitation,
  same class as the in-memory session store).
- Model provider is still the local OpenAI-compatible endpoint with a
  deterministic fallback; no stronger model routing was added (out of scope).
