# MedLink — Mobile App (Part 1)

Smartphone companion to the MedLink LiveKit voice agent. Voice-based AI healthcare
triage for rural India (SIH 2026).

Expo SDK 57 / React Native 0.86 / expo-router on the front, FastAPI + PostgreSQL
on the back.

> **Part 1 has no authentication.** No Firebase, no OTP, no passwords. Patients are
> identified by a shareable `MED-XXXXXX` code; doctors just type their name. Real
> auth is Part 3.

---

## Architecture

The app opens on a **role select** screen and branches into two navigation stacks
that never share a screen:

```
src/app/
  index.tsx              Role select — "Continue as Patient" / "Continue as Doctor"
  patient/               ── Patient stack ──────────────────────────────
    _layout.tsx            teal header, PatientSessionProvider
    index.tsx              gate: returning patient -> home, new -> register
    register.tsx           identity capture (name, age, gender, phone, village, language)
    home.tsx               MED-ID + copy, action tiles, high-risk banner
    symptom-check.tsx      6-step guided Q&A -> triage entry
    record.tsx             read-only triage history + every doctor note
    facilities.tsx         seeded sub-centres / PHCs / hospitals
    sos.tsx                112 + live GPS fix to read out on the call
  doctor/                ── Doctor stack ───────────────────────────────
    _layout.tsx            indigo header, DoctorSessionProvider
    index.tsx              identity (name + specialization)
    queue.tsx              patients with recent triage, newest first
    high-risk.tsx          flagged worklist
    search.tsx             open any record by MED-ID
    patient/[code].tsx     full record + add note (flag / refer)
```

Session handling differs by role, on purpose:

| | Patient | Doctor |
|---|---|---|
| Stored | `{unique_code, phone}` in AsyncStorage | in memory only |
| Survives app restart | yes — skips registration | no — identify again |

Everything else lives in PostgreSQL.

---

## Database

This app uses its **own** database, `medlink_app`.

The LiveKit voice agent owns the separate, Alembic-managed `medlink` database
(`users`, `calls`, `triage_assessments`, …). Nothing here writes to it — keep it
that way, and keep `DATABASE_URL` pointed at `medlink_app`.

Tables (created automatically on server start):

```
patients             id, unique_code "MED-XXXXXX", name, age, gender, phone,
                     village, preferred_language, created_at
doctors              id, name, specialization, created_at
facilities           id, name, type, area_label            (15 seeded rows)
triage_entries       id, patient_id, summary, answers JSONB, created_at
consultation_notes   id, patient_id, doctor_id, note_text, is_high_risk,
                     high_risk_reason, referred_to_facility_id, created_at
```

---

## Running it

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS / Linux

cp .env.example .env        # then fill in your PostgreSQL password
createdb -U postgres medlink_app

.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` matters: a phone on your Wi-Fi needs to reach the API, not just
localhost.

Tables are created and facilities seeded on startup — the seed is idempotent, so
restarts never duplicate rows.

Interactive API docs: <http://localhost:8000/docs>

### 2. App

```bash
npm install
npx expo start
```

The app finds the API automatically by reusing the Metro host the device already
connected to (`http://<your-lan-ip>:8000`). Override only if the API is elsewhere:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:8000 npx expo start
```

Location and clipboard need a development build (`npx expo run:android`) or Expo
Go — both are covered by the `expo-location` config plugin in `app.json`.

---

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/patients` | create patient, returns `unique_code` |
| `GET` | `/patients/{unique_code}` | full record: patient + triage + notes |
| `POST` | `/patients/{unique_code}/triage` | add a symptom check |
| `POST` | `/patients/{unique_code}/notes` | doctor note (+ high-risk flag, + referral) |
| `GET` | `/triage/recent` | doctor queue, newest triage first |
| `GET` | `/triage/high-risk` | flagged worklist |
| `GET` | `/facilities` | facility finder + referral dropdown |
| `POST` | `/doctors` | ephemeral doctor session |
| `GET` | `/health` | liveness |

Two deliberate details:

- `/triage/recent` lists only patients who have submitted a symptom check.
  `/triage/high-risk` lists everyone a doctor flagged, **including** patients with
  no triage yet — a flagged patient belongs on the worklist either way.
- A `high_risk_reason` sent without `is_high_risk` is discarded, so the reason can
  never outlive the flag.

Patient codes are `MED-` plus six random digits, unique-constrained, with insert
retried on collision.

---

## Not in Part 1

Firebase/OTP/any real auth, doctor credential verification, LiveKit
teleconsultation, closed-loop referral status tracking (Part 1 referrals are a
stored note only), offline sync, push/SMS, ABDM/FHIR, multilingual UI (the
preferred language is captured but nothing is translated yet), live queue
wait-times, facility quality metrics.
