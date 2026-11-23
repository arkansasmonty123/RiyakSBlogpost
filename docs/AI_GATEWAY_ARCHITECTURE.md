# THE BAR — AI Gateway Architecture (Track C Contract)

**Status:** Proposed contract — documentation only. No runtime code changed by this document.
**Date:** 2026-11-23
**Scope:** Model-independent runtime-AI boundary for THE BAR.
**Related:** [ADR-001](./ADRs/ADR-001-stack-and-size-conscious-foundation.md) (stack, AI disabled by default), [ADR-002](./ADRs/ADR-002-p0-vertical-slice.md) (P0 slice boundary), [ADR-003](./ADRs/ADR-003-persistence-integration.md) (persistence seam), [DECISIONS.md](./DECISIONS.md) D-003 / D-013, [`../THE_BAR_MASTER_CONTEXT.md`](../THE_BAR_MASTER_CONTEXT.md) §16 (four-layer model, event-driven inference).

This document defines **what the AI boundary must look like** before any further runtime-AI work. It separates roles (contracts) from models (replaceable), fixes the four-layer split, and states honestly what exists today.

---

## 0. Ground rules

1. **AI proposes; deterministic code disposes.** No AI output mutates game state, marks a source verified, or is shown as legal authority. All state changes go through existing deterministic domain functions.
2. **One seam, many roles.** Roles are prompt + schema + validation contracts, not separate models or servers. A single local model may serve several roles; swapping models must not change any caller.
3. **Disabled by default at the provider layer.** `loadConfig()` hard-codes `runtimeAiProvider: 'disabled'` and ignores endpoint/key env values (`src/config/env.ts`). No hosted provider, no bundled model, no network call at import time.
4. **No canonical-truth egress.** The canonical case record (`CaseFile.canonicalTruth`) is never an input to any AI path. Existing guards already enforce this at prompt, context and output.
5. **Every claim is traceable or refused.** Output that asserts legal authority without a verified registry entry is rejected or downgraded to an explicitly non-authoritative note.

> Honest caveat on "disabled by default": the **provider** is disabled by default. The experimental **Local AI Lab panel** is visible by default (`isLocalAiPanelEnabled` returns `true` unless `VITE_ENABLE_LOCAL_AI=false`), but it only calls `127.0.0.1:8081` after an explicit user click and requires the user to have started llama-server. No LLM is invoked by gameplay, movement, or panel switching.

---

## 1. Model-independent gateway interface

### 1.1 Current interface (implemented)

`src/domain/ai/provider.ts` is already model-independent and is the base to extend:

```ts
interface LocalAiProvider {
  readonly id: string;
  readonly label: string;
  generate(request: ProviderRequest): Promise<ProviderResult>;
}
// ProviderRequest: messages[], maxTokens, temperature, signal?
// ProviderResult: { ok: true, text } | { ok: false, code: ProviderErrorCode, error }
```

Guardrails live **outside** the provider (`src/services/localLlm.ts` + `src/domain/ai/guards.ts`) so every future provider inherits the same checks. This separation must be preserved.

### 1.2 Proposed gateway contract (to build)

A single `AiGateway` sits above providers and below UI/domain callers:

```
caller (UI / domain)  →  AiGateway.invoke(roleRequest)  →  provider.generate()
                              ↓
                    schema + safety + provenance validation
                              ↓
                    AiGatewayResult { accepted | rejected | degraded }
```

`AiGateway.invoke` must:

- accept a **role id**, a **task type**, a **bounded context envelope** (player-visible facts only), and a **response schema id**;
- resolve model + parameters from a **model profile** (small/fast vs stronger), never from caller code;
- apply prompt guard → provider call (timeout + cancellation) → shape/schema validation → safety scan → provenance check;
- return a **structured result**, never throw, and never return raw model text to state-mutating code.

### 1.3 Role contracts (logical roles, not models)

Each role is a contract: purpose, allowed inputs, required output schema, forbidden content, and which deterministic gate consumes it.

| Role                             | Purpose                                                       | Allowed inputs                                                                        | Output (schema id)                                 | Consumed by                                           | Status                                        |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| **Character**                    | In-character dialogue, reactions, memory-aware replies        | Character sheet, player-visible dialogue, relationship dims, knowledge boundaries     | `DialogueReply` (free text + optional tone tag)    | Dialogue panel (display only)                         | Deferred (deterministic dialogue ships today) |
| **Senior mentor**                | Critique a research note / draft, name gaps, ask for revision | Assignment requirements, player's submitted text, player-visible evidence/source refs | `ReviewFeedback` (§5)                              | `submitSeniorReview` / `submitDraftForFeedback` gates | **First milestone**                           |
| **Opposing counsel**             | Argue the other side in a hearing                             | Hearing transcript so far, player-visible record                                      | `ArgumentTurn`                                     | Courtroom engine                                      | Deferred (Phase 7)                            |
| **Legal researcher**             | Retrieve + explain sourced material                           | Player query, approved corpus hits + provenance                                       | `ResearchAnswer` (claims each bound to `sourceId`) | Research panel; citation gate                         | Partial (deterministic RAG-lite only)         |
| **Case architect**               | Propose case facts/evidence structures for authoring          | Authoring brief, template constraints                                                 | `CaseProposal`                                     | Human authoring review; never auto-applied            | Deferred                                      |
| **Judge simulation**             | Rule on admissibility/procedure from the record               | Hearing record, applicable verified provisions                                        | `Ruling` (issue, basis, sourceRefs)                | Courtroom engine + deterministic rule check           | Deferred                                      |
| **Player evaluator**             | Score reasoning quality over time                             | Player drafts, theory board, notebook                                                 | `Evaluation` (rubric dimensions)                   | Legal Mind Profile (advisory only)                    | Deferred (deterministic profile ships)        |
| **World simulation**             | Propose events (scheduling, institutional)                    | World state, clock, constraints                                                       | `WorldEventProposal`                               | Deterministic scheduler validation                    | Deferred                                      |
| **Forensic / specialist expert** | Explain a domain record (medical, digital, etc.)              | The specific record + its provenance                                                  | `ExpertExplanation`                                | Display; must not assert authenticity                 | Deferred                                      |

**Rule:** adding a role must not add a model dependency. A role is added by defining its schema, its allowed input projection, and its deterministic consumer. If any of those three is missing, the role stays deferred.

---

## 2. Four-layer separation

| Layer                                  | Responsibility                                                           | Implemented artefact                                                                                                               | Status                                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Specialised model**               | Behaviour/format adaptation only — never the source of legal truth       | `LocalAiProvider` + `llamaServerProvider` (OpenAI-compatible, local only)                                                          | Experimental: local llama-server only; no fine-tuned model, no bundled model                                                                                                                        |
| **2. Verified legal knowledge base**   | Current, provenance-tracked law and approved summaries                   | `LegalSource` model + `docs/legal-corpus/` manifest pipeline + `retrieveApprovedInternalSummaries`                                 | Metadata-only: 7 verified seed records (6 official Act/judgment metadata + 1 internal educational summary); **no provision/judgment text ingested**; corpus manifest template is rejected by design |
| **3. Persistent game DB**              | Facts, characters, cases, player history, world state                    | localStorage (default) / SQLite via `node:sqlite` (`sqlite-api`, opt-in)                                                           | Implemented; canonical truth stripped on write (`stripCanonicalTruth`, `toPersistedSave`)                                                                                                           |
| **4. Deterministic validation engine** | Citations, dates, provisions, evidence access, game rules, state commits | `guards.ts`, `legalSources.ts` (`canCiteAsAuthoritative`), `checkDraftCitations`, `casework.ts`, `progression.ts`, `caseAccess.ts` | Implemented                                                                                                                                                                                         |

**Layer invariants**

- The model (1) may read layers 2 and 3 **only through projections** that strip canonical truth and unverified authority.
- Legal knowledge (2) is external and updateable; it is never baked into model weights. Only approved `summary` records are eligible for retrieval (`isApprovedInternalSummary`: `intake === 'seed'` AND `verificationStatus === 'verified'` AND `sourceType === 'summary'`).
- The DB (3) is the only persistence authority; AI output is never persisted as fact without passing (4).
- (4) is pure, synchronous, test-covered, and works with the AI path entirely absent — this is the deterministic fallback.

---

## 3. Event-driven inference rules

**Never call an LLM on every click, movement, or database lookup.** Inference is triggered only by explicit, discrete events, and every trigger has a deterministic path that produces a usable result without the model.

| Event                                  | AI call allowed? | Deterministic fallback                                      |
| -------------------------------------- | ---------------- | ----------------------------------------------------------- |
| Panel switch / movement / clock tick   | No               | N/A                                                         |
| Evidence discover/review/assess        | No               | `src/domain/evidence.ts`                                    |
| Relationship/flag/audit update         | No               | Domain functions                                            |
| Player clicks "Ask local model"        | Yes (explicit)   | Panel shows idle + non-authoritative notice                 |
| Player submits a draft / research note | Optional, opt-in | `submitDraftForFeedback`, `submitSeniorReview`              |
| Player requests a research explanation | Optional, opt-in | Corpus retrieval returns provenance or "no approved source" |

**Required properties of any AI trigger**

1. **Opt-in per event.** A missing/failed/disabled model yields the deterministic result, not an error blocking play.
2. **Bounded.** Existing caps apply to every role: prompt ≤ 2000 chars, response ≤ 4000 chars, raw envelope ≤ 16000 chars, `maxTokens: 256`, `temperature: 0.2`, timeout 15 s, ≤ 2 retrieved sources, ≤ 600-char excerpts.
3. **Cancellable.** `AbortSignal` on unmount/reset/new request; late responses discarded (App already guards with `aiRequestId`).
4. **Idempotent.** Re-invoking a role for the same event must not double-apply state; the gateway returns a proposal that (4) applies at most once.
5. **Offline-safe.** No network call at import, boot, or when the provider is disabled.

---

## 4. Safety and validation boundaries

All checks below already exist for the experimental path and become **mandatory gates** for every role.

| Boundary                          | Mechanism (existing)                                                         | Behaviour                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Prompt guard                      | `guardPrompt`                                                                | Rejects empty, >2000 chars, canonical-truth markers, boundary-bypass/injection                                     |
| Canonical-truth non-leakage (in)  | `containsCanonicalTruth` on prompt + every context block                     | Block; context blocks dropped as defence-in-depth                                                                  |
| Canonical-truth non-leakage (out) | `checkAiOutput`                                                              | **Hard block** if hidden truth appears in output                                                                   |
| Citation verification             | `looksLikeSpecificCitation`, `checkDraftCitations`, `canCiteAsAuthoritative` | Citation-looking text → warning; unregistered specific citations → blocked in drafts                               |
| Provenance verification           | `validateSourceProvenance`                                                   | `verified` requires traceable provenance + official URL for specific citations; placeholders can never be verified |
| Unsafe claims                     | `containsUnsafeClaim`                                                        | Warns on authoritative-sounding legal conclusions / hidden responsibility                                          |
| Citation-fabrication request      | `looksLikeCitationFabricationRequest`                                        | Non-blocking warning; never supplies invented authority                                                            |
| Shape/size                        | `validateLocalLlmShape`, `truncateAiResponse`                                | Strict envelope validation; bounded output                                                                         |
| Transport                         | provider timeout/cancel/error codes                                          | Structured failure, never throws                                                                                   |
| Labelling                         | `AI_NON_AUTHORITATIVE_NOTICE` + UI banner                                    | Every AI surface is labelled experimental/non-authoritative                                                        |

**Knowledge boundaries:** each role receives only the projection its consumer is allowed to see. Character roles get the character's `knowledgeBoundaries` and player-visible state; evaluator roles never get canonical truth; research roles get only approved summaries with provenance attached.

**Cost / latency / timeouts:** enforce per-role budgets (tokens, wall-clock, retries ≤ 1) at the gateway. A role that exceeds budget returns `degraded` and the deterministic fallback runs. No background/looping inference; no speculative pre-fetch.

**Non-goals:** no model training is recommended here. Only offline **evaluation** (quality, citation-fidelity, boundary robustness) is in scope before promoting any role beyond experimental.

---

## 5. First milestone — "Senior reviews your legal research"

**Goal:** an opt-in AI-assisted senior review that _proposes_ structured feedback, which the **existing deterministic senior gate** validates and commits. The AI never accepts or rejects on its own.

### 5.1 Flow

```
Player writes research note / draft
        ↓
[explicit action] AiGateway.invoke('senior-mentor', 'review-research')
        ↓
proposal: ReviewFeedback (schema below)
        ↓
GATE 1 schema  → GATE 2 safety → GATE 3 provenance → GATE 4 deterministic rules
        ↓                                   ↓
   accepted proposal                  any gate fails
        ↓                                   ↓
submitSeniorReview(...) applies      deterministic feedback only
(unchanged rules, unchanged state)   (existing behaviour, no AI text)
```

### 5.2 Structured I/O schema (proposal; validated by hand-rolled checks — no schema library in deps)

```jsonc
{
  "schemaId": "review-feedback.v1",
  "roleId": "senior-mentor",
  "requestId": "opaque",
  "status": "ok | refused",
  "summary": "<= 400 chars, no legal conclusions",
  "strengths": [{ "point": "string", "basis": "evidence | source | reasoning", "refs": ["ev-1", "ls-bns"] }],
  "gaps": [{ "point": "string", "fix": "string", "refs": [] }],
  "citedSources": ["ls-4"], // must exist in registry + be canCiteAsAuthoritative
  "requiresRevision": true,
  "refusalReason": "string|null",
}
```

Rules: unknown fields rejected; `refs` must resolve to player-visible ids; `citedSources` ⊆ verified registry; no free-text legal assertion without a `refs`/`citedSources` binding; total serialized size bounded.

### 5.3 Validation gates

1. **Schema gate** — shape, field types, size caps, unknown-field rejection.
2. **Safety gate** — `containsCanonicalTruth` (hard block), `containsUnsafeClaim` (strip/downgrade), `looksLikeSpecificCitation` (require registry match).
3. **Provenance gate** — every `citedSources` id passes `canCiteAsAuthoritative`; otherwise drop the citation and mark the point unverified.
4. **Deterministic rule gate** — map accepted `gaps` onto the existing checks in `submitSeniorReview` (required evidence reviewed, source notes attached, milestone flags, summary length ≥ 40, no "guilty/at fault/culprit" assertion, revision loop). The deterministic function remains the only writer.

**Acceptance criteria**

- With AI disabled/offline: identical behaviour to today (deterministic feedback only).
- With AI enabled: an accepted proposal can never unlock an assignment that `submitSeniorReview` would reject.
- Adversarial inputs (injection, canonical-truth probe, fabricated citation) are blocked by an automated test, not by prompt wording.
- No new dependency added; all validation deterministic and unit-tested.

---

## 6. Implemented now vs deferred

### Implemented (verified in repo)

- Model-independent provider interface + local llama-server adapter (`src/domain/ai/provider.ts`, `src/services/ai/llamaServerProvider.ts`).
- Guard layer: prompt/output/citation/canonical-truth/unsafe-claim/boundary-bypass (`src/domain/ai/guards.ts`).
- Deterministic RAG-lite over approved internal summaries only (`src/domain/ai/retrieval.ts`).
- Service orchestrator with bounded sizes, timeout, cancellation, non-authoritative labelling (`src/services/localLlm.ts`).
- Local AI Lab panel (opt-out via `VITE_ENABLE_LOCAL_AI=false`), explicit-click only.
- Deterministic senior review, draft submission, citation gate, provenance validation, canonical-truth no-leak projection.
- Persistence seam (localStorage default; SQLite opt-in) with canonical truth stripped on write.
- Test coverage: `ai_guard`, `ai_provider`, `ai_redteam`, `ai_retrieval`, `local_ai_service`, `local_ai_panel` suites.

### Deferred (no code exists)

- `AiGateway` facade, role registry, model profiles, per-role budgets.
- Structured/schema-validated role outputs (`ReviewFeedback` etc.) — current output is free text.
- Any role beyond the experimental generic assistant: Character, Opposing counsel, Legal researcher (AI), Case architect, Judge, Player evaluator (AI), World simulation, Forensic expert.
- Verified legal corpus with provision/judgment text and citation-specific review (metadata only today; manifest template rejected by design).
- Production provider abstraction (hosted/remote), cost accounting, rate limiting, red-team CI suite.
- Fine-tuned or benchmarked small legal model (no evaluation performed; none recommended here).

---

## 7. Risks and assumptions

| Risk / assumption                                         | Impact                                                                                   | Mitigation / what to measure first                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Canonical truth is compiled into the client bundle (seed) | A motivated player can read hidden facts in devtools; AI boundary is not the leak vector | Keep AI paths truth-free; treat bundle secrecy as out of scope until server-side truth |
| "Verified" metadata ≠ verified law                        | Research role could imply authority it lacks                                             | Provenance gate + non-authoritative labelling; no provision text until human review    |
| Small local model quality unproven                        | Bad critiques, hallucinated citations                                                    | Evaluate citation-fidelity + boundary robustness offline before enabling any role      |
| Hand-rolled schema validation drift                       | Silent shape gaps                                                                        | One schema per role, unit tests per gate, reject unknown fields                        |
| Latency/battery on mobile                                 | Poor UX                                                                                  | Per-role budget + deterministic fallback; measure p50/p95 locally                      |

## 8. Recommended next action

Implement the `AiGateway` facade + `review-feedback.v1` schema and wire the senior-review milestone **behind a flag**, with the four gates and adversarial tests, without changing `submitSeniorReview`'s rules. Everything else stays deferred until that milestone passes its acceptance criteria.
