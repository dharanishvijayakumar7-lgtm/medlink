/**
 * Patient session: {unique_code, phone} persisted in AsyncStorage so reopening
 * the app skips sign-in. The number says who is using the app; there is no OTP
 * yet, so this is identity, not auth.
 *
 * Several patients can share one phone. `phone` is the last number signed in
 * with, kept when switching family member so the profile list can reopen.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearPatientPhone,
  clearPatientSession,
  loadPatientPhone,
  loadPatientSession,
  PatientSession,
  savePatientPhone,
  savePatientSession,
} from "@/lib/storage";

type PatientSessionValue = {
  session: PatientSession | null;
  /** The number last signed in with, even after switching profile. */
  phone: string | null;
  /** True until the stored session has been read back from disk. */
  loading: boolean;
  signIn: (session: PatientSession) => Promise<void>;
  /** Leave this profile but keep the number, to pick another family member. */
  switchProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const PatientSessionContext = createContext<PatientSessionValue | null>(null);

export function PatientSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PatientSession | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([loadPatientSession(), loadPatientPhone()]).then(
      ([storedSession, storedPhone]) => {
        if (!active) return;
        setSession(storedSession);
        setPhone(storedPhone ?? storedSession?.phone ?? null);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (next: PatientSession) => {
    await Promise.all([savePatientSession(next), savePatientPhone(next.phone)]);
    setPhone(next.phone);
    setSession(next);
  }, []);

  const switchProfile = useCallback(async () => {
    await clearPatientSession();
    setSession(null);
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([clearPatientSession(), clearPatientPhone()]);
    setPhone(null);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, phone, loading, signIn, switchProfile, signOut }),
    [session, phone, loading, signIn, switchProfile, signOut],
  );

  return (
    <PatientSessionContext.Provider value={value}>
      {children}
    </PatientSessionContext.Provider>
  );
}

export function usePatientSession(): PatientSessionValue {
  const value = useContext(PatientSessionContext);
  if (!value) {
    throw new Error("usePatientSession must be used inside the patient stack");
  }
  return value;
}
