# MedLink — Full Application Report

*Voice-first AI healthcare triage for rural India · Smart India Hackathon (SIH) 2026*

> A complete A‑to‑Z walkthrough of the MedLink application: what it is, the tech
> stack, every feature, the multilingual system, the design language, data model,
> API surface, and the current security posture. Generated from a full read of the
> repository at `E:\projects\medlink`.

---

## 1. Executive summary

**MedLink** is a smartphone companion app to a separate **LiveKit voice agent**, built to bring
primary‑care triage to rural India. It is a two‑sided product:

- **Patients** check symptoms (by tapping *or by speaking in their own language*), keep a
  personal health record, upload and get plain‑language explanations of hospital records, see
  their call history with the AI voice helpline, find nearby clinics/hospitals with live stock,
  and reach emergency services.
- **Doctors** work a live triage queue, review a high‑risk worklist, open any patient record by
  ID, write clinical notes, flag follow‑ups, create tracked referrals, run video/audio
  teleconsultations, manage facility stock, and read a facility dashboard.

The whole experience is **multilingual across six Indian languages** (English, Hindi, Tamil,
Telugu, Kannada, Malayalam), with **voice input** in all six via the Indian‑government Bhashini
platform.

| Property | Value |
|---|---|
| App name / slug | **Medlink** / `medlink` |
| Version | `1.0.0` (backend API `2.0.0`) |
| Platform target | **Android** (primary product surface) |
| Framework | Expo SDK **57**, React Native **0.86.3**, React **19.2** |
| Routing | `expo-router` (file‑based, typed routes) |
| Language | TypeScript (strict) |
| Backend | FastAPI + SQLAlchemy + PostgreSQL (`medlink_app` DB) |
| Real‑time | LiveKit (WebRTC) |
| AI / ML services | Google **Gemini** (record reading), **Bhashini** (translation + speech‑to‑text), voice agent's own LLM (via Firestore summaries) |
| Auth | Mobile‑number sign‑in, **no OTP/password yet** |
| Android package | `com.r3ddyyy.medlink` (EAS owner `r3ddyyys-team`) |

---

## 2. What's in the repository

Although the app is the centrepiece, the repo is a full working system:

```
medlink/
├── src/                      React Native app (Expo Router)
│   ├── app/                  screens (file-based routes)
│   ├── components/           shared UI + feature components
│   ├── lib/                  API client, i18n, sessions, theme, helpers
│   └── locales/              en/hi/ta/te/kn/ml translation files
├── backend/                  FastAPI service (app's own PostgreSQL DB)
│   ├── app/                  routers, models, Gemini/Bhashini/LiveKit/Firestore integrations
│   └── scripts/              offline locale-translation tool
├── firebase/                 Firestore security rules (deny-all to clients)
├── assets/                   icons, splash, fonts assets, tab icons
├── stitch_.../               Stitch design mockups + the Rural Clinical Core DESIGN.md
├── app.json                  Expo config (permissions, plugins, icons)
├── package.json              dependencies & scripts
└── AGENTS.md / CLAUDE.md     project instruction (read Expo v57 docs)
```

---

## 3. Tech stack (full)

### 3.1 Mobile app (frontend)

| Area | Package(s) |
|---|---|
| Core | `expo ~57.0.20`, `react-native 0.86.3`, `react 19.2.3`, `react-dom 19.2.3` |
| Navigation | `expo-router ~57` (typed routes, React Compiler enabled) |
| Real‑time video/audio | `@livekit/react-native ^3.0.0`, `@livekit/react-native-webrtc ^144`, `livekit-client ^2.22`, `@livekit/react-native-expo-plugin`, `@config-plugins/react-native-webrtc` |
| Audio capture (voice check) | `expo-audio` (raw 16 kHz PCM stream) |
| Fonts | `@expo-google-fonts/noto-sans` (Devanagari, Tamil, Telugu, Kannada, Malayalam, Latin) |
| Storage | `@react-native-async-storage/async-storage` (patient session, language, DOB‑prompt flags) |
| Location | `expo-location` (SOS GPS + nearby facilities) |
| Documents | `expo-document-picker` (PDF upload), `expo-clipboard`, `expo-web-browser` |
| Dates | `@react-native-community/datetimepicker` |
| UI plumbing | `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, `@expo/vector-icons`, `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-image` |
| Tooling | TypeScript `~6.0` (strict), ESLint `^9` + `eslint-config-expo` |

### 3.2 Backend service

| Area | Technology |
|---|---|
| Web framework | **FastAPI** (`app.main:app`, served by uvicorn) |
| ORM / DB | SQLAlchemy over **PostgreSQL** (database `medlink_app`) |
| Config | `pydantic-settings` (`.env`) |
| Record reading (OCR/summary) | **Google Gemini** — `gemini-3.1-flash-lite` primary, `gemini-3.5-flash-lite` fallback |
| Translation + speech‑to‑text | **Bhashini** (MeitY) pipelines |
| Teleconsultation tokens | **LiveKit** server SDK (same project as the voice agent) |
| Call history store | **Firebase / Firestore** (read via service‑account key) |
| Nearby facilities & geocoding | **OpenStreetMap** (Overpass / Nominatim) |
| Background work | in‑process worker pool for PDF extraction |

### 3.3 External / integrated systems

- **LiveKit voice agent** — a *separate repository*. It answers phone calls, triages the caller,
  and writes a per‑call summary to Firestore. MedLink reads those back for **Call History**.
- **Firestore** (project `medlink-sih`) — call summaries at `patients/{+91XXXXXXXXXX}/calls/{call_id}`.
- **Bhashini** — India's national language‑AI platform for translation and ASR.

---

## 4. Architecture

### 4.1 App shell and navigation

The app opens on a **role‑select** screen and branches into two navigation stacks that never
share a screen. A shared LiveKit call screen sits at the root because both roles use it.

```
src/app/
  _layout.tsx            Root: fonts, language provider, gesture root, LiveKit bootstrap
  index.tsx              Role select + language picker (no accounts, no fields)
  call.tsx               Shared LiveKit call screen (both roles, full-screen modal)

  patient/               ── Patient stack ─────────────────────────────
    _layout.tsx            providers (patient session, i18n)
    index.tsx              gate: returning patient → home, new → sign-in/register
    sign-in.tsx            mobile-number sign-in
    profiles.tsx           choose which family member on a shared number
    register.tsx           identity capture (name, DOB, gender, phone, village, language)
    home.tsx               MED-ID card, join-call banner, queue position, action tiles
    symptom-check.tsx      voice + 6-step guided Q&A → triage entry
    record.tsx             health timeline: triage history, referrals, doctor notes
    documents/index.tsx    uploaded records from other hospitals (newest first)
    documents/upload.tsx   pick a PDF, optional hospital + visit date
    documents/[id].tsx     plain-language summary + original PDF
    calls/index.tsx        voice-agent call history (matched by phone)
    calls/[id].tsx         one call: summary, answers, medicines, advice
    facilities.tsx         nearby clinic/hospital finder (OSM) + live stock
    sos.tsx                112 emergency number + live GPS fix

  doctor/                ── Doctor stack ─────────────────────────────
    _layout.tsx            providers (doctor session, i18n)
    index.tsx              mobile-number sign-in / identity
    setup.tsx              new-doctor onboarding (name, specialization, facility)
    queue.tsx              live queue with status filters + origin tags
    high-risk.tsx          flagged worklist
    search.tsx             open any record by MED-ID
    stock.tsx              toggle medicine / diagnostic availability
    dashboard.tsx          patient load, referral + follow-up completion
    patient/[code].tsx     record, timeline, call, notes, referrals, follow-ups
```

### 4.2 Session model (differs by role, on purpose)

| | Patient | Doctor |
|---|---|---|
| Identified by | mobile number → MED‑ID | mobile number → name/specialization |
| Stored | `{unique_code, phone}` in AsyncStorage | in memory only |
| Survives app restart | **yes** | **no — identify again** |

Both roles sign in with a **10‑digit mobile number** (no OTP). A number resolves to exactly one
role; a shared household number can map to several **patient profiles** (a picker lets you choose
who is using the app). There is **no password anywhere in this build**.

### 4.3 Backend structure

`backend/app/main.py` wires a FastAPI app with routers for sign‑in, patients, doctors, triage,
facilities, referrals, consultations, notes, documents, calls, translate, and voice‑triage.
On startup it:

1. creates tables (`Base.metadata.create_all`),
2. runs an idempotent **schema sync** (`schema_sync.py`) that adds missing columns and relaxes
   `patients.age` to nullable — never dropping anything,
3. seeds **15 facilities** and their stock,
4. logs which integrations are configured (LiveKit, Gemini, Firestore, Bhashini),
5. **resumes** any document extraction a restart left unfinished.

A `/health` endpoint reports liveness plus whether LiveKit, Gemini, Firestore, and Bhashini are
configured. CORS is wide‑open for LAN development (to be locked down before real deployment).

### 4.4 Two databases, kept separate

- **`medlink_app`** — this app's own database (patients, doctors, facilities, triage, notes,
  referrals, consultations, documents).
- **`medlink`** — the **voice agent's** Alembic‑managed database. MedLink never writes to it.

---

## 5. Multilinguality (deep dive)

Multilingual support is a first‑class, end‑to‑end feature — not a stub. Six languages are fully
supported, each written in its own native script:

| Code | Native | English | Locale |
|---|---|---|---|
| `en` | English | English | en‑IN |
| `hi` | हिन्दी | Hindi | hi‑IN |
| `ta` | தமிழ் | Tamil | ta‑IN |
| `te` | తెలుగు | Telugu | te‑IN |
| `kn` | ಕನ್ನಡ | Kannada | kn‑IN |
| `ml` | മലയാളം | Malayalam | ml‑IN |

### 5.1 Two‑tier translation strategy

MedLink splits translation into **static** and **live** paths, so the UI is instant and offline
while dynamic AI text is still localized:

**Tier 1 — Static UI text (`src/lib/i18n.tsx` + `src/locales/*.json`).**
Every screen calls `t("key")`. `en.json` is the source of truth and holds **646 keys**; the other
five locale files each hold **exactly 646 keys** — full parity, every string translated. These
files are **pre‑generated once through Bhashini** by `backend/scripts/translate_locales.py` and
committed, so switching language is **instant and works with no network**. A `LanguageProvider`
loads the saved choice from AsyncStorage (chosen on the role‑select screen, before any account
exists), and a mirror of the current language is exposed to non‑React code (the API client, date
helpers). Plurals are handled via `<key>_one` / `<key>_other`, and `{name}` placeholders are
interpolated at render time.

**Tier 2 — Live runtime text (`src/lib/use-translated.ts` + `POST /translate`).**
Text that only exists at run time — Gemini's document summaries, the voice‑agent call summaries,
and voice symptom‑check results — is written by the server in **English** and translated **live**
on demand. English shows immediately and is swapped for the translation when it arrives; if
translation is unavailable, the English simply stays (a patient never sees an error). Results are
cached per‑language for the session, and screens batch many fields into a single request
(`regroup` cuts the batched response back into groups).

**Symptom answers stay English on purpose** (`src/lib/symptom-text.ts`): in‑app tap answers are
stored as their English option text, so they can be re‑localized from the committed files with
**zero network calls**, while the doctor queue and Gemini always read English.

### 5.2 The Bhashini backend (`backend/app/bhashini.py`)

- **Pipeline discovery + inference** in two steps (config endpoint → service‑specific inference
  URL/key), with per‑language‑pair caching and an in‑memory LRU string cache (limit 5000).
- **Placeholder protection**: `{count}`, `MED-482119`, `YYYY-MM-DD`, and command strings like
  `npx expo run:android` are swapped for plain numbers before translation and restored after —
  if a placeholder doesn't survive, that line falls back to English rather than showing broken.
- **Native‑digit normalization**: Indic digit glyphs in model output are mapped back to ASCII.
- **Visarga/colon repair**: Hindi/Telugu/Kannada/Malayalam sometimes render a trailing colon as
  the visarga sign; a targeted fix restores real colons (Tamil is deliberately left alone).
- **Keys never leave the server** — the app never sees Bhashini credentials.

The `/translate` route (`routers/translate.py`) accepts up to 60 texts (each capped at 2000 chars)
and returns `{texts, translated}` — `translated: false` signals a graceful English fallback.

### 5.3 Localized formatting

`src/lib/format.ts` localizes dates/times (`toLocaleString` with the current locale), relative
times ("2 hr ago"), age labels ("1 yr 3 mo"), gender, language names, due‑date phrasing, and file
sizes — all driven by translation keys. Text layouts intentionally wrap rather than truncate
because Tamil and Malayalam run much longer than English.

---

## 6. Voice features

### 6.1 Hold‑to‑speak symptom check (`src/components/voice-symptom-check.tsx`)

At the top of the symptom‑check screen is a large **press‑and‑hold microphone**. The patient picks
the language they'll speak (all six offered), holds the button, and describes how they feel:

- The mic is read as **raw 16 kHz mono 16‑bit PCM** via `expo-audio`'s stream and wrapped into a
  **WAV** in‑app (Android's recorder can't write WAV, and Bhashini reads WAV reliably).
- Guardrails: ~1 s minimum, 60 s maximum, generous press‑retention so a finger slide doesn't stop
  the recording, and the mic is always released when the screen unmounts.
- The WAV is POSTed to `POST /patients/{code}/voice-triage?language=…` as the raw request body.

**Server side (`routers/voice_triage.py` + `bhashini.transcribe`):**
1. validates the WAV header and duration (415/413/422 on bad input),
2. runs **ASR + translation‑to‑English as one Bhashini pipeline call** (VAD pre‑processor lets
   long recordings through), yielding *the patient's own words* **and** an English version,
3. `voice_triage.assess_voice(...)` writes the guidance,
4. saves it as a **normal triage entry** (answers stored in English) so it lands in the doctor
   queue like any other symptom check.

**Result screen (`VoiceResult`)** is shown **in the language the patient spoke** (a Tamil speaker
reads Tamil regardless of the app's UI language): an urgency banner (Emergency → red, See‑doctor →
amber, Home‑care → green), what was heard (transcript + keywords), possible causes with reasons,
what to do, **what not to do**, danger signs, and the mandatory information‑only disclaimer.

---

## 7. Patient features (screen by screen)

- **Role select + language** — trust pill, welcome, language chips (each in its own script), and
  two role cards. Sunlight‑mode note. No fields, no accounts.
- **Sign‑in / profiles / register** — mobile‑number sign‑in; on a shared number, pick the family
  member; new patients register with **name, date of birth, gender, phone, village, preferred
  language** and receive a shareable **MED‑XXXXXX** Health ID.
- **Home** — "Digital Health Identity" card with copyable MED‑ID; a **join‑call banner** when a
  doctor has started a consultation (polled every 10 s); **queue position**; a one‑time
  **date‑of‑birth prompt** for legacy patients; and action tiles for Symptom Check, My Record,
  Documents, Call History, Facilities, and **Emergency SOS**.
- **Symptom check** — voice card on top; otherwise a **6‑step guided Q&A** (complaint, duration,
  severity, other symptoms, ongoing conditions, notes) with large tap chips. Produces a triage
  entry with an urgency verdict, possible causes, what‑to‑do, and danger signs. Safety red‑flags
  are computed by fixed rules; Gemini adds the plain‑language layer (falling back to rules if
  unavailable).
- **My Record** — a **health timeline** of triage entries, referral status, and doctor notes,
  with follow‑up banners and phone‑call badges.
- **My Documents** — upload a **PDF** (discharge summary / prescription / lab report), optionally
  tagging hospital + visit date; MedLink reads it and writes a **plain‑language summary**
  (symptoms, medicines, out‑of‑range labs explained, medical terms defined, "what this might mean
  for you"). Kept **separate** from My Record; only the doctor's timeline merges the two. Every
  summary carries an information‑only disclaimer.
- **Call History** — summaries of the patient's calls to the voice helpline (matched purely by
  the registered phone number; the app never sends a phone number). Each call shows urgency, what
  the patient said, health background, **medicines discussed** (with doses and limits), and advice.
- **Nearby facilities** — real clinics/hospitals within **25 km** from OpenStreetMap, by GPS or a
  typed village/town/PIN code, filterable by hospital/clinic/health‑centre, with distance. Seeded
  MedLink facilities also expose **live medicine/diagnostic stock** so patients know before they
  travel.
- **Emergency SOS** — the India emergency number in a very large, arm's‑length font, plus a live
  GPS fix (lat/long + accuracy) the patient can read out or copy. Honest disclaimer: MedLink does
  **not** auto‑dispatch — the patient places the call themselves.

---

## 8. Doctor features (screen by screen)

- **Sign‑in / setup** — mobile‑number sign‑in; new doctors onboard once with name,
  specialization, and optional home facility. The session is **in‑memory only** and ends when the
  app closes; it tags the notes the doctor writes.
- **Patient triage queue** — live queue with metrics (in‑waiting, high‑risk, from‑phone,
  follow‑ups due), status filters, and origin tags (**📞 phone call** vs app). Advance status
  WAITING → IN_PROGRESS → DONE; start a consult.
- **High‑risk worklist** — everyone flagged (including patients with no triage), for maternal,
  child, and chronic‑condition follow‑ups.
- **Search patient** — open any record by MED‑ID (six digits alone work; the `MED-` prefix is
  added automatically).
- **Patient record / detail** — the merged **doctor timeline** (uploaded records + MedLink
  history, oldest first, with the patient's **age at each date** computed from DOB), start a
  **video consultation**, **add a clinical note**, **flag high‑risk with an optional follow‑up
  date**, and **create tracked referrals**.
- **Facility stock** — toggle medicine and diagnostic availability; what's marked here is exactly
  what patients see on the facility finder.
- **Facility dashboard** — pure aggregation over a chosen window (7/30/90/365 days): **patient
  load** (honestly labelled a proxy, with its basis printed), **referral completion rate**, and
  **follow‑up completion rate**. Rates are `null` (shown as "--"), never a misleading 0%, when
  nothing was due.

---

## 9. Teleconsultation (LiveKit)

- Runs on the **same LiveKit project** as the voice agent — one real‑time stack.
- **Audio‑only by default; video is a toggle** (rural bandwidth; LiveKit degrades to audio
  cleanly).
- **Signalling is polling** (patient home polls every 10 s); a started consultation stays joinable
  for 30 minutes so an abandoned call doesn't prompt forever.
- **Rooms are created on first join**, not up front — no empty rooms, no extra round‑trip.
- **Only the doctor ends** the consultation record, so a patient who drops can rejoin from the
  banner.
- WebRTC ships native code Expo Go lacks, so the LiveKit import is **guarded**
  (`src/lib/livekit.ts`): the rest of the app (symptom checks, queue, records) runs fine in Expo
  Go, and only the call screen requires a **development build** (`npx expo run:android`). The
  README pins `@livekit/react-native` to 3.x for the prefixed WebRTC namespace.

---

## 10. Medical document processing (Gemini)

- **Upload never blocks on the model.** `POST /patients/{code}/documents` validates and stores the
  file, returns **202 PENDING**, and a **two‑worker background pool** extracts it: PROCESSING →
  DONE/FAILED. The app polls while anything is in flight ("Analyzing your document…") and unfinished
  documents are re‑queued on server restart.
- **Checks:** PDF only (judged by the `%PDF-` header, not the claimed type → 415), ≤ 15 MB (413),
  optional `visit_date` must be `YYYY-MM-DD` and not future (422); the saved path never uses the
  client filename.
- **Extracted:** symptoms, medicines, out‑of‑range lab values explained in plain words, key terms
  defined, a plain summary, and a "what this might mean for you" note. The prompt forbids diagnosis
  and any advice to start/stop/change a medicine, treats the PDF as **data not instructions**
  (prompt‑injection safe), reads scanned pages and Hindi text, and always summarizes in English.
- **Model:** `gemini-3.1-flash-lite` with `gemini-3.5-flash-lite` fallback on 429/500/503/504
  (different model = separate quota). Patient‑typed hospital/visit fields are never overwritten.

---

## 11. Voice‑agent integration & call history

```
voice agent ──writes──▶ Firestore ──read by──▶ FastAPI ──▶ app (by MED-ID)
```

- After every call the agent writes a summary to Firestore at
  `patients/{+91XXXXXXXXXX}/calls/{call_id}`.
- The app asks `GET /patients/{code}/calls`; the API loads the patient from PostgreSQL, turns
  their registered phone into the agent's id (`+91` + last 10 digits), and reads Firestore with a
  **server‑side service‑account key**. The app never sends a phone number and never talks to
  Firestore directly (so Call History even works in Expo Go).
- `firebase/firestore.rules` **denies all client access**; server credentials bypass rules.
- When a phone triage ends, the agent also posts to `POST /triage/by-phone` (matched on phone
  number alone; numbers normalized to the last 10 digits; a caller with no record gets one created
  so phone‑only patients still reach the queue).

---

## 12. Design system — "Rural Clinical Core"

Defined in `stitch_.../rural_clinical_core/DESIGN.md` and codified in `src/lib/theme.ts` as the
single source of truth (no component hardcodes a hex value):

- **Color** — an M3‑style role palette plus named brand colors. Strict semantics: **red is
  reserved for life‑threatening events only** (SOS, emergency verdicts); every other alert uses
  **amber**. Teal for patient CTAs, navy for clinician UI, forest green for success.
- **Typography** — **Noto Sans** (400/500/600/700) chosen because it carries every Indic script
  the app needs; Android ignores `fontWeight` on custom families, so each style names its font
  file. A minimum readable size is enforced; an oversized `display` style exists solely for the
  SOS number.
- **Sunlight & low‑bandwidth first** — no soft drop shadows (they wash out at 1000+ nit and cost
  battery); depth comes from **structural borders and surface tiers**. High‑opacity text on
  colored cards to survive direct sun.
- **Touch targets** — large by design: 48 px minimum, 56 px patient actions/inputs, **64 px SOS**
  ("damp hands, tremors, field conditions"), 112 px "grandmother tiles".
- **Accessibility** — roles/labels/live‑regions throughout (radio groups for language/role,
  `alert` on urgency banners, `polite` live regions while processing), and disclaimers carry
  screen‑reader‑friendly wording.

Shared UI primitives live in `src/components/ui.tsx` (Button, Card, Screen, TextField,
ChoiceChips, ErrorBanner, SectionTitle, tone system), with feature components such as
`voice-symptom-check`, `phone-sign-in`, `doctor-timeline`, `live-call`, `facility-picker`,
`queue-card`, `referral-card`, `follow-up-card`, `due-date-field`, `date-of-birth-prompt`,
`document-disclaimer`, `brand-logo`, and `icon`.

---

## 13. Data model (PostgreSQL `medlink_app`)

| Table | Key columns |
|---|---|
| `patients` | `unique_code (MED-XXXXXX)`, `name`, `date_of_birth`, `age` (legacy, unused), `gender`, `phone`, `village`, `preferred_language` |
| `doctors` | `name`, `specialization`, `phone`, `facility_id` |
| `facilities` | `name`, `type`, `area_label` (15 seeded) |
| `facility_stock` | `item_name`, `item_type` (medicine/diagnostic), `available`, `updated_at` |
| `triage_entries` | `summary`, `answers` (JSONB), `status` (WAITING/IN_PROGRESS/DONE), `source` (app/voice_call), `assessment` |
| `consultation_notes` | `note_text`, `is_high_risk`, `high_risk_reason`, `referred_to_facility_id`, `follow_up_due_date`, `follow_up_resolved` |
| `referrals` | `to_facility_id`, `status` (PENDING/CONFIRMED/COMPLETED/NO_SHOW), `notes` |
| `consultations` | `room_name`, `status` (PENDING/ACTIVE/ENDED), `created_at`, `ended_at` |
| `medical_documents` | `hospital_name`, `visit_date`, `original_filename`, `file_path`, `file_size`, `status`, `extracted_summary` (JSONB), `failure_reason`, `extraction_model` |

**Age is never stored** — it is computed from `date_of_birth` on every read and returned as a
human label ("3 yrs", "1 yr 4 mo", "7 mo", "12 days", "Newborn"). Follow‑up/visit dates are handled
as **plain ISO date strings end‑to‑end** so no timezone shifts them by a day.

---

## 14. API surface (backend)

Grouped highlights (full list in `README.md`):

- **Sign‑in:** `POST /sign-in/lookup`
- **Patients:** `POST/GET/PATCH /patients…`, `GET /patients/{code}/timeline`
- **Documents:** `POST/GET /patients/{code}/documents`, `GET /documents/{id}` + `/file`
- **Calls:** `GET /patients/{code}/calls[/{id}]`
- **Triage:** `POST /patients/{code}/triage`, `POST /patients/{code}/voice-triage`,
  `GET /triage/recent | /high-risk | /follow-ups-due`, `PATCH /triage/{id}/status`,
  `POST /triage/by-phone` (voice agent)
- **Notes / referrals:** `POST /patients/{code}/notes`, `PATCH /notes/{id}/follow-up`,
  `POST /referrals`, `PATCH /referrals/{id}/status`
- **Facilities:** `GET /facilities`, `GET /facilities/nearby`, `GET /facilities/locate`,
  `GET /facilities/{id}/dashboard`, stock read/patch
- **Teleconsult:** `POST /consultations/{code}/start`, `GET /consultations/pending/{code}`,
  `POST /consultations/{id}/end`
- **Live translation:** `POST /translate`
- **Meta:** `GET /health`

The typed client is `src/lib/api.ts` (mirrors the backend schemas), which auto‑resolves the API
base URL from the Metro host the device already reached (override with `EXPO_PUBLIC_API_URL`), sets
per‑request timeouts, and surfaces localized error messages.

---

## 15. Platform properties, permissions & configuration

**Android permissions (`app.json`):** location (coarse + fine), camera, record audio, modify audio
settings, internet, network state, system alert window, wake lock, Bluetooth.

**Expo plugins:** `expo-router`, `expo-splash-screen`, `expo-location` (with a rationale string
about reading your location on a 112 call), the two LiveKit/WebRTC plugins, the datetime picker,
and `expo-audio`.

**Experiments:** typed routes + React Compiler enabled. Orientation locked to portrait; light UI
style; adaptive Android icon.

**Backend `.env` knobs (`config.py`):** `DATABASE_URL`, `LIVEKIT_*`, `GEMINI_API_KEY` +
`GEMINI_MODEL`/`GEMINI_FALLBACK_MODEL`, `FIREBASE_CREDENTIALS_FILE`/`FIRESTORE_*`, `BHASHINI_*`,
`UPLOADS_DIR`, `MAX_UPLOAD_BYTES` (15 MB), `CORS_ORIGINS`.

**Run:** backend via `uvicorn app.main:app --host 0.0.0.0 --port 8000`; app via
`npx expo run:android` (a **development build**, not Expo Go, for calls/date/document pickers). On
restrictive Wi‑Fi, `adb reverse tcp:8081/8000` avoids the firewall over USB.

---

## 16. Security & privacy posture (honest state)

This is a **hackathon/demo build**, and the code is candid about the gaps:

- **No real auth yet** — mobile‑number sign‑in identifies but does **not** authenticate (no OTP,
  no password). Anyone who knows a MED‑ID can open that record; **document IDs are sequential**, so
  the API can be walked. Acceptable for a local demo only; real auth is the next phase.
- **CORS is wide open** for LAN development — to be locked down before deployment.
- **Uploaded PDFs contain real patient data** — stored under `backend/uploads/` (gitignored);
  never to be committed or copied off the machine. Object storage is a later step.
- **Firestore is deny‑all to clients**; only server credentials read it. (A past misconfiguration
  on 2026‑09‑14, documented in the README, exposed call summaries via overly permissive agent
  rules — patient records in PostgreSQL were never affected.)
- A **shared household phone** shares call history and can map to multiple patient profiles.

---

## 17. Not built yet / roadmap

Firebase/OTP/real auth and doctor credential verification, offline sync, push & SMS
notifications, ABDM/FHIR interoperability, a facility quality‑metrics dashboard, object storage
for uploads, deleting uploaded records, an "approximate" date of birth for patients who only know
their age, and native‑speaker review of machine‑translated health text before real patient use.

---

## 18. Standout engineering decisions

- **Graceful degradation everywhere** — no Bhashini → English stays; no Gemini → rules‑only
  triage; no WebRTC (Expo Go) → whole app works except the call screen; failed translation line →
  English fallback, never a broken string.
- **Honesty in the UI** — proxy metrics are labelled as proxies; "--" instead of a misleading 0%;
  disclaimers on every AI output; SOS explicitly says it does not auto‑dispatch.
- **Rural‑first** — audio‑first calls, sunlight‑calibrated colors, huge touch targets, offline
  static translations, LAN‑friendly API resolution.
- **Safety‑first AI** — uploaded PDFs treated as data not instructions; no diagnosis or medication
  changes; symptom answers kept in English for consistent clinical reading.

---

*Report generated from a full read of the MedLink repository. For the authoritative
endpoint list, design rationale, and operational notes, see `README.md`,
`stitch_.../rural_clinical_core/DESIGN.md`, and the source under `src/` and `backend/`.*
