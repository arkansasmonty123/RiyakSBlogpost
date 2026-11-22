# M2 Knowledge System — backend contracts (M2-A / M2-B)

Additive backend only (migration `006_m2_knowledge.sql`). No historical migration
was touched; canonical truth, hidden evidence, progression, verdict and the
deterministic fallback are unchanged. Frontend UI is deliberately out of scope
(M2-C is owned by `ui-ux-frontend`).

## Routes (all require the existing session cookie)

Case-scoped (404 when case does not exist):

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/cases/:caseId/specialists` | `PublicSpecialist[]` |
| GET | `/api/cases/:caseId/artifacts` | `PublicArtifactSummary[]` (no `content`) |
| GET | `/api/cases/:caseId/artifacts/:artifactId` | `PublicArtifactDetail` (adds `content`, `usageNote`); 404 if artifact belongs to another case |
| GET | `/api/cases/:caseId/disagreements` | `PublicDisagreement[]` |

Investigation-scoped (auth + ownership enforced by `investigationRouter`;
`user_id` is server-derived):

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/investigations/:id/notebook` | `PublicNotebookEntry[]`, newest first |
| POST | `/api/investigations/:id/notebook` | 201; body: `{ entryType, concept?, title?, content?, artifactId?, specialistId? }` |
| PATCH | `/api/investigations/:id/notebook/:entryId` | 200; partial update; 404 if not owned |
| DELETE | `/api/investigations/:id/notebook/:entryId` | `{ success: true }`; 404 if not owned |

### DTO shapes (see `src/knowledge.ts` for allowlists)
- `PublicSpecialist`: `id, specialistKey, name, title, specialization, discipline,
  knowledgeDomains[], personality, communicationStyle, reasoningApproach,
  expertiseSummary, limitations[], depthGuidance{plain,working,technical},
  isFictional, realDisciplineBasis, caseRelevance, displayOrder`.
- `PublicArtifactSummary`: `id, artifactKey, title, artifactType, description,
  specialistKey, knowledgeClass, reliability, sourceAuthor, sourceUrl,
  bibliographyRef, publicationDate, sourceVerified, isFictional, relatedConcepts[]`.
  **`sourceUrl` is `null` unless `sourceVerified === true`.** The detail DTO adds
  `content` and `usageNote` only.
- `PublicDisagreement`: `id, disagreementKey, topic, specialistAKey/BKey,
  specialistAName/BName, positionA/B, disciplinaryBasis, uncertaintyNote,
  distinguishingEvidence, relatedArtifactKeys[]`.
- `PublicNotebookEntry`: `id, investigationId, entryType, artifactId,
  specialistId, concept, title, content, sourceSnapshot, createdAt, updatedAt`.
  `sourceSnapshot` is composed server-side from a safe artifact DTO (never raw
  `content`, never canonical data).

### Chat extension
`POST /api/investigations/:id/chat` accepts optional `specialistKey`, `intent`,
`depth`, `targetSpecialistKey`.

- `intent ∈ explain|deeper|relevance|challenge|alternatives|discriminate|sources|simpler|critique`
- `depth ∈ plain|working|technical`
- Unknown intent/depth/specialist → 400. Omitting all new fields keeps the exact
  legacy response shape (`role/teamRole/responderLabel/content/timestamp/…`).
- Specialist replies additionally return `specialistKey, specialistName, intent,
  depth`, and both the player and investigator messages persisted in the
  conversation carry those fields as top-level meta.
- One shared `generateAIResponse(message, context, responderSpec, addressed)`
  serves both paths. No canonical truth is read on either path.

## Seed (showcase case: The Midnight Heist)
`npm run db:seed:knowledge` (idempotent; also applies migration 006 defensively):
4 specialists, 7 artifacts (6 real-knowledge + 1 explicitly fictional in-world
doc), 2 disagreements. No source URLs are fabricated; real artifacts use
`source_verified=false` plus bibliography refs. `npm run knowledge:validate` is
read-only and enforces metadata rules + a canonical-leakage guard.

## Frontend M2-C TODOs
1. Specialist selector/picker on the investigation room (from
   `GET /api/cases/:caseId/specialists`), passing `specialistKey/intent/depth`
   to chat and rendering the new response fields + message meta.
2. Knowledge/artifact browser: list summaries, fetch detail on demand; show
   `sourceUrl` only when `sourceVerified` (the server already nulls it otherwise)
   and always show bibliography/author/verified status.
3. Disagreements view: present both positions with uncertainty and
   distinguishing evidence; do not present either position as the answer.
4. Notebook tab: CRUD against the notebook routes; distinguish confirmed vs
   personal notes; render `sourceSnapshot` as provenance.
5. Keep canonical solution strings out of all static UI copy. The seeded
   knowledge is already leak-guarded.

## Risks / notes
- M2 data exists only for the showcase case; other cases return empty M2 lists.
- `USE_LLM=true` uses the same responder spec; quality depends on the configured
  provider. Deterministic fallback (`USE_LLM=false`) is fully implemented.
- Notebook `content` is bounded to 4000 chars; artifact `content` is exposed in
  detail only and should be truncated in compact UI surfaces.
