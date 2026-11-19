// src/lib/signup-draft.tsx
// Sign-up is a multi-screen flow. The answers live in memory for the length of
// the flow — never in a URL or in storage — so the password is not exposed to
// navigation history, logs or deep links.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface SignupAnswers {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}

const EMPTY: SignupAnswers = { fullName: '', email: '', password: '', phone: '' };

interface SignupDraft extends SignupAnswers {
  patch: (values: Partial<SignupAnswers>) => void;
  clear: () => void;
}

const SignupDraftContext = createContext<SignupDraft>({
  ...EMPTY,
  patch: () => undefined,
  clear: () => undefined,
});

export function SignupDraftProvider({ children }: { children: React.ReactNode }) {
  const [answers, setAnswers] = useState<SignupAnswers>(EMPTY);

  const patch = useCallback((values: Partial<SignupAnswers>) => {
    setAnswers((current) => ({ ...current, ...values }));
  }, []);
  const clear = useCallback(() => setAnswers(EMPTY), []);

  const value = useMemo<SignupDraft>(
    () => ({ ...answers, patch, clear }),
    [answers, patch, clear],
  );

  return <SignupDraftContext.Provider value={value}>{children}</SignupDraftContext.Provider>;
}

/** The shared answers for the current sign-up journey. */
export function useSignupDraft() {
  return useContext(SignupDraftContext);
}
