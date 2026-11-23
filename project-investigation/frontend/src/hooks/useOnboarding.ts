/**
 * useOnboarding
 *
 * Small hook around the auth-gated /api/me/onboarding endpoints. It loads the
 * player's first-experience state, exposes a normalized patch helper, and
 * degrades gracefully when the request fails (onboarding is cosmetic - it must
 * never block gameplay). No canonical/hidden data is involved.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { OnboardingPatch, OnboardingState } from '../api';

export interface UseOnboardingResult {
  state: OnboardingState | null;
  loading: boolean;
  /** Re-fetch the server state (e.g. after a login or manual change). */
  refresh: () => Promise<void>;
  /** Persist an allowlisted patch and update local state from the response. */
  patch: (changes: OnboardingPatch) => Promise<OnboardingState | null>;
}

export const useOnboarding = (enabled = true): UseOnboardingResult => {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setState(await api.getOnboarding());
    } catch {
      // Onboarding is best-effort: a failure simply means "no guidance shown".
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = useCallback(async (changes: OnboardingPatch): Promise<OnboardingState | null> => {
    try {
      const next = await api.updateOnboarding(changes);
      setState(next);
      return next;
    } catch {
      // Never let a cosmetic write break the UI; keep the previous state.
      return null;
    }
  }, []);

  return { state, loading, refresh, patch };
};
