// M5: bounded specialist context built from SAFE perspective DTOs.
// ---------------------------------------------------------------------------
// No db/server/canonical imports. This module never asserts that an experience
// describes what actually happened in a case. Every block is explicitly
// labelled as an educational lens, an illustrative example or a question to
// consider. The output is bounded for the shared chat model.

import {
  PERSPECTIVE_LIMITS,
  asStringArray,
  asRecord,
  clip,
  type AnyRow,
} from './types';

/** Plain-language epistemic labels used when a detail DTO carries a breakdown.
 *  The labels keep established knowledge, interpretation, contested argument,
 *  tradition belief and personal reflection visibly distinct. */
function epistemicLabel(key: string): string {
  const k = key.toLowerCase();
  if (k.includes('established')) return 'ESTABLISHED KNOWLEDGE';
  if (k.includes('contested')) return 'CONTESTED ARGUMENT';
  if (k.includes('interpret')) return 'INTERPRETATION';
  if (k.includes('tradition') || k.includes('religious') || k.includes('belief')) return 'TRADITION PERSPECTIVE';
  if (k.includes('personal') || k.includes('reflection')) return 'PERSONAL PERSPECTIVE';
  return 'EPISTEMIC NOTE';
}

function epistemicLines(value: unknown): string[] {
  const entries = Object.entries(asRecord(value)).slice(0, 3);
  return entries.map(([key, text]) => `[${epistemicLabel(key)}] ${clip(key, 60)}: ${clip(text, 220)}`);
}

export interface PerspectiveSpecialistContextParams {
  /** Already projected through toPublicFramework. */
  framework?: AnyRow | undefined;
  /** Already projected through toPublicExperienceSummary/Detail. */
  experiences?: AnyRow[] | undefined;
  /** Player reflections, already projected through toPublicReflection. */
  reflections?: AnyRow[] | undefined;
  /** Specialist's discipline, used only to phrase the invitation. */
  discipline?: string | undefined;
}

/**
 * Build a short, explicitly-labelled context block. All epistemic status is
 * surfaced as a label; the model is told these are lenses, not findings.
 */
export function buildPerspectiveSpecialistContext(params: PerspectiveSpecialistContextParams): string {
  const lines: string[] = [];
  lines.push(
    'PERSPECTIVE LENSES (educational material, NOT case findings): Use these only to offer a way of thinking or a question to consider. ' +
    'Never present an illustration, parable or historical analogy as evidence about this case. ' +
    'Never reveal or imply a canonical solution, a person’s responsibility, a hidden location or unreleased material. ' +
    'Keep the epistemic labels distinct: established knowledge is not the same as interpretation, contested argument, a tradition’s perspective, or a personal reflection.',
  );

  if (params.discipline) {
    lines.push(`SPECIALIST DISCIPLINE: ${clip(params.discipline, 120)}`);
  }

  const framework = params.framework;
  if (framework) {
    lines.push(
      `[FRAMEWORK] ${clip(framework.name, PERSPECTIVE_LIMITS.maxFrameworkNameChars)} ` +
      `(${clip(framework.intellectualDomain, 120)}) — ${clip(framework.summary, 360)}`,
    );
    const questions = asStringArray(framework.coreQuestions).slice(0, 3);
    if (questions.length > 0) {
      lines.push(`[CORE QUESTIONS — prompts for thought, not conclusions] ${questions.map((q) => clip(q, 160)).join(' | ')}`);
    }
    const differences = asStringArray(framework.internalDifferences).slice(0, 2);
    if (differences.length > 0) {
      lines.push(`[INTERNAL DEBATE — this lens is contested] ${differences.map((d) => clip(d, 160)).join(' | ')}`);
    }
    const limits = asStringArray(framework.limitations).slice(0, 2);
    if (limits.length > 0) {
      lines.push(`[LIMITS OF THIS LENS] ${limits.map((l) => clip(l, 160)).join(' | ')}`);
    }
  }

  const experiences = Array.isArray(params.experiences) ? params.experiences.slice(0, PERSPECTIVE_LIMITS.maxContextExperiences) : [];
  experiences.forEach((raw, index) => {
    const title = clip(raw.title, PERSPECTIVE_LIMITS.maxExperienceTitleChars);
    const purpose = clip(raw.intellectualPurpose, 220);
    const question = clip(raw.primaryQuestion, 180);
    const status = clip(raw.knowledgeClass, 40);
    const sourceCount = Array.isArray(raw.supportingSources) ? raw.supportingSources.length : 0;
    lines.push(
      `[ILLUSTRATIVE EXPERIENCE ${index + 1} — teaching example, not a case fact] ${title} ` +
      `(epistemic class: ${status}; ${clip(raw.format, 40)}; sources listed: ${sourceCount}) — ${purpose} Question: ${question}`,
    );
    for (const line of epistemicLines(raw.epistemicBreakdown)) {
      lines.push(`  ${line}`);
    }
  });

  const reflections = Array.isArray(params.reflections) ? params.reflections.slice(0, 3) : [];
  if (reflections.length > 0) {
    const samples = reflections.map((r) => `${clip(r.reflectionKind, 40)}: ${clip(r.response, 180)}`);
    lines.push(`[PERSONAL PERSPECTIVE — player reflections, unconfirmed; treat as the player's own thinking] ${samples.join(' | ')}`);
  }

  lines.push(
    'REPLY RULE: Stay within the evidence already visible in the case. If you use a lens, say what it would prompt you to check rather than what it concludes.',
  );

  let context = lines.join('\n');
  if (context.length > PERSPECTIVE_LIMITS.maxContextChars) {
    context = `${context.slice(0, PERSPECTIVE_LIMITS.maxContextChars - 64)}…\n[perspective context truncated for length]`;
  }
  return context;
}
