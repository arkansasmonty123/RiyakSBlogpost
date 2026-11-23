import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';
import { createInitialSave } from '@/domain/seed';
import type { SaveGame } from '@/domain/types';
import { SAVE_KEY } from '@/storage/save';

/** Render the real tree against a given save using a minimal localStorage stub. */
function renderWithSave(save: SaveGame, initialPanel?: 'assignments'): string {
  const data: Record<string, string> = { [SAVE_KEY]: JSON.stringify(save) };
  const globals = globalThis as Record<string, unknown>;
  const previousWindow = globals.window;
  globals.window = {
    localStorage: {
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
      removeItem: (key: string) => {
        delete data[key];
      },
    },
  };
  try {
    return renderToString(initialPanel ? <App initialPanel={initialPanel} /> : <App />).replace(/<!-- -->/g, '');
  } finally {
    globals.window = previousWindow;
  }
}

/**
 * Lightweight UI smoke checks: render the real component tree in Node so a runtime
 * crash or accidental canonical-truth projection fails CI. (No browser binary here.)
 */
describe('App render smoke test', () => {
  // React SSR inserts `<!-- -->` separators between adjacent text nodes.
  const html = renderToString(<App />).replace(/<!-- -->/g, '');
  const researchHtml = renderToString(<App initialPanel="research" />).replace(/<!-- -->/g, '');
  const theoryHtml = renderToString(<App initialPanel="theory" />).replace(/<!-- -->/g, '');
  const caseworkHtml = renderToString(<App initialPanel="casework" />).replace(/<!-- -->/g, '');
  const journalHtml = renderToString(<App initialPanel="journal" />).replace(/<!-- -->/g, '');

  it('renders the prototype shell, day clock and current objective', () => {
    expect(html).toContain('THE BAR');
    expect(html).toContain('Current objective');
    expect(html).toContain('Initial fact matrix');
    expect(html).toContain('Day 1');
    expect(html).toContain('Advance time');
    expect(html).toContain('Senior Chamber');
    expect(html).toContain('Office Reception');
    expect(html).toContain('Entrance');
  });

  it('does not render canonical case truth in the initial HTML', () => {
    const lower = html.toLowerCase();
    for (const forbidden of [
      'canonicaltruth',
      'actualevents',
      'hiddenmotives',
      'evidenceauthenticity',
      'prior dispute',
      '18:12',
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('renders source provenance, verification badges and the Source Intake workflow', () => {
    expect(researchHtml).toContain('Source Intake');
    expect(researchHtml).toContain('Add Source / Source Intake');
    expect(researchHtml).toContain('PLACEHOLDER — NOT AUTHORITATIVE');
    expect(researchHtml).toContain('VERIFIED');
    expect(researchHtml).toContain('Provenance (non-authoritative note)');
    expect(researchHtml).toContain('Warning: not verified. Do not cite this source as law.');
    expect(researchHtml).toContain('NON-AUTHORITATIVE EXCERPT/SUMMARY');
    expect(researchHtml).toContain('Source Intake creates drafts only');
    expect(researchHtml).toContain('Citation / identifier:');
  });

  it('renders an organised, player-legible case theory panel without canonical truth', () => {
    expect(theoryHtml).toContain('Case theory — organise your working file');
    expect(theoryHtml).toContain('aria-label="Case theory claim"');
    expect(theoryHtml).toContain('Link reviewed evidence');
    expect(theoryHtml).toContain('Evidence link summary');
    expect(theoryHtml).toContain('No claims recorded yet.');
    expect(theoryHtml).toContain('A link only records which reviewed items you relied on');
    expect(theoryHtml).toContain('known (0)');
    expect(theoryHtml).toContain('claimed (0)');
    expect(theoryHtml).toContain('disputed (0)');
    const lower = theoryHtml.toLowerCase();
    for (const forbidden of [
      'canonicaltruth',
      'actualevents',
      'hiddenmotives',
      'evidenceauthenticity',
      'prior dispute',
      '18:12',
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('renders a chronological journal of player-visible information only', () => {
    expect(journalHtml).toContain('Case timeline / journal');
    expect(journalHtml).toContain('Current case-file knowledge (undated notes)');
    expect(journalHtml).toContain('An altercation was reported outside a canteen.');
    expect(journalHtml).toContain('aria-label="Case timeline"');
    expect(journalHtml).toContain('Day 1');
    expect(journalHtml).toContain('First day');
    // Events carry a readable title drawn from the player's own memory.
    expect(journalHtml).toContain('Joined the firm as an intern under Adv. Meera Kulkarni');
    expect(journalHtml).toContain('aria-label="Filter journal by kind"');
    const lower = journalHtml.toLowerCase();
    for (const forbidden of [
      'canonicaltruth',
      'actualevents',
      'hiddenmotives',
      'evidenceauthenticity',
      'prior dispute',
      '18:12',
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('renders custody/challenge workflow guidance without canonical truth', () => {
    expect(caseworkHtml).toContain('Working order');
    expect(caseworkHtml).toContain('Relevance addresses whether the item helps prove a fact in issue.');
    expect(caseworkHtml).toContain('Authenticity remains undetermined');
    expect(caseworkHtml).toContain('Neither establishes authenticity');
    const lower = caseworkHtml.toLowerCase();
    for (const forbidden of [
      'canonicaltruth',
      'actualevents',
      'hiddenmotives',
      'evidenceauthenticity',
      'prior dispute',
      '18:12',
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('never presents fabricated provisions or judgments as verified in the research panel', () => {
    const lower = researchHtml.toLowerCase();
    for (const forbidden of ['section 302', 'section 101', 'air 19', ' v. ', 'verified judgment']) {
      expect(lower).not.toContain(forbidden);
    }
    for (const forbidden of [
      'canonicaltruth',
      'actualevents',
      'hiddenmotives',
      'evidenceauthenticity',
      'prior dispute',
      '18:12',
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('renders the second location, its viewpoints and its character hotspots without canonical truth', () => {
    const save = createInitialSave();
    save.selectedViewpoint = 'corridor';
    const data: Record<string, string> = { [SAVE_KEY]: JSON.stringify(save) };
    const globals = globalThis as Record<string, unknown>;
    const previousWindow = globals.window;
    globals.window = {
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => {
          data[key] = value;
        },
        removeItem: (key: string) => {
          delete data[key];
        },
      },
    };
    let corridorHtml = '';
    try {
      corridorHtml = renderToString(<App />).replace(/<!-- -->/g, '');
    } finally {
      globals.window = previousWindow;
    }

    expect(corridorHtml).toContain('Office Reception');
    expect(corridorHtml).toContain('Corridor');
    expect(corridorHtml).toContain('Reception Desk');
    expect(corridorHtml).toContain('Waiting Area');
    expect(corridorHtml).toContain('Opposing Counsel');
    expect(corridorHtml).toContain('aria-label="Locations"');
    const lower = corridorHtml.toLowerCase();
    for (const forbidden of [
      'canonicaltruth',
      'actualevents',
      'hiddenmotives',
      'evidenceauthenticity',
      'prior dispute',
      '18:12',
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('renders the new cast hotspots, viewpoint and day-gated conversations', () => {
    const save = createInitialSave();
    save.clock.day = 6;
    save.selectedViewpoint = 'consultation-room';
    const data: Record<string, string> = { [SAVE_KEY]: JSON.stringify(save) };
    const globals = globalThis as Record<string, unknown>;
    const previousWindow = globals.window;
    globals.window = {
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => {
          data[key] = value;
        },
        removeItem: (key: string) => {
          delete data[key];
        },
      },
    };
    let consultationHtml = '';
    let deskHtml = '';
    let dialogueHtml = '';
    try {
      consultationHtml = renderToString(<App />).replace(/<!-- -->/g, '');
      save.selectedViewpoint = 'desk';
      data[SAVE_KEY] = JSON.stringify(save);
      deskHtml = renderToString(<App />).replace(/<!-- -->/g, '');
      dialogueHtml = renderToString(<App initialPanel="dialogue" />).replace(/<!-- -->/g, '');
    } finally {
      globals.window = previousWindow;
    }

    expect(consultationHtml).toContain('Consultation Room');
    expect(consultationHtml).toContain('Medical Consultant (Dr. Kavita Iyer)');
    expect(consultationHtml).toContain('Junior Advocate (Priya)');
    expect(consultationHtml).toContain('aria-label="Consultation Room hotspots"');
    expect(deskHtml).toContain('Junior Advocate (Priya)');
    expect(dialogueHtml).toContain('Priya Nair, a junior advocate at the firm');
    expect(dialogueHtml).toContain('Dr. Kavita Iyer, a visiting clinician');
    expect(dialogueHtml).toContain('Compare the two accounts and record only what each actually supports.');
    expect(dialogueHtml).toContain('Ask, in plain terms, what the injury report can and cannot establish.');
    for (const html of [consultationHtml, deskHtml, dialogueHtml]) {
      const lower = html.toLowerCase();
      for (const forbidden of [
        'canonicaltruth',
        'actualevents',
        'hiddenmotives',
        'evidenceauthenticity',
        'prior dispute',
        '18:12',
      ]) {
        expect(lower).not.toContain(forbidden);
      }
    }
  });

  it('renders the 12-character cast hotspots and the new day-gated conversations', () => {
    const save = createInitialSave();
    save.clock.day = 8;
    const data: Record<string, string> = { [SAVE_KEY]: JSON.stringify(save) };
    const globals = globalThis as Record<string, unknown>;
    const previousWindow = globals.window;
    globals.window = {
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => {
          data[key] = value;
        },
        removeItem: (key: string) => {
          delete data[key];
        },
      },
    };
    let waitingHtml = '';
    let corridorHtml = '';
    let dialogueHtml = '';
    try {
      save.selectedViewpoint = 'waiting-area';
      data[SAVE_KEY] = JSON.stringify(save);
      waitingHtml = renderToString(<App />).replace(/<!-- -->/g, '');
      save.selectedViewpoint = 'corridor';
      data[SAVE_KEY] = JSON.stringify(save);
      corridorHtml = renderToString(<App />).replace(/<!-- -->/g, '');
      dialogueHtml = renderToString(<App initialPanel="dialogue" />).replace(/<!-- -->/g, '');
    } finally {
      globals.window = previousWindow;
    }

    expect(waitingHtml).toContain('Adv. Nisha Deshmukh (Rival)');
    expect(waitingHtml).toContain('Canteen Supervisor (Iqbal Sheikh)');
    expect(corridorHtml).toContain('Adv. Nisha Deshmukh (Rival)');
    expect(dialogueHtml).toContain('Adv. Nisha Deshmukh, an advocate from a neighbouring chamber');
    expect(dialogueHtml).toContain('Say you are working only from disclosed, reviewed material.');
    expect(dialogueHtml).toContain('Iqbal Sheikh, the canteen supervisor');
    expect(dialogueHtml).toContain('Ask what the roster records and what it cannot show.');
    for (const html of [waitingHtml, corridorHtml, dialogueHtml]) {
      const lower = html.toLowerCase();
      for (const forbidden of [
        'canonicaltruth',
        'actualevents',
        'hiddenmotives',
        'evidenceauthenticity',
        'prior dispute',
        '18:12',
      ]) {
        expect(lower).not.toContain(forbidden);
      }
    }
  });

  it('shows the final-day warning on Day 10 but never on Day 1', () => {
    const day1 = createInitialSave();
    const day10 = createInitialSave();
    day10.clock.day = 10;

    expect(renderWithSave(day1)).not.toContain('Final day — time no longer advances.');
    expect(renderWithSave(day10)).toContain(
      'Final day — time no longer advances. Complete the senior review and submit the final brief.',
    );
  });

  it('points day-locked guidance to time and prerequisite-locked guidance to prior work', () => {
    const day1 = createInitialSave();
    const day6 = createInitialSave();
    day6.clock.day = 6;

    const day1Html = renderWithSave(day1, 'assignments');
    const day6Html = renderWithSave(day6, 'assignments');
    expect(day1Html).toContain('Unlocks on Day 3. Advance time when ready.');
    expect(day6Html).toContain('Complete and submit/review the prior assignment first.');
    for (const html of [day1Html, day6Html]) {
      expect(html).not.toContain('Locks until Day');
    }
  });
});
