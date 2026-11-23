/**
 * Dismissible, first-time helper text shown at the top of a few investigation
 * tabs (M8 Wave 1). The dismissed flag is persisted in the user's onboarding
 * tutorial state, so it appears once and then stays out of the way.
 */
import type { ReactNode } from 'react';

interface TabIntroTipProps {
  title: string;
  children: ReactNode;
  onDismiss: () => void;
}

export const TabIntroTip = ({ title, children, onDismiss }: TabIntroTipProps) => (
  <aside className="tab-intro-tip" role="note">
    <span className="tab-intro-tip__text">
      <strong>{title}:</strong> <span className="muted">{children}</span>
    </span>
    <button type="button" className="link-button" onClick={onDismiss}>
      Got it
    </button>
  </aside>
);
