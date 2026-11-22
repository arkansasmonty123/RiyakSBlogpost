# M3 Foundation — provenance, packs, validation, export

Additive backend + frontend foundation for Milestone 3. No M2 behavior was
removed; all 67 pre-existing HTTP tests still pass (71/71 total after adding 4
M3 tests). See `M2-KNOWLEDGE-NOTES.md` for the original M2 contracts.

## Schema (migration `007_m3_knowledge_quality.sql`)

Additive, idempotent, mirrors `scripts/ci-schema.sql` and `scripts/verify-schema.ts`.

- `knowledge_artifacts` gains: `source_type`, `verification_status`
  (`draft|pending_review|verified|rejected|needs_reverification`, default
  `draft`), `verification_notes`, `last_verified_at`, `claims_supported`,
  `learning_objectives`, `related_evidence_refs`, `suggested_conversations`,
  `depth_content` (all JSON defaults).
- New `case_knowledge_packs` table: `id`, `case_id` (UNIQUE), `version`,
  `pack_status`, `learning_objectives`, `summary`, timestamps.
- Backfill: unverified real rows -> `pending_review`; the fictional in-world
  prop -> `verified` with a prop-only note; legacy classes mapped to the M3
  allowlist (`established`->`established_scientific`,
  `methodology-caution`->`contested_scientific`, `fictional`->`fictional_in_world`).
  Legacy aliases remain accepted by validators/DTOs.

## Provenance rules

- `sourceUrl` is exposed only when `sourceVerified === true` **and**
  `verificationStatus === 'verified'` (single rule in `toPublicArtifactSummary`).
- Nothing auto-verifies a real source: all real Midnight Heist references keep
  `source_verified=false`, no URL, a bibliography and `pending_review`.
- `verification_status='verified'` requires non-empty verification notes plus a
  valid URL, or `is_fictional`, or a substantive bibliography.
- `related_evidence_refs` are stable, human-readable source labels only (never
  evidence UUIDs). For the showcase case only **player-visible** source labels
  are used, so hidden evidence is not implied.

## Routes

- `GET /api/cases/:caseId/knowledge-pack` — auth + case exists; 404 when no
  pack. Returns pack metadata + `{ specialists, artifacts, disagreements }` counts.
- `GET /api/investigations/:id/notebook/export?format=json|markdown` — auth +
  ownership via `investigationRouter`. JSON returns a safe envelope; Markdown
  is a readable document. Both use only `toPublicNotebookEntry` DTOs.

## Authoring structure

- `src/knowledge-packs/types.ts` — typed pack schema.
- `src/knowledge-packs/midnight-heist.ts` — migrated M2 content enriched with
  objectives, claims, suggested conversations, evidence refs and depth content.
- `src/knowledge-packs/index.ts` — registry (`KNOWLEDGE_PACKS`).
- `npm run db:seed:knowledge` now loads packs from the registry (applies
  migrations 006 + 007 defensively). Adding a pack = new file + registry entry.

## Validation (`npm run knowledge:validate`)

Read-only, case-aware (any case with M2 data or a pack). Checks schema,
verification/class enums, provenance sufficiency, pack objectives, duplicate
keys globally, content depth, fuzzy evidence-ref matching and a per-case
canonical leakage guard whose strings come from pack config and are never
logged. Warnings (e.g. missing `claims_supported`) do not fail the build.

## Frontend

- `api.ts`: new DTO fields, `getCaseKnowledgePack`, `exportNotebookJson`,
  `exportNotebookMarkdown`.
- Drawer/card: review status, source type, verification notes, objectives,
  supported claims, related material, suggested conversations, depth tabs.
- Experts tab: pack summary + learning objectives. Notebook: JSON/Markdown
  export downloads. Existing visual identity preserved.

## Remaining TODO for M3 content (separate task)

1. Author `Code Blue at the Clinic` and `Blaze at Dawn Bakery` packs with
   verified citations. M3-RESEARCH produced 4 verified candidates per case;
   use those exact citations/URLs/status notes — never invent links or quotes.
2. Add both pack files, register them in `src/knowledge-packs/index.ts`, then
   run `db:seed:knowledge`, `knowledge:validate`, `case:validate`, `test:http`.
3. Set non-fictional artifacts to `pending_review` unless a source URL and
   verification notes are available; fictional props may be `verified` with a
   prop-only verification note.
4. Extend HTTP smoke coverage to assert each new case's pack endpoint returns
   200 with non-empty objectives and no canonical leakage.
