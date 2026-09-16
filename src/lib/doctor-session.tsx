/**
 * Doctor session: the doctor signed in on this phone, by mobile number.
 *
 * Persisted until the doctor signs out. On launch the stored profile is shown
 * straight away and refreshed from the server in the background; if the
 * server says the number is no longer a doctor's, the session ends.
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

import { api, Doctor } from "@/lib/api";
import {
  clearDoctorSession,
  loadDoctorSession,
  saveDoctorSession,
} from "@/lib/storage";

type DoctorSessionValue = {
  doctor: Doctor | null;
  /** True until the stored session has been read back from disk. */
  loading: boolean;
  signIn: (doctor: Doctor, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const DoctorSessionContext = createContext<DoctorSessionValue | null>(null);

export function DoctorSessionProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadDoctorSession().then((stored) => {
      if (!active) return;
      setDoctor(stored?.doctor ?? null);
      setLoading(false);
      if (!stored) return;

      api
        .lookupPhone(stored.phone)
        .then(async (result) => {
          if (!active) return;
          if (result.role === "doctor" && result.doctor) {
            setDoctor(result.doctor);
            await saveDoctorSession({ phone: stored.phone, doctor: result.doctor });
          } else {
            await clearDoctorSession();
            setDoctor(null);
          }
        })
        // Offline or server down: keep the stored profile.
        .catch(() => undefined);
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (next: Doctor, phone: string) => {
    await saveDoctorSession({ phone, doctor: next });
    setDoctor(next);
  }, []);

  const signOut = useCallback(async () => {
    await clearDoctorSession();
    setDoctor(null);
  }, []);

  const value = useMemo(
    () => ({ doctor, loading, signIn, signOut }),
    [doctor, loading, signIn, signOut],
  );

  return (
    <DoctorSessionContext.Provider value={value}>
      {children}
    </DoctorSessionContext.Provider>
  );
}

export function useDoctorSession(): DoctorSessionValue {
  const value = useContext(DoctorSessionContext);
  if (!value) {
    throw new Error("useDoctorSession must be used inside the doctor stack");
  }
  return value;
}
