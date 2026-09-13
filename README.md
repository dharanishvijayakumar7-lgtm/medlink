# MedLink — Mobile App (Part 1 & Part 2, complete)

Smartphone companion to the MedLink LiveKit voice agent. Voice-based AI healthcare
triage for rural India (SIH 2026).

Expo SDK 57 / React Native 0.86 / expo-router on the front, FastAPI + PostgreSQL
on the back, LiveKit for real-time, Gemini for reading uploaded medical records.

> **No authentication yet.** No Firebase, no OTP, no passwords. Patients are
> identified by a shareable `MED-XXXXXX` code; doctors just type their name. Real
> auth is Part 3. Offline sync is still deferred.

---

## ⚠️ Video calls need a development build

Part 2 adds `@livekit/react-native`, which ships native WebRTC that Expo Go does not
include. **Expo Go still runs everything except the call screen**: the LiveKit
import is guarded in `src/lib/livekit.ts`, and the call route explains what is
missing instead of crashing the app. Real calls need a **development build**:

```bash
npx expo prebuild --platform android
npx expo run:android
```

The date picker (`@react-native-community/datetimepicker`) and document picker
(`expo-document-picker`) used for date of birth and medical records are both in
Expo Go. A development build installed before they were added does not have
them, so **rebuild it** with the commands above.

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
    documents/             records from other hospitals (separate from record.tsx)
      index.tsx              uploaded records, newest first
      upload.tsx             pick a PDF, optional hospital + visit date
      [id].tsx               plain-language summary + the original PDF
    facilities.tsx         facility finder with live stock
    sos.tsx                112 + live GPS fix
  doctor/                ── Doctor stack ───────────────────────────────
    index.tsx              identity (name, specialization, facility)
    queue.tsx              live queue with status filters and origin tags
    high-risk.tsx          flagged worklist
    search.tsx             open any record by MED-ID
    stock.tsx              toggle medicine / diagnostic availability
    dashboard.tsx          patient load, referral + follow-up completion
    patient/[code].tsx     record, timeline, call, notes, referrals, follow-ups
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
patients             id, unique_code, name, date_of_birth, age (legacy, unused),
                     gender, phone, village, preferred_language, created_at
doctors              id, name, specialization, facility_id, created_at
facilities           id, name, type, area_label                (15 seeded)
facility_stock       id, facility_id, item_name, item_type, available, updated_at
triage_entries       id, patient_id, summary, answers JSONB,
                     status (WAITING|IN_PROGRESS|DONE),
                     source (app|voice_call), created_at
consultation_notes   id, patient_id, doctor_id, note_text, is_high_risk,
                     high_risk_reason, referred_to_facility_id,
                     follow_up_due_date, follow_up_resolved, created_at
referrals            id, patient_id, doctor_id, to_facility_id,
                     status (PENDING|CONFIRMED|COMPLETED|NO_SHOW),
                     notes, created_at, updated_at
consultations        id, patient_id, doctor_id, room_name,
                     status (PENDING|ACTIVE|ENDED), created_at, ended_at
medical_documents    id, patient_id, hospital_name, visit_date,
                     hospital_name_entered, visit_date_entered,
                     original_filename, file_path, file_size,
                     status (PENDING|PROCESSING|DONE|FAILED),
                     extracted_summary JSONB, failure_reason,
                     extraction_model, uploaded_at, processed_at
```

Schema changes are applied on startup: `create_all` makes new tables, and
`app/schema_sync.py` adds columns to tables that already exist and relaxes
`patients.age` to nullable. Both are idempotent and never drop anything. If the
schema ever needs more than that, move to Alembic.

---

## Running it

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows

cp .env.example .env        # DB password, LiveKit keys, GEMINI_API_KEY
createdb -U postgres medlink_app

.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` matters: a phone on your Wi-Fi needs to reach the API.
`GET /health` reports whether LiveKit and Gemini are configured. Docs: <http://localhost:8000/docs>

Uploaded PDFs are written to `backend/uploads/`, which is created on startup and
gitignored. It holds real patient records, so never commit it or copy it off the
machine.

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
| `POST` | `/patients` | create patient (date of birth required), returns `unique_code` |
| `GET` | `/patients/{code}` | full record + referrals + queue position |
| `PATCH` | `/patients/{code}` | add a date of birth (patients registered before it existed) |
| `GET` | `/patients/{code}/timeline` | doctor timeline: uploaded records + MedLink history, oldest first |
| `POST` | `/patients/{code}/documents` | upload a PDF (multipart), returns `202` + `PENDING` at once |
| `GET` | `/patients/{code}/documents` | a patient's uploaded records, newest first |
| `GET` | `/documents/{id}` | one record, with its summary once `DONE` |
| `GET` | `/documents/{id}/file` | the original PDF, shown inline |
| `GET` | `/patients/{code}/referrals` | patient-facing referral tracker |
| `POST` | `/patients/{code}/triage` | add a symptom check |
| `POST` | `/patients/{code}/notes` | doctor note (+ high-risk flag, + follow-up date) |
| `PATCH` | `/notes/{id}/follow-up` | reschedule or close a follow-up |
| `GET` | `/triage/recent` | doctor queue, newest first |
| `GET` | `/triage/high-risk` | flagged worklist |
| `PATCH` | `/triage/{id}/status` | WAITING → IN_PROGRESS → DONE |
| `GET` | `/triage/follow-ups-due` | patients needing a check-in now |
| `POST` | `/triage/by-phone` | **called by the voice agent**, not the app |
| `POST` | `/referrals` | create a tracked referral |
| `PATCH` | `/referrals/{id}/status` | advance a referral |
| `GET` | `/facilities` | facilities with their stock |
| `GET` | `/facilities/{id}/dashboard?days=30` | load + completion rates |
| `GET` | `/facilities/{id}/stock` | stock for one facility |
| `PATCH` | `/facilities/{id}/stock/{item}` | mark in / out of stock |
| `POST` | `/consultations/{code}/start` | doctor opens a room, gets a token |
| `GET` | `/consultations/pending/{code}` | patient polls for a waiting call |
| `POST` | `/consultations/{id}/end` | close the room |
| `POST` | `/doctors` | ephemeral doctor session |
| `GET` | `/health` | liveness + LiveKit and Gemini status |

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
        "name": "Sunita Devi",
        "date_of_birth": "1980-03-15"
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
- **Contract change: `age` is no longer accepted — send `date_of_birth`
  (`YYYY-MM-DD`) if the caller gives one.** An older agent build that still sends
  `age` keeps working, because unknown fields are ignored rather than rejected.
  The patient is then created with no date of birth, never a made-up one, and
  the app asks them for it once.
- Demographic fields are only used when creating; they never overwrite an
  existing record.
- Entries are tagged `source: "voice_call"` and appear in the app with a
  **📞 PHONE CALL** badge next to app-submitted ones.
- A phone number is **not unique** — households share handsets. When several
  patients share a number the most recently registered one wins. Naming the
  caller during the call is what will disambiguate this properly.

---

## The facility dashboard

`GET /facilities/{id}/dashboard?days=30` is pure aggregation over what Parts 1
and 2 already record — no new tables. Three figures:

- **`patient_load`** — `is_proxy: true`, and it says so in the response. A
  `TriageEntry` records the *patient*, not where they were seen, so there is no
  honest way to count real footfall yet. This counts distinct patients
  **referred to** the facility plus those **seen by a doctor attached to it**,
  which understates the truth. `basis` carries that caveat to whoever reads the
  number, and the dashboard prints it under the figure rather than hiding it.
  Adding `facility_id` to `TriageEntry` is what would make this exact.
- **`referral_completion_rate`** — a direct link, no proxy: COMPLETED referrals
  over all referrals to this facility created in the window.
- **`follow_up_completion_rate`** — follow-ups whose **due date** falls in the
  window, on notes written by doctors attached to this facility. Counting by due
  date rather than note date means a follow-up set months ago still lands in the
  window it actually came due.

Every rate is `null`, never `0.0`, when nothing was due — the UI shows "--" and
an explanation instead of a 0% that reads as failure.

## Follow-up tracking

Part 1's high-risk flag said *this patient matters*. A follow-up says **when** to
come back to them and whether that has happened.

- A due date is optional and only kept alongside a high-risk flag — same rule as
  the high-risk reason, so a date can never outlive its flag.
- `GET /triage/follow-ups-due` returns anyone whose date has arrived and is not
  resolved, longest overdue first. Pulled in-app; push is a later part.
- `PATCH /notes/{id}/follow-up` reschedules, resolves, or clears. An explicit
  `null` due date clears it; omitting the key leaves it alone. Clearing a date
  also clears `resolved` — there is nothing left to have resolved. Resolving a
  note with no due date is a 409 rather than a silent no-op.
- The due-date picker is **preset chips plus typed `YYYY-MM-DD`**, not a
  calendar. Presets cover the real cases ("check again in a week"). Past dates
  (date of birth, a record's visit date) are the opposite case, a known calendar
  day, so those use the native date picker. Dates are handled as plain ISO
  strings end to end so no timezone shifts them by a day.

## Medical records from other hospitals

Patients arrive with paper and scanned records from other hospitals. **My
Documents** lets them upload those as PDFs and read a plain-language summary. It
is a separate section from **My Record**, which stays MedLink's own history. Only
the doctor's timeline merges the two.

**Upload never waits for the model.** `POST /patients/{code}/documents` checks
the file, saves it as `backend/uploads/{MED-ID}/{uuid}.pdf` and returns `202` with
status `PENDING`. Reading a PDF takes seconds to tens of seconds, so a two-worker
pool in `app/document_processing.py` does it in the background:
`PROCESSING`, then `DONE` or `FAILED`. The app polls while anything is in flight
and shows "Analyzing your document...". Documents a restart left unfinished are
queued again on startup.

**Upload checks:**

- PDF only, judged by the file's `%PDF-` header rather than the claimed type (`415`).
- 15 MB at most (`413`). Gemini takes PDFs inline up to about 20 MB.
- An optional `visit_date` must be `YYYY-MM-DD` and not in the future (`422`).
- The saved path never uses the client's filename.

**What gets extracted** (`app/extraction.py`): symptoms, medicines, test results
outside the normal range explained in plain words (low and high), key medical
terms with a one-line explanation each, a plain summary, and a "what this might
mean for you" note. The prompt pins down the judgement calls:

- Only what the document says. No diagnosis, and never advice to start, stop or
  change a medicine.
- The PDF is data, not instructions, so text inside it cannot re-prompt the model.
- A lab value counts as low or high only when the report flags it or it falls
  outside the printed range.
- Dates are day-first (`03/02/2026` is 3 February). On a discharge summary the
  visit date is the **admission** date.
- Scanned pages and Hindi text are read. The summary is always in English.

A hospital name or visit date the patient typed is never overwritten; extraction
only fills gaps. An extracted visit date in the future is treated as a misread and
dropped. A PDF that is not a medical record ends `FAILED`, with a reason the
patient can act on. Every summary carries the API's disclaimer (information only,
not medical advice or a diagnosis, may contain mistakes), and the app shows it
above the summary.

**Model: `gemini-3.1-flash-lite`, falling back to `gemini-3.5-flash-lite`** on
`429`/`500`/`503`/`504`. Both were tested against `gemini-3.8-flash` on a typed
discharge summary and a noisy image-only scan with a day-first date and a Hindi
line:

| model | checks passed | avg per document |
|---|---|---|
| `gemini-3.1-flash-lite` | 17/18 | 3.7 s |
| `gemini-3.5-flash-lite` | 17/18 | 12.3 s |
| `gemini-3.8-flash` | 10/11, then `503` "high demand" on the scan | 6.6 s |

Every model missed the same check: it read the discharge date as the visit date.
The schema now specifies the admission date. The Flash-Lite models sit in the more
generous free tier, and the fallback is a different model, so it draws on its own
quota. Override with `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`.

## Date of birth instead of age

A typed age goes stale, and it cannot say how old someone was at a visit two years
ago. Patients now have a `date_of_birth`, and **age is computed on the server on
every read, never stored.**

- **New patients must give one.** `POST /patients` rejects a missing date of
  birth, a future one, or one before 1900.
- **Existing patients are asked once and never blocked.** Home shows a card to add
  it. "Skip for now" is remembered on the device, and an "Add your date of birth"
  link stays available afterwards. `PATCH /patients/{code}` saves it.
- **`patients.age` stays, nullable and unused.** Nothing is back-filled from it,
  because a guess like "born 1 January 1968" would look exact and be wrong. The
  old stored number is never returned either: until a date of birth is given,
  `age` and `age_label` are `null`. Patient Detail shows "Not provided" and
  compact screens show "Age —".
- `age_label` reads naturally for small children: `3 yrs`, `1 yr 4 mo`, `7 mo`,
  `12 days`, `Newborn`.

## The doctor timeline

`GET /patients/{code}/timeline` merges uploaded records with MedLink's triage
entries, notes and referrals into one list, **oldest first**. Patient Detail shows
it, so the doctor sees the whole history in one scroll.

- Each entry has a date, a source (the hospital, or `MedLink`), a one-line
  summary, expandable detail, and **the patient's age on that date**, computed from
  date of birth.
- An age written inside a record appears only in its expanded detail, labelled
  as written in the record. It is never the headline.
- A record with no known visit date sits at its upload date, marked "(upload
  date)", and shows **no** age. An age worked out from the upload date would
  look precise and be wrong.
- On the same day, an outside visit with a known date sorts before MedLink
  events.
- MedLink timestamps are stored in UTC and grouped by the server's local calendar
  day. Run the API on a machine set to IST: on a UTC server, events between
  midnight and 5:30 am IST land on the previous day.

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

For medical records specifically: deleting an uploaded record, an "approximate"
date of birth for patients who only know their age, and object storage in place
of the local `uploads/` folder.

> **Privacy gap until auth lands.** Record ids are sequential and nothing is
> authenticated, so anyone who can reach the API can walk `/documents/1`,
> `/documents/2`, … and read other patients' records and PDFs. Acceptable for a
> local demo only. Part 3 auth has to close this before real records are uploaded.
