/**
 * Doctor session: who is using the app right now.
 *
 * Deliberately in-memory only - it is not persisted anywhere on the device.
 * Closing the app ends the session and the doctor identifies again.
 */

import { createContext, ReactNode, useContext, useMemo, useState } from "react";

import { Doctor } from "@/lib/api";

type DoctorSessionValue = {
  doctor: Doctor | null;
  setDoctor: (doctor: Doctor | null) => void;
};

const DoctorSessionContext = createContext<DoctorSessionValue | null>(null);

export function DoctorSessionProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const value = useMemo(() => ({ doctor, setDoctor }), [doctor]);

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
