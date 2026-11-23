/**
 * First-investigation checklist (M8 Wave 1, slice 2).
 *
 * A small, collapsible field guide that gives a brand-new player six concrete
 * things to try in their first case. Each step can be ticked manually ("Mark
 * done"), and every tick is persisted in the player's onboarding
 * `tutorialState` (best-effort only - guidance never blocks gameplay). The
 * whole guide can be hidden, which is also persisted so it stays out of the
 * way. All copy is non-spoiler and deliberately practical.
 *
 * This is UI state only: no canonical truth, hidden evidence, or verdict data
 * is read or written here.
 */
import { useState } from 'react';
import type { OnboardingPatch, OnboardingState } from '../api';

type StepKey =
  | 'stepBriefing'
  | 'stepEvidence'
  | 'stepChat'
  | 'stepClaims'
  | 'stepFieldResearch'
  | 'stepVerdict';

interface ChecklistStep {
  key: StepKey;
  title: string;
  example: string;
}

const STEPS: ChecklistStep[] = [
  {
    key: 'stepBriefing',
    title: 'Review the case briefing',
    example: 'Open “Case briefing” above for the setup and what is known so far.',
  },
  {
    key: 'stepEvidence',
    title: 'Examine evidence in the Evidence Room',
    example: 'Open the Evidence tab and “Mark as examined” on an item, such as a statement or receipt.',
  },
  {
    key: 'stepChat',
    title: 'Ask a question in Group Chat',
    example: 'Pick a specialist as the responder and try “What stands out about this timeline?”',
  },
  {
    key: 'stepClaims',
    title: 'Add a claim in the Reality Map',
    example: 'Write a claim like “The alarm was disabled before midnight” and link evidence to it.',
  },
  {
    key: 'stepFieldResearch',
    title: 'Try Field Research for a real-world clue',
    example: 'Investigate a real-world source and bring what you find back. Submitting knowledge builds your memory for later recall — it guides you but is not case evidence.',
  },
  {
    key: 'stepVerdict',
    title: 'Form your verdict when ready',
    example: 'Open the Accusation tab and give a culprit, motive, method, and the evidence that supports them.',
  },
];

interface OnboardingChecklistProps {
  tutorialState: OnboardingState['tutorialState'];
  onPatch: (changes: OnboardingPatch) => Promise<OnboardingState | null>;
}

export const OnboardingChecklist = ({ tutorialState, onPatch }: OnboardingChecklistProps) => {
  const [open, setOpen] = useState(true);
  const doneCount = STEPS.filter((s) => tutorialState?.[s.key] === true).length;
  const allDone = doneCount === STEPS.length;

  const toggleStep = (step: ChecklistStep): void => {
    const next = tutorialState?.[step.key] !== true;
    void onPatch({ tutorialState: { [step.key]: next } });
  };

  const hideGuide = (): void => {
    void onPatch({ tutorialState: { guideCompleted: true } });
  };

  return (
    <section className="field-guide" aria-label="First investigation field guide">
      <div className="field-guide__header">
        <button
          type="button"
          className="field-guide__toggle"
          aria-expanded={open}
          aria-controls="field-guide-steps"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="field-guide__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span>
            <strong>First investigation · field guide</strong>
            <span className="muted"> — {doneCount} of {STEPS.length} steps done{allDone ? ' · nicely worked' : ''}</span>
          </span>
        </button>
        <button type="button" className="link-button" onClick={hideGuide}>
          Hide guide
        </button>
      </div>
      {open && (
        <ol className="field-guide__steps" id="field-guide-steps">
          {STEPS.map((step, index) => {
            const done = tutorialState?.[step.key] === true;
            return (
              <li key={step.key} className={done ? 'field-guide__step field-guide__step--done' : 'field-guide__step'}>
                <button
                  type="button"
                  className="field-guide__check"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${step.title}${done ? ' (done)' : ''}`}
                  onClick={() => toggleStep(step)}
                >
                  <span className="field-guide__box" aria-hidden="true">{done ? '✓' : ''}</span>
                  <span className="field-guide__step-body">
                    <span className="field-guide__step-title">
                      <span className="muted">{index + 1}.</span> {step.title}
                    </span>
                    <span className="muted field-guide__step-example">e.g. {step.example}</span>
                  </span>
                  <span className="field-guide__step-action">{done ? 'Done' : 'Mark done'}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="muted field-guide__footnote">
        Tips are guidance, not evidence. Field Research brings in outside sources; anything you submit is saved to your knowledge memory for later recall.
      </p>
    </section>
  );
};
