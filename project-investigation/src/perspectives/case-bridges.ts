// M5: case <-> perspective bridges (pure, advisory).
// ---------------------------------------------------------------------------
// Maps a case title or genre to the lenses that pair well with it. These are
// pedagogical hints only: they never reference an answer to a case, a hidden
// detail, or a record identifier. No database and no canonical reads.
//
// Framework keys are the seven specified for M5. Genre keywords are matched
// case-insensitively as substrings of the case's genre string.

import type { PerspectiveBridge, SuggestionReasonCode } from './types';

export const GENRE_BRIDGES: PerspectiveBridge[] = [
  {
    bridgeKey: 'genre_mystery',
    genre: 'mystery',
    frameworkKeys: ['philosophical_reasoning', 'historical_interpretation', 'psychological_reasoning'],
    reasonCodes: ['matches_case_genre', 'broadens_perspective'],
    note: 'A mystery rewards separating observation from inference and comparing independent accounts.',
  },
  {
    bridgeKey: 'genre_crime',
    genre: 'crime',
    frameworkKeys: ['philosophical_reasoning', 'scientific_reasoning', 'psychological_reasoning'],
    reasonCodes: ['matches_case_genre'],
    note: 'Crime cases benefit from standards-of-proof thinking and attention to how traces are collected.',
  },
  {
    bridgeKey: 'genre_detective',
    genre: 'detective',
    frameworkKeys: ['philosophical_reasoning', 'historical_interpretation', 'psychological_reasoning'],
    reasonCodes: ['matches_case_genre'],
    note: 'Detective work combines disciplined doubt with careful source and standpoint analysis.',
  },
  {
    bridgeKey: 'genre_medical',
    genre: 'medical',
    frameworkKeys: ['scientific_reasoning', 'ethical_reasoning', 'psychological_reasoning'],
    reasonCodes: ['matches_case_genre'],
    note: 'Clinical questions join differential reasoning with ethical and human-factors considerations.',
  },
  {
    bridgeKey: 'genre_heist',
    genre: 'heist',
    frameworkKeys: ['sociological_reasoning', 'psychological_reasoning', 'historical_interpretation'],
    reasonCodes: ['matches_case_genre', 'broadens_perspective'],
    note: 'A heist can be read through incentives, the framing of competing accounts and record provenance.',
  },
  {
    bridgeKey: 'genre_theft',
    genre: 'theft',
    frameworkKeys: ['historical_interpretation', 'philosophical_reasoning', 'sociological_reasoning'],
    reasonCodes: ['matches_case_genre'],
    note: 'Questions of custody and substitution invite clarity about identity criteria and documentation.',
  },
  {
    bridgeKey: 'genre_arson',
    genre: 'arson',
    frameworkKeys: ['scientific_reasoning', 'historical_interpretation', 'sociological_reasoning'],
    reasonCodes: ['matches_case_genre'],
    note: 'Fire cases combine method limits, provenance of records and incentive analysis.',
  },
  {
    bridgeKey: 'genre_sabotage',
    genre: 'sabotage',
    frameworkKeys: ['scientific_reasoning', 'sociological_reasoning', 'historical_interpretation'],
    reasonCodes: ['matches_case_genre', 'broadens_perspective'],
    note: 'Sabotage scenarios reward checking mechanisms and pressures rather than assuming a single motive.',
  },
  {
    bridgeKey: 'genre_missing',
    genre: 'missing',
    frameworkKeys: ['psychological_reasoning', 'sociological_reasoning', 'historical_interpretation'],
    reasonCodes: ['matches_case_genre'],
    note: 'Missing-person accounts benefit from memory caution and attention to social framing.',
  },
  {
    bridgeKey: 'genre_historical',
    genre: 'historical',
    frameworkKeys: ['historical_interpretation', 'ethical_reasoning'],
    reasonCodes: ['matches_case_genre'],
    note: 'Historical settings call for source criticism and sensitivity to period context.',
  },
  {
    bridgeKey: 'genre_philosophical',
    genre: 'philosophical',
    frameworkKeys: ['philosophical_reasoning', 'scientific_reasoning', 'ethical_reasoning'],
    reasonCodes: ['matches_case_genre'],
    note: 'Philosophical cases invite explicit reasoning about values, concepts and assumptions.',
  },
];

/** Hand-tuned bridges for M3 showcase cases (title, not identifier). */
export const CASE_BRIDGES: PerspectiveBridge[] = [
  {
    bridgeKey: 'case_midnight_heist',
    caseTitle: 'The Midnight Heist',
    frameworkKeys: ['historical_interpretation', 'sociological_reasoning', 'philosophical_reasoning'],
    reasonCodes: ['matches_case_genre', 'broadens_perspective'],
    note: 'A heist can be read through competing records, incentive structures and the criteria used to compare accounts.',
  },
  {
    bridgeKey: 'case_code_blue',
    caseTitle: 'Code Blue at the Clinic',
    frameworkKeys: ['scientific_reasoning', 'ethical_reasoning', 'psychological_reasoning'],
    reasonCodes: ['matches_case_genre'],
    note: 'Clinical decisions combine differential reasoning, ethical reflection and human factors.',
  },
  {
    bridgeKey: 'case_blaze_dawn',
    caseTitle: 'Blaze at Dawn Bakery',
    frameworkKeys: ['historical_interpretation', 'scientific_reasoning', 'sociological_reasoning'],
    reasonCodes: ['matches_case_genre'],
    note: 'A small-business dispute benefits from provenance, method limits and incentive analysis.',
  },
];

function normalized(value: string | undefined): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

/** Bridges matching a title (substring, case-insensitive). */
export function bridgesForCase(caseTitle: string): PerspectiveBridge[] {
  const needle = normalized(caseTitle);
  if (needle.length === 0) return [];
  return CASE_BRIDGES.filter((b) => b.caseTitle !== undefined && normalized(b.caseTitle).includes(needle));
}

/** Bridges matching a genre string (substring, case-insensitive). */
export function bridgesForGenre(genre: string): PerspectiveBridge[] {
  const needle = normalized(genre);
  if (needle.length === 0) return [];
  return GENRE_BRIDGES.filter((b) => b.genre !== undefined && needle.includes(normalized(b.genre)));
}

/** All framework keys relevant to a case context, de-duplicated, order stable. */
export function frameworkKeysForContext(caseTitle?: string, genre?: string): string[] {
  const seen = new Set<string>();
  const collect = (bridges: PerspectiveBridge[]): void => {
    for (const bridge of bridges) {
      for (const key of bridge.frameworkKeys) seen.add(key);
    }
  };
  collect(bridgesForCase(caseTitle ?? ''));
  collect(bridgesForGenre(genre ?? ''));
  return [...seen];
}

/** Reason codes relevant to a case context, de-duplicated, order stable. */
export function reasonCodesForContext(caseTitle?: string, genre?: string): SuggestionReasonCode[] {
  const seen = new Set<SuggestionReasonCode>();
  const collect = (bridges: PerspectiveBridge[]): void => {
    for (const bridge of bridges) {
      for (const code of bridge.reasonCodes) seen.add(code);
    }
  };
  collect(bridgesForCase(caseTitle ?? ''));
  collect(bridgesForGenre(genre ?? ''));
  return [...seen];
}
