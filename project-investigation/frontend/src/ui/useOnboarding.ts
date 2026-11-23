import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { OnboardingPatch, OnboardingState } from '../api';

export interface UseOnboardingResult {
  state: OnboardingState | null;
  loading: boolean;
  refresh: () => Promise<void>;
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
      return null;
    }
  }, []);

  return { state, loading, refresh, patch };
};
