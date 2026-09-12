# MedLink — Mobile App (Parts 1 & 2)

Smartphone companion to the MedLink LiveKit voice agent. Voice-based AI healthcare
triage for rural India (SIH 2026).

Expo SDK 57 / React Native 0.86 / expo-router on the front, FastAPI + PostgreSQL
on the back, LiveKit for real-time.

> **No authentication yet.** No Firebase, no OTP, no passwords. Patients are
> identified by a shareable `MED-XXXXXX` code; doctors just type their name. Real
> auth is Part 3. Offline sync is still deferred.

---

## ⚠️ Expo Go no longer works

Part 2 adds `@livekit/react-native`, which ships native WebRTC. The app now needs a
**development build**:

```bash
npx expo prebuild --platform android
npx expo run:android
```

Everything except the call screen works the same once the dev build is installed.

### `@livekit/react-native` must stay on 3.x

`npx expo install @livekit/react-native` resolves to **2.12.0**, which does not
build. The two LiveKit packages disagree on which WebRTC artifact they use:

| version | WebRTC artifact | Kotlin namespace |
|---|---|---|
| 2.12.0 | `io.github.webrtc-sdk:android` | `org.webrtc` |
| 3.0.0 | `io.github.webrtc-sdk:android-prefixed` | `livekit.org.webrtc` |

`@livekit/react-native-webrtc` ships the **prefixed** classes, so on 2.12.0 the
native build fails with a wall of `expected 'org.webrtc.X', actual
'livekit.org.webrtc.X'` Kotlin errors. Install it with plain `npm install
@livekit/react-native@^3.0.0`, not `expo install`.

---

## Architecture

The app opens on a **role select** screen and branches into two navigation stacks
that never share a screen. The call screen sits at the root because both flows use it.

```
src/app/
  index.tsx              Role select
  call.tsx               Shared LiveKit call screen (both roles)
  patient/               ── Patient stack ──────────────────────────────
    index.tsx              gate: returning patient -> home, new -> register
    register.tsx           identity capture
    home.tsx               MED-ID, join-call banner, queue position, actions
    symptom-check.tsx      6-step guided Q&A -> triage entry
    record.tsx             triage history, referral tracker, doctor notes
    facilities.tsx         facility finder with live stock
    sos.tsx                112 + live GPS fix
  doctor/                ── Doctor stack ───────────────────────────────
    index.tsx              identity (name, specialization, facility)
    queue.tsx              live queue with status filters and origin tags
    high-risk.tsx          flagged worklist
    search.tsx             open any record by MED-ID
    stock.tsx              toggle medicine / diagnostic availability
    patient/[code].tsx     record, start call, notes, tracked referrals
```

Session handling differs by role, on purpose:

| | Patient | Doctor |
|---|---|---|
| Stored | `{unique_code, phone}` in AsyncStorage | in memory only |
| Survives app restart | yes | no — identify again |

---

## Database

This app uses its **own** database, `medlink_app`.

The LiveKit voice agent owns the separate, Alembic-managed `medlink` database
(`users`, `calls`, `triage_assessments`, …). Nothing here writes to it — keep
`DATABASE_URL` pointed at `medlink_app`.

```
patients             id, unique_code, name, age, gender, phone, village,
                     preferred_language, created_at
doctors              id, name, specialization, facility_id, created_at
facilities           id, name, type, area_label                (15 seeded)
facility_stock       id, facility_id, item_name, item_type, available, updated_at
triage_entries       id, patient_id, summary, answers JSONB,
                     status (WAITING|IN_PROGRESS|DONE),
                     source (app|voice_call), created_at
consultation_notes   id, patient_id, doctor_id, note_text, is_high_risk,
                     high_risk_reason, referred_to_facility_id, created_at
referrals            id, patient_id, doctor_id, to_facility_id,
                     status (PENDING|CONFIRMED|COMPLETED|NO_SHOW),
                     notes, created_at, updated_at
consultations        id, patient_id, doctor_id, room_name,
                     status (PENDING|ACTIVE|ENDED), created_at, ended_at
```

Schema changes are applied on startup: `create_all` makes new tables, and
`app/schema_sync.py` adds columns to tables that already exist. Both are
idempotent. If the schema ever needs more than additive changes, move to Alembic.

---

## Running it

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows

cp .env.example .env        # fill in the DB password and LiveKit keys
createdb -U postgres medlink_app

.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` matters: a phone on your Wi-Fi needs to reach the API.
`GET /health` reports whether LiveKit is configured. Docs: <http://localhost:8000/docs>

### 2. App

```bash
npm install
npx expo run:android        # dev build, not Expo Go
```

The app finds the API by reusing the Metro host the device already connected to
(`http://<lan-ip>:8000`). Override with `EXPO_PUBLIC_API_URL` if it lives elsewhere.

On a Public Wi-Fi profile Windows Firewall blocks both ports; USB avoids it entirely:

```bash
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8000 tcp:8000
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/patients` | create patient, returns `unique_code` |
| `GET` | `/patients/{code}` | full record + referrals + queue position |
| `GET` | `/patients/{code}/referrals` | patient-facing referral tracker |
| `POST` | `/patients/{code}/triage` | add a symptom check |
| `POST` | `/patients/{code}/notes` | doctor note (+ high-risk flag) |
| `GET` | `/triage/recent` | doctor queue, newest first |
| `GET` | `/triage/high-risk` | flagged worklist |
| `PATCH` | `/triage/{id}/status` | WAITING → IN_PROGRESS → DONE |
| `POST` | `/triage/by-phone` | **called by the voice agent**, not the app |
| `POST` | `/referrals` | create a tracked referral |
| `PATCH` | `/referrals/{id}/status` | advance a referral |
| `GET` | `/facilities` | facilities with their stock |
| `GET` | `/facilities/{id}/stock` | stock for one facility |
| `PATCH` | `/facilities/{id}/stock/{item}` | mark in / out of stock |
| `POST` | `/consultations/{code}/start` | doctor opens a room, gets a token |
| `GET` | `/consultations/pending/{code}` | patient polls for a waiting call |
| `POST` | `/consultations/{id}/end` | close the room |
| `POST` | `/doctors` | ephemeral doctor session |
| `GET` | `/health` | liveness + LiveKit status |

---

## Voice-agent integration

When a phone triage ends, the agent posts the call to MedLink. The caller is
matched **on phone number alone** — that is the identity decision, wired up:

```bash
curl -X POST http://localhost:8000/triage/by-phone \
  -H 'Content-Type: application/json' \
  -d '{
        "phone": "+91 98765 43210",
        "summary": "Chest pain for 2 days, breathless on walking",
        "answers": [{"question": "How long?", "answer": "2 days"}],
        "name": "Sunita Devi"
      }'
```

Returns the patient (with their `unique_code`, so the agent can read it back to
the caller), the created entry, and `created_patient` telling you whether this
call registered someone new.

Details that matter:

- **Numbers are normalised to the last 10 digits** on every write path, so
  `9876543210`, `+919876543210` and `09876543210` are one person.
- A caller with no record gets one created, so phone-only patients still reach the
  doctor's queue. Missing demographics default to `Unknown` and show up tagged.
- Demographic fields are only used when creating; they never overwrite an
  existing record.
- Entries are tagged `source: "voice_call"` and appear in the app with a
  **📞 PHONE CALL** badge next to app-submitted ones.
- A phone number is **not unique** — households share handsets. When several
  patients share a number the most recently registered one wins. Naming the
  caller during the call is what will disambiguate this properly.

---

## Design decisions worth knowing

- **Calls start audio-only.** Video is a toggle. Rural bandwidth is the
  constraint, and LiveKit degrades to audio cleanly.
- **Signalling is polling**, every 10s on the patient's home screen. Push is a
  later part. A started consultation stays joinable for 30 minutes so an
  abandoned call does not prompt forever.
- **Only the doctor ends the consultation record**, so a patient who drops out
  by accident can rejoin from the banner.
- **Rooms are created on first join**, not up front — no extra round-trip, and no
  empty rooms left behind by abandoned calls.
- **`/triage/recent`** lists only patients who submitted a symptom check.
  **`/triage/high-risk`** lists everyone flagged, including patients with no
  triage — a flagged patient belongs on the worklist either way.
- **Queue position** is based on a patient's *earliest* waiting entry, so
  submitting another symptom check never costs them their place.
- Part 1's note-level referral field still exists and still renders on old notes,
  but the doctor UI now creates tracked `Referral` records instead.

---

## Not built yet

Firebase/OTP/any real auth, doctor credential verification, offline sync, push
and SMS notifications, ABDM/FHIR, multilingual UI (preferred language is captured
but nothing is translated), facility quality-metrics dashboard.
