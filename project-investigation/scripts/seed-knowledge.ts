// M3 knowledge seed: loads case knowledge packs from the typed registry.
// Idempotent and deterministic (keyed upserts).
//
//   npm run db:seed:knowledge
//
// SAFETY / NON-LEAKAGE:
//   * Packs never name a canonical culprit, hidden location or evidence UUID.
//     Evidence refs are stable, human-readable source snippets only.
//   * Real-knowledge artifacts keep source_verified=false with NO source_url
//     and a stable bibliography_ref; verification_status is `pending_review`.
//   * The explicitly fictional in-world prop is `verified` as a prop only.
//   * No source is ever auto-verified by this seed.

import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from '../src/db';
import { KNOWLEDGE_PACKS } from '../src/knowledge-packs';
import type {
  ArtifactPackEntry,
  CaseKnowledgePack,
  DisagreementPackEntry,
  SpecialistPackEntry,
} from '../src/knowledge-packs/types';

// Applies the additive M2 + M3 migrations defensively so this seed works on a
// fresh DB as well as one where CI already applied them. Both are idempotent.
async function applyMigrations(): Promise<void> {
  for (const file of ['006_m2_knowledge.sql', '007_m3_knowledge_quality.sql']) {
    const resolved = path.resolve(process.cwd(), 'migrations', file);
    if (!fs.existsSync(resolved)) throw new Error(`Missing migration: ${resolved}`);
    await query(fs.readFileSync(resolved, 'utf8'));
  }
}

async function resolveCaseId(pack: CaseKnowledgePack): Promise<string | null> {
  const result = await query('SELECT id FROM cases WHERE title = $1 LIMIT 1', [pack.caseTitle]);
  return result.rows[0] ? String(result.rows[0].id) : null;
}

async function upsertPack(pack: CaseKnowledgePack, caseId: string): Promise<void> {
  await query(
    `INSERT INTO case_knowledge_packs
       (case_id, version, pack_status, learning_objectives, summary)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (case_id) DO UPDATE SET
       version = EXCLUDED.version, pack_status = EXCLUDED.pack_status,
       learning_objectives = EXCLUDED.learning_objectives, summary = EXCLUDED.summary,
       updated_at = NOW()`,
    [caseId, pack.version, pack.packStatus, JSON.stringify(pack.learningObjectives), pack.summary]
  );
}

async function upsertSpecialist(s: SpecialistPackEntry): Promise<string> {
  const result = await query(
    `INSERT INTO specialists
       (specialist_key, name, title, specialization, discipline, knowledge_domains,
        personality, communication_style, reasoning_approach, expertise_summary,
        limitations, depth_guidance, is_fictional, real_discipline_basis)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (specialist_key) DO UPDATE SET
        name = EXCLUDED.name, title = EXCLUDED.title, specialization = EXCLUDED.specialization,
        discipline = EXCLUDED.discipline, knowledge_domains = EXCLUDED.knowledge_domains,
        personality = EXCLUDED.personality, communication_style = EXCLUDED.communication_style,
        reasoning_approach = EXCLUDED.reasoning_approach, expertise_summary = EXCLUDED.expertise_summary,
        limitations = EXCLUDED.limitations, depth_guidance = EXCLUDED.depth_guidance,
        is_fictional = EXCLUDED.is_fictional, real_discipline_basis = EXCLUDED.real_discipline_basis,
        updated_at = NOW()
      RETURNING id`,
    [
      s.key, s.name, s.title, s.specialization, s.discipline, JSON.stringify(s.knowledgeDomains),
      s.personality, s.communicationStyle, s.reasoningApproach, s.expertiseSummary,
      JSON.stringify(s.limitations), JSON.stringify(s.depthGuidance), true, s.realDisciplineBasis,
    ]
  );
  return result.rows[0].id as string;
}

async function attachSpecialist(caseId: string, id: string, s: SpecialistPackEntry): Promise<void> {
  await query(
    `INSERT INTO case_specialists (case_id, specialist_id, case_relevance, display_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (case_id, specialist_id) DO UPDATE SET
       case_relevance = EXCLUDED.case_relevance, display_order = EXCLUDED.display_order, updated_at = NOW()`,
    [caseId, id, s.caseRelevance, s.displayOrder]
  );
}

async function upsertArtifact(caseId: string, a: ArtifactPackEntry, specialistIds: Map<string, string>): Promise<void> {
  const specialistId = a.specialistKey ? specialistIds.get(a.specialistKey) ?? null : null;
  await query(
    `INSERT INTO knowledge_artifacts
       (artifact_key, title, artifact_type, description, content, specialist_id, case_id,
        source_author, source_url, source_verified, bibliography_ref, publication_date,
        knowledge_class, reliability, related_concepts, is_fictional, usage_note,
        source_type, verification_status, verification_notes, last_verified_at,
        claims_supported, learning_objectives, related_evidence_refs,
        suggested_conversations, depth_content)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
              $18,$19,$20,$21,$22,$23,$24,$25,$26)
      ON CONFLICT (artifact_key) DO UPDATE SET
        title = EXCLUDED.title, artifact_type = EXCLUDED.artifact_type,
        description = EXCLUDED.description, content = EXCLUDED.content,
        specialist_id = EXCLUDED.specialist_id, case_id = EXCLUDED.case_id,
        source_author = EXCLUDED.source_author, source_url = EXCLUDED.source_url,
        source_verified = EXCLUDED.source_verified, bibliography_ref = EXCLUDED.bibliography_ref,
        publication_date = EXCLUDED.publication_date, knowledge_class = EXCLUDED.knowledge_class,
        reliability = EXCLUDED.reliability, related_concepts = EXCLUDED.related_concepts,
        is_fictional = EXCLUDED.is_fictional, usage_note = EXCLUDED.usage_note,
        source_type = EXCLUDED.source_type, verification_status = EXCLUDED.verification_status,
        verification_notes = EXCLUDED.verification_notes, last_verified_at = EXCLUDED.last_verified_at,
        claims_supported = EXCLUDED.claims_supported, learning_objectives = EXCLUDED.learning_objectives,
        related_evidence_refs = EXCLUDED.related_evidence_refs,
        suggested_conversations = EXCLUDED.suggested_conversations,
        depth_content = EXCLUDED.depth_content, updated_at = NOW()`,
    [
      a.key, a.title, a.artifactType, a.description, a.content, specialistId, caseId,
      a.sourceAuthor, a.sourceUrl, a.sourceVerified, a.bibliographyRef, a.publicationDate,
      a.knowledgeClass, a.reliability, JSON.stringify(a.relatedConcepts), a.isFictional, a.usageNote,
      a.sourceType, a.verificationStatus, a.verificationNotes, a.lastVerifiedAt ?? null,
      JSON.stringify(a.claimsSupported), JSON.stringify(a.learningObjectives),
      JSON.stringify(a.relatedEvidenceRefs), JSON.stringify(a.suggestedConversations),
      JSON.stringify(a.depthContent ?? {}),
    ]
  );
}

async function upsertDisagreement(
  caseId: string,
  d: DisagreementPackEntry,
  specialistIds: Map<string, string>,
): Promise<void> {
  const a = specialistIds.get(d.specialistAKey);
  const b = specialistIds.get(d.specialistBKey);
  if (!a || !b) throw new Error(`Missing specialist for disagreement ${d.key}`);
  await query(
    `INSERT INTO knowledge_disagreements
       (disagreement_key, case_id, topic, specialist_a_id, specialist_b_id, position_a,
        position_b, disciplinary_basis, uncertainty_note, distinguishing_evidence, related_artifact_keys)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (disagreement_key) DO UPDATE SET
        topic = EXCLUDED.topic, specialist_a_id = EXCLUDED.specialist_a_id,
        specialist_b_id = EXCLUDED.specialist_b_id, position_a = EXCLUDED.position_a,
        position_b = EXCLUDED.position_b, disciplinary_basis = EXCLUDED.disciplinary_basis,
        uncertainty_note = EXCLUDED.uncertainty_note,
        distinguishing_evidence = EXCLUDED.distinguishing_evidence,
        related_artifact_keys = EXCLUDED.related_artifact_keys, updated_at = NOW()`,
    [
      d.key, caseId, d.topic, a, b, d.positionA, d.positionB, d.disciplinaryBasis,
      d.uncertaintyNote, d.distinguishingEvidence, JSON.stringify(d.relatedArtifactKeys),
    ]
  );
}

async function main(): Promise<void> {
  console.log('M3 knowledge pack seed (idempotent)\n');
  await applyMigrations();

  let totalSpecialists = 0;
  let totalArtifacts = 0;
  let totalDisagreements = 0;
  for (const pack of KNOWLEDGE_PACKS) {
    const caseId = await resolveCaseId(pack);
    if (!caseId) {
      console.warn(`  ! case "${pack.caseTitle}" not found - skipping pack ${pack.key}`);
      continue;
    }
    console.log(`  pack: ${pack.key} (${pack.version}) -> ${pack.caseTitle}`);
    await upsertPack(pack, caseId);

    const specialistIds = new Map<string, string>();
    for (const s of pack.specialists) {
      specialistIds.set(s.key, await upsertSpecialist(s));
      await attachSpecialist(caseId, specialistIds.get(s.key) as string, s);
    }
    for (const a of pack.artifacts) await upsertArtifact(caseId, a, specialistIds);
    for (const d of pack.disagreements) await upsertDisagreement(caseId, d, specialistIds);

    totalSpecialists += pack.specialists.length;
    totalArtifacts += pack.artifacts.length;
    totalDisagreements += pack.disagreements.length;
    console.log(`    specialists: ${pack.specialists.length}, artifacts: ${pack.artifacts.length}, disagreements: ${pack.disagreements.length}`);
  }

  console.log(`\nTotals: ${totalSpecialists} specialists, ${totalArtifacts} artifacts, ${totalDisagreements} disagreements`);
  console.log('KNOWLEDGE SEED: PASS');
}

main()
  .catch((err: Error) => {
    console.error('KNOWLEDGE SEED: FAIL');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
