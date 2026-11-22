// =============================================================================
// DEPRECATED / NON-CANONICAL — PROD-004 (BUG-003)
// -----------------------------------------------------------------------------
// DO NOT use this file to generate migrations or push schema changes.
// It is camelCase and drifted from the live snake_case PostgreSQL schema.
// The runtime uses raw SQL in src/db.ts; the canonical schema is:
//   migrations/000_baseline.sql + migrations/001..003_*.sql
// Verify the real schema with: npm run db:schema:verify
// See PROD-004-NOTES.md and drizzle/DEPRECATED.md for the full policy.
// This file is kept for historical reference only and is not imported at runtime.
// =============================================================================
import { pgTable, text, serial, integer, boolean, json, uuid, timestamp } from 'drizzle-orm/pg-core';

// === Core Entities ===

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  passwordHash: text('passwordHash'),
  preferences: json('preferences'),
  notificationSettings: json('notificationSettings'),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});

export const cases = pgTable('cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  genre: text('genre'),
  difficulty: text('difficulty'),
  duration: text('duration'),
  publicationStatus: text('publicationStatus'),
  caseVersion: text('caseVersion').default('1.0'),
  canonicalPackageReference: text('canonicalPackageReference'),
  briefing: text('briefing').notNull(),
  initialCharacters: json('initialCharacters'),
  initialFacts: json('initialFacts'),
  objectives: text('objectives').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});

// Canonical truth is PRIVATE server-side data. The live DB uses snake_case
// columns (BUG-003 schema drift); this definition documents the enriched
// PROD-007 shape. Never expose these fields through a client API projection.
export const canonicalTruth = pgTable('canonical_truth', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().unique(),
  culprit: text('culprit').notNull(),
  motive: text('motive').notNull(),
  method: text('method').notNull(),
  timeline: json('timeline').$defaultFn(() => []),
  hiddenEvents: json('hidden_events').$defaultFn(() => []),
  solutionExplanation: text('solution_explanation'),
  redHerrings: json('red_herrings').$defaultFn(() => []),
  alternativeTheories: json('alternative_theories').$defaultFn(() => []),
  clueResolutions: json('clue_resolutions').$defaultFn(() => ({})),
  actualTimeline: json('actual_timeline').$defaultFn(() => []),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('caseId').notNull(),
  name: text('name').notNull(),
  role: text('role'),
  personality: text('personality'),
  background: text('background'),
  motive: text('motive'),
  knowledge: json('knowledge'),
  beliefs: json('beliefs'),
  secrets: json('secrets'),
  dialogueConstraints: text('dialogueConstraints'),
  alibi: text('alibi'),
  confirmedAlibi: text('confirmedAlibi'),
  relationships: json('relationships'),
});

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('caseId').notNull(),
  category: text('category'),
  source: text('source'),
  description: text('description').notNull(),
  hiddenInterpretation: text('hiddenInterpretation'),
  discoveryConditions: json('discoveryConditions'),
  releaseConditions: json('releaseConditions'),
  timelineReference: text('timelineReference'),
  reliability: text('reliability'),
  associatedCharacters: text('associatedCharacters'),
  supportedHypotheses: json('supportedHypotheses'),
  contradictedHypotheses: json('contradictedHypotheses'),
  playerVisible: boolean('playerVisible').default(true),
  discoveryOrder: integer('discoveryOrder'),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});

export const investigations = pgTable('investigations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId').notNull(),
  caseId: uuid('caseId').notNull(),
  status: text('status'),
  startTimestamp: timestamp('startTimestamp').defaultNow(),
  currentStage: text('currentStage'),
  progress: integer('progress'),
  completionTimestamp: timestamp('completionTimestamp'),
  currentTheory: text('currentTheory'),
  suspicionLevel: text('suspicionLevel'),
  discoveredEvidenceIds: uuid('discoveredEvidenceIds').array().default([]),
  pendingEvents: json('pendingEvents'),
  theoryHistory: json('theoryHistory'),
});

export const investigationState = pgTable('investigation_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  investigationId: uuid('investigationId').notNull().unique(),
  discoveredEvidenceIds: uuid('discoveredEvidenceIds').array().default([]),
  currentTheories: json('currentTheories'),
  suspicionLevels: json('suspicionLevels'),
  completedCheckpoints: text('completedCheckpoints').array().default([]),
  pendingEvents: json('pendingEvents'),
  investigationStage: text('investigationStage'),
  lastUpdated: timestamp('lastUpdated').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  investigationId: uuid('investigationId').notNull(),
  participants: text('participants').array(),
  messageHistory: json('messageHistory'),
  summary: text('summary'),
  contextReferences: json('contextReferences'),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  investigationId: uuid('investigationId').notNull(),
  entryType: text('entryType'),
  content: text('content').notNull(),
  relatedEvidenceIds: uuid('relatedEvidenceIds').array().default([]),
  isConfirmed: boolean('isConfirmed').default(false),
  creationTimestamp: timestamp('creationTimestamp').defaultNow(),
});

export const scheduledEvents = pgTable('scheduled_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  investigationId: uuid('investigationId').notNull(),
  eventType: text('eventType'),
  triggerCondition: json('triggerCondition'),
  scheduledTimestamp: timestamp('scheduledTimestamp'),
  releaseStatus: text('releaseStatus'),
  associatedEvidence: uuid('associatedEvidence'),
  narrativePayload: json('narrativePayload'),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});

export const accusations = pgTable('accusations', {
  id: uuid('id').primaryKey().defaultRandom(),
  investigationId: uuid('investigationId').notNull(),
  submittedCulprit: text('submittedCulprit').notNull(),
  motive: text('motive').notNull(),
  method: text('method').notNull(),
  supportingEvidence: uuid('supportingEvidence').array().default([]),
  evaluationResult: text('evaluationResult'),
  submissionTimestamp: timestamp('submissionTimestamp').defaultNow(),
  resolvedAt: timestamp('resolvedAt'),
});

export const weeklyCollections = pgTable('weekly_collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  releaseDate: timestamp('releaseDate'),
  includedCaseIds: uuid('includedCaseIds').array().default([]),
  featuredCaseId: uuid('featuredCaseId'),
  publicationStatus: text('publicationStatus'),
  createdAt: timestamp('createdAt').defaultNow(),
});

export const caseAchievements = pgTable('case_achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  investigationId: uuid('investigationId').notNull(),
  achievementType: text('achievementType'),
  unlockedAt: timestamp('unlockedAt').defaultNow(),
});