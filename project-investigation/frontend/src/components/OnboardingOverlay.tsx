/**
 * First-run onboarding overlay (M8 Wave 1).
 *
 * A lightweight, 3-step welcome that explains the core gameplay loop before
 * dropping a new player into the case library. Progress is resumable: the
 * server persists `lastStep`, so an interrupted intro resumes where it left
 * off. It never blocks anyone permanently - "Skip for now" (and Escape) close
 * it, and completing or skipping is remembered server-side.
 */
import { useEffect, useRef, useState } from 'react';
import type { OnboardingPatch, OnboardingState } from '../api';

const STEP_KEYS = ['welcome', 'toolkit', 'begin'] as const;

interface OnboardingOverlayProps {
  state: OnboardingState | null;
  onPatch: (changes: OnboardingPatch) => Promise<OnboardingState | null>;
  /** Hide for this session without completing (resumes on next visit). */
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

  // Move focus into the overlay on mount so keyboard users land in the guide.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Escape dismisses for the session; a small focus trap keeps Tab inside the
  // dialog while it is open.
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
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
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
    await onPatch({
      welcomeSeen: true,
      lastStep: nextStep < STEP_KEYS.length ? STEP_KEYS[nextStep] : null,
    });
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
        <div className="onboarding-eyebrow">FIELD GUIDE · {step + 1} OF {STEP_KEYS.length}</div>
        <div className="onboarding-progress" aria-hidden="true">
          {STEP_KEYS.map((key, idx) => (
            <span key={key} className={idx <= step ? 'onboarding-progress__dot onboarding-progress__dot--on' : 'onboarding-progress__dot'} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h3 id="onboarding-title" ref={headingRef} tabIndex={-1}>Welcome to THE INVESTIGATION</h3>
            <div id="onboarding-body">
              <p>Every case is a puzzle with more questions than answers. Work the room, follow the evidence, and decide who is telling the truth.</p>
              <p className="muted">There is no timer and no penalty for changing your mind. Your notes and theories are saved as you go.</p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3 id="onboarding-title" ref={headingRef} tabIndex={-1}>How an investigation works</h3>
            <div id="onboarding-body">
              <p>The core loop of every case:</p>
              <ol className="onboarding-steps">
                <li><strong>Open a case</strong> from the library. One investigation is active at a time.</li>
                <li><strong>Gather evidence</strong> in the Evidence Room and question people in Group Chat, including specialist consultants.</li>
                <li><strong>Build a Reality Map</strong> of claims and competing hypotheses - test ideas rather than just collect facts.</li>
                <li><strong>Use Perspectives &amp; Field Research</strong> for advisory lenses and real-world sources you bring back. Submitting knowledge builds your memory for later recall — it guides your thinking but is not case evidence.</li>
                <li><strong>Submit a verdict</strong> in the Accusation tab - a culprit, motive, method and the evidence that supports it.</li>
              </ol>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 id="onboarding-title" ref={headingRef} tabIndex={-1}>Your first case awaits</h3>
            <div id="onboarding-body">
              <p>Pick a case from the library - we'll highlight a recommended starting point. Explore at your own pace; there is always more to uncover.</p>
              <p className="muted">You can skip this guide at any time and it won't get in your way again.</p>
            </div>
          </>
        )}

        <div className="onboarding-actions">
          <button type="button" className="link-button" onClick={() => void skip()} disabled={busy}>
            Skip for now
          </button>
          <div className="onboarding-actions__primary">
            {step > 0 && (
              <button type="button" className="small-button" onClick={() => void goTo(step - 1)} disabled={busy}>
                Back
              </button>
            )}
            {isLast ? (
              <button type="button" className="button-link" onClick={() => void finish()} disabled={busy}>
                {busy ? 'Saving…' : 'Start investigating'}
              </button>
            ) : (
              <button type="button" className="button-link" onClick={() => void goTo(step + 1)} disabled={busy}>
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
