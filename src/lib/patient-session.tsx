/**
 * Patient session: {unique_code, phone} persisted in AsyncStorage so reopening
 * the app does not re-register the patient. This is identity, not auth.
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
  clearPatientSession,
  loadPatientSession,
  PatientSession,
  savePatientSession,
} from "@/lib/storage";

type PatientSessionValue = {
  session: PatientSession | null;
  /** True until the stored session has been read back from disk. */
  loading: boolean;
  identify: (session: PatientSession) => Promise<void>;
  forget: () => Promise<void>;
};

const PatientSessionContext = createContext<PatientSessionValue | null>(null);

export function PatientSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PatientSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadPatientSession().then((stored) => {
      if (!active) return;
      setSession(stored);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const identify = useCallback(async (next: PatientSession) => {
    await savePatientSession(next);
    setSession(next);
  }, []);

  const forget = useCallback(async () => {
    await clearPatientSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, identify, forget }),
    [session, loading, identify, forget],
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
