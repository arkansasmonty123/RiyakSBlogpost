/**
 * M8-W7: user data export and account deletion.
 *
 * Both functions are scoped to ONE authenticated user id (always derived from
 * the session by the caller, never from the request body). The export is an
 * explicit allowlist of the player's own data: no password hash, no session
 * tokens, no server evaluation internals, and - critically - no canonical
 * truth, hidden evidence or solution reveal data. Shared case content (cases,
 * evidence, characters, authored knowledge packs, frameworks, event/discovery
 * packages) is never exported or deleted.
 */

import { query, withTransaction } from './db';

export const ACCOUNT_EXPORT_FORMAT_VERSION = 1;

function iso(value: unknown): string | null {
  return value instanceof Date || typeof value === 'string'
    ? new Date(value).toISOString()
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function idOf(value: unknown): string {
  return value == null ? '' : String(value);
}

/** Project message_history JSON to a bounded, player-authored shape. */
function projectMessages(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 500).map((message: any) => {
    const out: Record<string, unknown> = {
      role: text(message?.role),
      content: text(message?.content),
    };
    const timestamp = iso(message?.timestamp);
    if (timestamp) out.timestamp = timestamp;
    // Optional specialist responder metadata is safe and player-facing.
    for (const key of ['specialistKey', 'specialistName', 'intent', 'depth', 'responderLabel'] as const) {
      if (message?.[key] != null) out[key] = text(message[key]);
    }
    return out;
  });
}

/**
 * Tables holding investigation-scoped rows. No FK to `users` exists for most of
 * these, so they must be removed explicitly before deleting the parent row.
 */
const INVESTIGATION_SCOPED_TABLES = [
  'accusations',
  'case_achievements',
  'conversations',
  'deduction_checkpoints',
  'development_log',
  'evidence_discoveries',
  'investigation_actions',
  'investigation_events',
  'investigation_flags',
  'investigation_state',
  'journal_entries',
  'notebook_entries',
  'scheduled_events',
  'investigation_claims',
  'investigation_hypotheses',
  'reality_map_links',
  'perspective_reflections',
  'perspective_suggestion_state',
  'investigation_discovery_clue_states',
  'discovery_submissions',
  'knowledge_memory_cases',
  'investigation_discovery_unlocks',
  'knowledge_recall_events',
  'notifications',
] as const;

/** Tables keyed directly by user_id (including the FK-cascaded sessions table). */
const USER_SCOPED_TABLES = [
  'sessions',
  'user_onboarding',
  'knowledge_memory_items',
  'knowledge_memory_links',
  'notifications',
  'perspective_reflections',
  'perspective_suggestion_state',
  'notebook_entries',
  'investigation_claims',
  'investigation_hypotheses',
  'reality_map_links',
  'investigation_discovery_clue_states',
  'discovery_submissions',
  'knowledge_memory_cases',
  'investigation_discovery_unlocks',
  'knowledge_recall_events',
] as const;

export interface AccountExport {
  exportedAt: string;
  formatVersion: number;
  notice: string;
  profile: Record<string, unknown>;
  onboarding: Record<string, unknown> | null;
  investigations: Array<Record<string, unknown>>;
  notebook: Array<Record<string, unknown>>;
  knowledge: {
    memoryItems: Array<Record<string, unknown>>;
    recallEvents: Array<Record<string, unknown>>;
    discoverySubmissions: Array<Record<string, unknown>>;
    perspectiveReflections: Array<Record<string, unknown>>;
  };
  notifications: Array<Record<string, unknown>>;
}

/**
 * Build a portable JSON export of everything the signed-in player owns.
 * `userId` must come from the session. Every SELECT names its columns; a future
 * added private column cannot silently appear in the export.
 */
export async function buildAccountExport(userId: string): Promise<AccountExport> {
  const profileResult = await query(
    `SELECT id::text AS id, email, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE id = $1`,
    [userId]
  );
  const profileRow = profileResult.rows[0];
  if (!profileRow) {
    throw new Error('Account not found');
  }

  const [
    onboardingResult,
    investigationsResult,
    notebookResult,
    memoryResult,
    recallResult,
    submissionsResult,
    reflectionsResult,
    notificationsResult,
  ] = await Promise.all([
    query(
      `SELECT welcome_seen AS "welcomeSeen", intro_completed AS "introCompleted",
              tutorial_state AS "tutorialState", skipped, last_step AS "lastStep",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM user_onboarding WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT i.id::text AS id, i.case_id::text AS "caseId", c.title AS "caseTitle",
              i.status, i.current_stage AS "currentStage", i.progress,
              i.start_timestamp AS "startedAt", i.completion_timestamp AS "completedAt",
              i.created_at AS "createdAt", i.updated_at AS "updatedAt"
       FROM investigations i LEFT JOIN cases c ON c.id = i.case_id
       WHERE i.user_id = $1 ORDER BY i.created_at DESC LIMIT 200`,
      [userId]
    ),
    query(
      `SELECT id::text AS id, investigation_id::text AS "investigationId",
              entry_type AS "entryType", concept, title, content,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM notebook_entries WHERE user_id = $1 ORDER BY created_at ASC LIMIT 500`,
      [userId]
    ),
    query(
      `SELECT subject_key AS "subjectKey", subject_label AS "subjectLabel",
              reference_category AS "referenceCategory", knowledge_status AS "knowledgeStatus",
              mastery_status AS "masteryStatus", successful_recalls AS "successfulRecalls",
              failed_recalls AS "failedRecalls", corrected_understanding AS "correctedUnderstanding",
              latest_explanation AS "latestExplanation", unresolved_questions AS "unresolvedQuestions",
              follow_up_applications AS "followUpApplications", first_case_id::text AS "firstCaseId",
              first_discovered_at AS "firstDiscoveredAt",
              last_successful_recall_at AS "lastSuccessfulRecallAt", next_due_at AS "nextDueAt",
              created_at AS "createdAt"
       FROM knowledge_memory_items WHERE user_id = $1 ORDER BY subject_key ASC LIMIT 500`,
      [userId]
    ),
    query(
      `SELECT memory_item_id::text AS "memoryItemId", investigation_id::text AS "investigationId",
              recall_kind AS "recallKind", prompt, response, outcome,
              answered_at AS "answeredAt", next_due_at AS "nextDueAt", created_at AS "createdAt"
       FROM knowledge_recall_events WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1000`,
      [userId]
    ),
    query(
      `SELECT investigation_id::text AS "investigationId", clue_key AS "clueKey",
              explanation, subject_identification AS "subjectIdentification",
              connection_explanation AS "connectionExplanation", uncertainty, confidence,
              accepted, created_at AS "createdAt"
       FROM discovery_submissions WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1000`,
      [userId]
    ),
    query(
      `SELECT experience_key AS "experienceKey", investigation_id::text AS "investigationId",
              prompt, reflection_kind AS "reflectionKind", response, created_at AS "createdAt"
       FROM perspective_reflections WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1000`,
      [userId]
    ),
    query(
      `SELECT id::text AS id, category, priority, title, body, status,
              created_at AS "createdAt", read_at AS "readAt"
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500`,
      [userId]
    ),
  ]);

  const investigations: Array<Record<string, unknown>> = [];
  for (const inv of investigationsResult.rows) {
    const invId = inv.id;
    // Player-authored verdict submissions only. `evaluation_result` is
    // deliberately NOT selected: it is server evaluation data.
    const [
      evidenceResult,
      accusationResult,
      achievementResult,
      checkpointResult,
      journalResult,
      conversationResult,
      claimsResult,
      hypothesesResult,
      linksResult,
      clueStatesResult,
      unlocksResult,
    ] = await Promise.all([
      query(
        `SELECT ed.evidence_id::text AS "evidenceId", e.source AS source, e.category AS category,
                ed.trigger, ed.discovered_at AS "discoveredAt"
         FROM evidence_discoveries ed LEFT JOIN evidence e ON e.id = ed.evidence_id
         WHERE ed.investigation_id = $1 ORDER BY ed.discovered_at ASC`,
        [invId]
      ),
      query(
        `SELECT submitted_culprit AS "submittedCulprit", motive, method,
                supporting_evidence AS "supportingEvidence",
                submission_timestamp AS "submittedAt"
         FROM accusations WHERE investigation_id = $1 ORDER BY submission_timestamp DESC`,
        [invId]
      ),
      query(
        `SELECT achievement_type AS type, unlocked_at AS "unlockedAt"
         FROM case_achievements WHERE investigation_id = $1 ORDER BY unlocked_at ASC`,
        [invId]
      ),
      query(
        `SELECT checkpoint_id AS "checkpointId", submitted_theory AS "submittedTheory",
                result, created_at AS "createdAt"
         FROM deduction_checkpoints WHERE investigation_id = $1 ORDER BY created_at ASC`,
        [invId]
      ),
      query(
        `SELECT id::text AS id, entry_type AS "entryType", content,
                related_evidence_ids AS "relatedEvidenceIds", is_confirmed AS "isConfirmed",
                creation_timestamp AS "createdAt"
         FROM journal_entries WHERE investigation_id = $1 ORDER BY creation_timestamp ASC`,
        [invId]
      ),
      query(
        `SELECT summary, message_history AS "messageHistory",
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM conversations WHERE investigation_id = $1`,
        [invId]
      ),
      query(
        `SELECT id::text AS id, title, description, claim_category AS "claimCategory",
                confidence, notes, created_at AS "createdAt"
         FROM investigation_claims WHERE investigation_id = $1 ORDER BY created_at ASC`,
        [invId]
      ),
      query(
        `SELECT id::text AS id, name, explanation, status, confidence,
                missing_information AS "missingInformation",
                alternative_explanations AS "alternativeExplanations",
                player_notes AS "playerNotes", created_at AS "createdAt"
         FROM investigation_hypotheses WHERE investigation_id = $1 ORDER BY created_at ASC`,
        [invId]
      ),
      query(
        `SELECT owner_type AS "ownerType", owner_id::text AS "ownerId",
                target_type AS "targetType", target_id::text AS "targetId",
                relationship, rationale, created_at AS "createdAt"
         FROM reality_map_links WHERE investigation_id = $1 ORDER BY created_at ASC`,
        [invId]
      ),
      query(
        `SELECT clue_key AS "clueKey", state, attempt_count AS "attemptCount",
                accepted_at AS "acceptedAt", created_at AS "createdAt"
         FROM investigation_discovery_clue_states WHERE investigation_id = $1 ORDER BY created_at ASC`,
        [invId]
      ),
      query(
        `SELECT clue_key AS "clueKey", unlock_key AS "unlockKey", kind,
                applied_at AS "appliedAt", created_at AS "createdAt"
         FROM investigation_discovery_unlocks WHERE investigation_id = $1 ORDER BY created_at ASC`,
        [invId]
      ),
    ]);

    const conversationRow = conversationResult.rows[0];
    investigations.push({
      ...inv,
      discoveredEvidence: evidenceResult.rows,
      verdictSubmissions: accusationResult.rows,
      achievements: achievementResult.rows,
      deductions: checkpointResult.rows,
      journal: journalResult.rows,
      conversation: conversationRow
        ? {
            summary: text(conversationRow.summary),
            messages: projectMessages(conversationRow.messageHistory),
            createdAt: iso(conversationRow.createdAt),
            updatedAt: iso(conversationRow.updatedAt),
          }
        : null,
      realityMap: {
        claims: claimsResult.rows,
        hypotheses: hypothesesResult.rows,
        links: linksResult.rows,
      },
      discovery: {
        clueStates: clueStatesResult.rows,
        unlocks: unlocksResult.rows,
      },
    });
  }

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: ACCOUNT_EXPORT_FORMAT_VERSION,
    notice: 'This export contains only your own player data. Shared case content, hidden evidence and solutions are not included.',
    profile: {
      id: idOf(profileRow.id),
      email: text(profileRow.email),
      createdAt: iso(profileRow.createdAt),
      updatedAt: iso(profileRow.updatedAt),
    },
    onboarding: onboardingResult.rows[0]
      ? {
          welcomeSeen: !!onboardingResult.rows[0].welcomeSeen,
          introCompleted: !!onboardingResult.rows[0].introCompleted,
          tutorialState: onboardingResult.rows[0].tutorialState ?? {},
          skipped: !!onboardingResult.rows[0].skipped,
          lastStep: onboardingResult.rows[0].lastStep ?? null,
          createdAt: iso(onboardingResult.rows[0].createdAt),
          updatedAt: iso(onboardingResult.rows[0].updatedAt),
        }
      : null,
    investigations,
    notebook: notebookResult.rows,
    knowledge: {
      memoryItems: memoryResult.rows,
      recallEvents: recallResult.rows,
      discoverySubmissions: submissionsResult.rows,
      perspectiveReflections: reflectionsResult.rows,
    },
    notifications: notificationsResult.rows,
  };
}

/**
 * Delete a user's personal data irreversibly. Runs in one transaction; the
 * caller must have verified explicit confirmation and session ownership.
 * Shared case content is never touched.
 */
export async function deleteAccountData(userId: string): Promise<{ deleted: boolean }> {
  return withTransaction(async (client) => {
    const invResult = await client.query(
      'SELECT id::text AS id FROM investigations WHERE user_id = $1',
      [userId]
    );
    const investigationIds: string[] = invResult.rows.map((row: any) => String(row.id));

    if (investigationIds.length > 0) {
      for (const table of INVESTIGATION_SCOPED_TABLES) {
        await client.query(
          `DELETE FROM ${table} WHERE investigation_id = ANY($1::uuid[])`,
          [investigationIds]
        );
      }
    }
    for (const table of USER_SCOPED_TABLES) {
      await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
    }
    await client.query('DELETE FROM investigations WHERE user_id = $1', [userId]);
    const result = await client.query('DELETE FROM users WHERE id = $1', [userId]);
    return { deleted: (result.rowCount ?? 0) > 0 };
  });
}
