import { describe, it, expect } from 'vitest';
import { CASES, getCase, listCaseSummaries, toBriefing } from '../src/server/cases/index.js';

describe('case definitions', () => {
  it('provides three distinct cases with 4-5 participants and multiple outcomes', () => {
    expect(CASES.map((c) => c.id)).toEqual(['acquisition', 'fragile-peace', 'walkout']);
    expect(listCaseSummaries()).toHaveLength(3);
    for (const c of CASES) {
      expect(c.participants.length).toBeGreaterThanOrEqual(4);
      expect(c.participants.length).toBeLessThanOrEqual(5);
      expect(c.participants.filter((p) => c.participantPrivate[p.id]?.requiredForAgreement).length)
        .toBeGreaterThanOrEqual(2);
      expect(c.issues.length).toBeGreaterThanOrEqual(4);
      expect(c.issues.filter((i) => i.required).length).toBeGreaterThanOrEqual(2);
      expect(c.issues.some((i) => !i.required)).toBe(true);
      expect(c.outcomeDefinitions.length).toBeGreaterThanOrEqual(3);
      expect(c.outcomeDefinitions.some((o) => o.walkAway)).toBe(true);
      expect(c.hiddenReveals.length).toBeGreaterThanOrEqual(3);
      expect(getCase(c.id)).toBe(c);
      const ids = c.participants.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(c.participantPrivate[id]).toBeDefined();
    }
  });

  it('uses internally consistent reservation ranges (a viable ZOPA per issue)', () => {
    for (const c of CASES) {
      for (const issue of c.issues) {
        expect(issue.minValue).toBeLessThanOrEqual(issue.maxValue);
        expect(issue.weight).toBeGreaterThan(0);
        for (const value of [issue.playerIdeal, issue.opposingIdeal, issue.playerReservation, issue.opposingReservation]) {
          expect(value).toBeGreaterThanOrEqual(issue.minValue);
          expect(value).toBeLessThanOrEqual(issue.maxValue);
        }
        if (issue.direction === 'maximize') {
          expect(issue.playerReservation).toBeLessThanOrEqual(issue.opposingReservation);
        } else {
          expect(issue.opposingReservation).toBeLessThanOrEqual(issue.playerReservation);
        }
      }
    }
  });

  it('never exposes participant secrets or hidden cut-offs in the briefing DTO', () => {
    for (const c of CASES) {
      const json = JSON.stringify(toBriefing(c));
      for (const p of Object.values(c.participantPrivate)) {
        for (const secret of p.secrets) expect(json).not.toContain(secret);
      }
      for (const reveal of c.hiddenReveals) expect(json).not.toContain(reveal.reveal);
      for (const banned of ['opposingReservation', 'playerReservation', 'opposingIdeal', 'outcomeDefinitions', 'hiddenReveals', 'participantPrivate']) {
        expect(json).not.toContain(banned);
      }
    }
  });
});
