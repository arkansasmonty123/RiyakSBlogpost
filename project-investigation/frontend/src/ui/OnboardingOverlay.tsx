import { useEffect, useRef, useState } from 'react';
import type { OnboardingPatch, OnboardingState } from '../api';

const STEP_KEYS = ['welcome', 'toolkit', 'begin'] as const;

interface OnboardingOverlayProps {
  state: OnboardingState | null;
  onPatch: (changes: OnboardingPatch) => Promise<OnboardingState | null>;
  onDismiss: () => void;
}

function initialStep(state: OnboardingState | null): number {
  const idx = STEP_KEYS.indexOf(state?.lastStep as (typeof STEP_KEYS)[number]);
  return idx >= 0 ? idx : 0;
}

export const OnboardingOverlay = ({ state, onPatch, onDismiss }: OnboardingOverlayProps) => {
  const [step, setStep] = useState(() => initialStep(state));
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    headingRef.current?.focus();
    return () => {
      const previous = returnFocusRef.current;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  const isLast = step === STEP_KEYS.length - 1;

  const goTo = async (nextStep: number) => {
    setStep(nextStep);
    await onPatch({ welcomeSeen: true, lastStep: nextStep < STEP_KEYS.length ? STEP_KEYS[nextStep] : null });
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onPatch({ welcomeSeen: true, introCompleted: true, lastStep: null });
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onPatch({ skipped: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop onboarding-backdrop" role="presentation">
      <div
        className="dialog onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-body"
        ref={dialogRef}
      >
        <div className="onboarding-head">
          <p className="onboarding-step-count">Step {step + 1} of {STEP_KEYS.length}</p>
          <div className="onboarding-progress" aria-hidden="true">
            {STEP_KEYS.map((key, idx) => (
              <span
                key={key}
                className={idx <= step ? 'onboarding-progress__dot is-active' : 'onboarding-progress__dot'}
              />
            ))}
          </div>
        </div>

        {step === 0 && (
          <>
            <h2 id="onboarding-title" ref={headingRef} tabIndex={-1}>Welcome to the case desk</h2>
            <div id="onboarding-body" className="onboarding-body">
              <p>
                Every case gives you a briefing, a set of leads, and people who may or may not be telling the truth. Your job is to decide what the evidence supports.
              </p>
              <p className="muted">
                This takes less than a minute. There is no timer, and you can change your mind at any point. Your notes and theories save as you go.
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 id="onboarding-title" ref={headingRef} tabIndex={-1}>How a case moves</h2>
            <div id="onboarding-body" className="onboarding-body">
              <p>A case is a working loop, not a checklist you have to finish in order:</p>
              <ol className="onboarding-steps">
                <li><strong>Open a file.</strong> Start in the case library. One investigation stays active at a time.</li>
                <li><strong>Examine and interview.</strong> Work through the evidence, then question people, including specialist consultants.</li>
                <li><strong>Build a Reality Map.</strong> Turn what you have seen into claims, compare competing explanations, and track what does not fit.</li>
                <li><strong>Use Perspectives and Discoveries.</strong> These are advisory lenses and real-world sources you bring back. They sharpen your reasoning, but they are not case evidence.</li>
                <li><strong>Submit a verdict.</strong> Name the culprit, motive, and method, then point to the evidence that supports your conclusion.</li>
              </ol>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 id="onboarding-title" ref={headingRef} tabIndex={-1}>Pick your first file</h2>
            <div id="onboarding-body" className="onboarding-body">
              <p>
                The case library opens as soon as you finish. Start with the suggested file if you want a guided entry point, or choose any case that catches your eye.
              </p>
              <p className="muted">You can reopen this guide from the field guide link in the navigation.</p>
            </div>
          </>
        )}

        <div className="onboarding-actions">
          <button type="button" className="link-button" onClick={() => void skip()} disabled={busy}>
            Skip guide
          </button>
          <div className="onboarding-actions__primary">
            {step > 0 && (
              <button type="button" className="btn btn-secondary" onClick={() => void goTo(step - 1)} disabled={busy}>
                Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void (isLast ? finish() : goTo(step + 1))}
              disabled={busy}
            >
              {busy ? 'Saving…' : isLast ? 'Open the case library' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
