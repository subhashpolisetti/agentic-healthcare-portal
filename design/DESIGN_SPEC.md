# AI HealthCare Portal — UI Redesign Spec
> Read this + the design files before starting any frontend work.
> Design source: open `AI HealthCare Portal.html` in browser to see all artboards live.

---

## What's In The Design Files

```
design/
├── AI HealthCare Portal.html   ← Open in browser — interactive canvas with all screens
├── design-canvas.jsx           ← Canvas framework (drag, focus mode) — do not touch
└── src/
    ├── tokens.css              ← COPY THIS → frontend/src/styles/tokens.css
    ├── ui.jsx                  ← Reference for all shared React components
    ├── tokens-card.jsx         ← Design tokens documentation
    ├── auth.jsx                ← Auth page design
    ├── patient.jsx             ← Patient: BookingPage (4 steps) + MyAppointments
    ├── doctor.jsx              ← Doctor: 5-tab dashboard
    ├── vitals.jsx              ← Emergency Vitals Monitor
    └── app.jsx                 ← Canvas artboard layout (screen map)
```

---

## Design System Summary

### Colors (OKLCH — replace all current hex/rgba)
```css
--c-primary:   oklch(0.40 0.06 180)   /* moss-teal — brand, CTAs */
--c-ai:        oklch(0.58 0.16 295)   /* lavender — ALL AI content */
--c-bg:        oklch(0.985 0.005 85)  /* warm off-white page background */
--c-card:      #ffffff
--c-ink:       oklch(0.20 0.012 240)  /* main text */
--c-danger:    oklch(0.58 0.18 25)    /* no-show, critical vitals */
--c-warn:      oklch(0.72 0.14 75)    /* admitted, caution */
--c-success:   oklch(0.58 0.12 155)   /* discharged, OK */
```
**Full token list in design/src/tokens.css — just copy it.**

### Fonts (add to index.html)
```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
```
- **Geist** (sans) — already available via npm: `npm install geist`
- **Instrument Serif** — Google Fonts (display headings only)

### Key CSS Classes (from tokens.css)
- `.ai-surface` — violet-tinted card for AI-generated content
- `.ai-dot` — pulsing green dot for active agents
- `.chip` + modifiers (`--ai`, `--success`, `--warn`, `--danger`) — status badges
- `.btn` + modifiers (`--brand`, `--ghost`, `--ai`, `--sm`, `--lg`)
- `.kicker` — ALL CAPS label style (used everywhere for section titles)
- `.shimmer-bg` — loading skeleton animation

---

## Shared Components to Build (ui.jsx → frontend/src/components/)

| Component | File | What it does |
|---|---|---|
| `Icon` | `Icon.tsx` | SVG icon system — 30+ icons, all defined in ui.jsx |
| `Avatar` | `Avatar.tsx` | User avatar with OKLCH tone palette (primary, ai, warm, rose, sage, sky, sand) |
| `AppHeader` | `AppHeader.tsx` | Top nav bar with logo, agent status chip, user info, logout |
| `TabStrip` | `TabStrip.tsx` | Tab navigation bar with icon + count badges |
| `AgentsStrip` | `AgentsStrip.tsx` | **Doctor only** — row showing all 6 agents with live status dots |
| `StatusPill` | `StatusPill.tsx` | Appointment status badge (Booked, Admitted, Discharged, No Show) |
| `RiskScore` | `RiskScore.tsx` | No-show risk score pill with mini bar (low/med/high) |
| `AIBanner` | `AIBanner.tsx` | Standardized AI content block with agent label + confidence % |
| `Sparkline` | `Sparkline.tsx` | Mini line chart for vitals and trends |

**Build all of these FIRST before touching any page.**

---

## Pages to Redesign (in order)

### 1. AuthPage.tsx
**Design file:** `design/src/auth.jsx` — `AuthScreen`
- Split 2-panel: editorial left (dark teal, hero text, 6-agent live card) + auth right (white)
- Toggle: Sign in / Sign up (pill switcher, not tabs)
- Sign up: role selector (Patient / Clinician) — pill cards with icons
- Remove current glassmorphism full-screen approach

### 2. BookingPage.tsx → 4-step wizard
**Design file:** `design/src/patient.jsx`

| Step | Screen | Key elements |
|---|---|---|
| 1 | Describe symptoms | Large textarea, quick-pick chips, trust stats strip |
| 2 | AI analyzing (loading) | Agent 01 banner, progress steps, shimmer doctor list |
| 3 | Doctor results | DoctorCard with match %, AIBanner recommendation, filter/sort |
| 4 | Booking modal | Calendar picker + time slot grid overlaid on blurred results |

**New DoctorCard fields needed from API:** `match_score` (from intake agent), `next_available`, `rating`, `telehealth` flag — intake API already returns doctors with `score`, need to add display logic.

### 3. PatientAppointmentsPage.tsx (currently at /appointments)
**Design file:** `design/src/patient.jsx` — `PatientAppointments`
- Care timeline with colored left border per status
- Segmented filter (All / Upcoming / In-care / Completed / Missed)
- Each card shows: date block, doctor avatar, specialty, where, status pill
- AI nudge banner (Agent 06 follow-up prompt) at bottom
- **Backend:** needs `followup_sent_at` in AppointmentResponse (entity has it, DTO doesn't — add it)

### 4. ClinicalDecisionPage.tsx → Full doctor dashboard
**Design file:** `design/src/doctor.jsx`

5 tabs (same as now, but redesigned):

| Tab | Key changes |
|---|---|
| Clinical Analysis | PatientStrip at top, SOAP fields with `AI Draft` badge, sidebar vitals + labs + suggested orders |
| Patient Schedule | Timeline view with no-show risk score per patient, day header, Agent 03 sidebar |
| Admitted | 3-column card grid per patient, critical state indicator, vitals snapshot, Agent 05 discharge draft |
| Discharged | Follow-up funnel chart (Agent 06), expandable rows with discharge summary + SMS preview |
| No-Show Risk | Stats row, data table with risk bar + contact info, Agent 03 explanation panel |

**Add `AgentsStrip` below AppHeader on all doctor tabs** — shows 6 agent live status dots.

### 5. EmergencyVitalsPage.tsx
**Design file:** `design/src/vitals.jsx` — `VitalsMonitor`
- Sub-header row: WebSocket status, patient info, time, action buttons
- Main: 2x3 grid of `VitalCard` (each has sparkline + ring chart for SpO₂)
- Sidebar: alert history timeline + active medications + escalate button
- Critical state: red border glow + pulsing dot on affected card
- **Agent 04 banner** at top of vitals grid (already called from frontend — just update display)

---

## Backend Changes Needed

| Change | File | Why |
|---|---|---|
| Add `followup_sent_at` to AppointmentResponse | `AppointmentResponse.java` | PatientAppointments page shows Agent 06 follow-up status |
| `noshow_risk` already in AppointmentResponse | ✅ done | Doctor Schedule shows risk score per patient |
| Intake agent returns `doctors` with `score` | ✅ done | BookingPage Step 3 match % badge |

**No new Spring Boot endpoints needed.** All data is already available.

---

## Implementation Order

```
Phase 1 — Foundation (do first, touches everything)
  1. Copy design/src/tokens.css → frontend/src/styles/tokens.css
  2. Add fonts to frontend/index.html
  3. Build all shared components (Icon, Avatar, AppHeader, TabStrip, etc.)
  4. Update AppointmentResponse.java to include followup_sent_at

Phase 2 — Pages (one at a time, verify before moving on)
  5. AuthPage.tsx
  6. BookingPage.tsx (4-step flow)
  7. PatientAppointmentsPage.tsx
  8. ClinicalDecisionPage.tsx (5 tabs)
  9. EmergencyVitalsPage.tsx

Phase 3 — Polish
  10. Test all flows end-to-end
  11. Fix any responsive issues
  12. Deploy
```

---

## What Changed vs Current Design

| Current | New |
|---|---|
| Glassmorphism — blur, rgba, red primary | Clean cards — white surfaces, teal primary |
| Single-page booking | 4-step booking wizard |
| Simple doctor list | Doctor cards with match %, avatar, rating, next slot |
| Basic discharge button | Doctor dashboard with agent status strip |
| Simple alert banner | Full vital card grid with sparklines and ring charts |
| No AI branding | Every AI output has agent label (Agent 01–06) + confidence % |
| Red (#e04444) primary | Moss-teal primary (`oklch(0.40 0.06 180)`) |
