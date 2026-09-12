---
name: Rural Clinical Core
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#3f484b'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#6f797c'
  outline-variant: '#bec8cc'
  surface-tint: '#00687a'
  primary: '#005868'
  on-primary: '#ffffff'
  primary-container: '#0b7285'
  on-primary-container: '#bdf0ff'
  inverse-primary: '#82d2e7'
  secondary: '#455f87'
  on-secondary: '#ffffff'
  secondary-container: '#b5d0fd'
  on-secondary-container: '#3e5980'
  tertiary: '#8e3200'
  on-tertiary: '#ffffff'
  tertiary-container: '#b64200'
  on-tertiary-container: '#ffe2d8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#abedff'
  primary-fixed-dim: '#82d2e7'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#adc8f5'
  on-secondary-fixed: '#001c3b'
  on-secondary-fixed-variant: '#2d486d'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb598'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#7f2b00'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  headline-xl:
    fontFamily: Noto Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-xl-mobile:
    fontFamily: Noto Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg:
    fontFamily: Noto Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Noto Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-xl:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  label-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  label-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1rem
  margin-tablet: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers reliable, life-critical digital healthcare infrastructure across rural and semi-urban settings. Built for outdoor use, high ambient sunlight, low-cost displays, and diverse digital literacy levels, the visual language prioritizes immediate legibility, high contrast, and deep human empathy over ornamentation. It bridges two interconnected worlds: an ultra-accessible, calm experience for rural patients and village health workers (ASHA/ANM), and an authoritative, high-efficiency console for medical professionals.

The design movement combines **High-Contrast Utilitarianism** with **Humanist Clarity**:
- **Glare-Resistant Resilience:** Interfaces are tuned for 1000+ nit sunlight conditions on scratched, low-gamut screens. Information architecture avoids micro-interactions, low-opacity text, and subtle color differentiations.
- **Zero Gamification:** Visuals reject badges, playful confetti, decorative gradients, and frivolous illustrations in favor of solemn clinical clarity, stability, and mutual trust.
- **Bifurcated Workflows:**
  - *Patient Mode:* Single-focus task flows, heavy pictograms, voice-assist cues, physical card affordances, and a strict "one decision per screen" layout rule tailored for first-time digital users and elders.
  - *Doctor Mode:* Structured, scan-optimized information density, diagnostic telemetry, and chronological clinical logs rendered with deep navy anchoring.

## Colors

The color palette is calibrated for WCAG AAA compliance (minimum 7:1 contrast ratio for vital elements) under harsh direct sunlight:

- **Primary Teal (`#0B7285`):** Represents healing, calm, and institutional reliability. Used for primary patient CTAs, active operational states, and primary navigational waypoints.
- **Doctor Navy (`#1E3A5F`):** Anchors clinician interfaces, clinical diagnostic headers, triage data blocks, and authoritative professional actions.
- **Warning & High Risk Amber-Orange (`#E8590C`):** Deployed for clinical alerts, missed doses, high-risk triage levels, fever/vitals warnings, and incomplete registrations. *Crucially, orange absorbs all non-emergency alerting needs.*
- **Emergency SOS Red (`#D92D20`):** **Strict negative constraint:** Used exclusively for life-threatening emergency triggers, ambulance dispatches, and active panic events. It must never appear on destructive buttons (e.g., delete/cancel), error states, invalid inputs, or clinical warnings.
- **Success Forest (`#2F9E44`):** Confirms successful submissions, vitals in normal ranges, completed appointments, and verified prescriptions.
- **Canvas Base (`#FAFAFA`):** An anti-glare off-white that reduces eye fatigue under outdoor midday light while preventing LCD panel backlight bleeding.
- **Near-Black Ink (`#1A1A1A`):** The primary text color, delivering an ultra-crisp 13:1+ contrast against `#FAFAFA` surfaces.

## Typography

Noto Sans serves as the single typographic foundation across all scripts (supporting Devanagari, Tamil, Telugu, Bengali, and Latin natively). It provides wide counters, tall x-heights, distinct letterforms, and uncompromised legibility on low-resolution mobile displays.

Typographic Rules:
- **Strict Floor:** No text in the system may be set below `14px` (`label-md`), and patient-facing operational text must never drop below `16px`.
- **Vertical Spacing:** Generous line heights (`1.4` to `1.55x`) prevent character collision in Indian scripts with multi-tier ascenders, vowel markers, and conjuncts.
- **Visual Weight:** Titles and action-drivers use bold weights (`600` or `700`) to remain legible through dust, scratched protective films, and harsh midday sun.

## Layout & Spacing

The layout model employs an 8pt base grid with an absolute physical touch-target minimum of `48x48dp`. High-stakes interactions (e.g., calling an ambulance, confirming critical dosage, booking emergency triage) mandate a minimum touch target of `56dp` to `64dp` to accommodate tremors, damp hands, or field conditions.

### Breakpoints & Adaptive Behaviors
- **Mobile (Up to 599px):** 4-column fluid layout with `16px` outer margins. For Patient Mode, interfaces adhere to a strict vertical stack with full-width tap targets. Doctor Mode uses tabbed clinical segments and fixed sticky footer summaries.
- **Tablet / Phablet (600px - 1023px):** 8-column layout with `24px` outer margins. Doctor Mode transitions to a master-detail split screen (patient directory on the left 35%, clinical charting on the right 65%).
- **Field Terminal / Desktop (1024px+):** 12-column layout capped at 1200px container width for centralized hospital administration and remote teleconsultation consoles.

## Elevation & Depth

To maximize battery efficiency and visibility on screens washed out by outdoor ambient light, this system bypasses soft, multi-stop drop shadows. Elevation is conveyed strictly through **Structural Borders and High-Contrast Surface Tiers**:

- **Level 0 (Base Canvas):** Background `#FAFAFA`.
- **Level 1 (Cards, Modules, Input Containers):** Pure white `#FFFFFF` bounded by a crisp 1.5px solid border in `#DDE2E5` (or 2px `#1E3A5F` for active clinician cards).
- **Level 2 (Popovers, Sticky Action Panels, Triage Modals):** Pure white `#FFFFFF` with an immediate 2px stroke (`#1A1A1A`) supplemented by a hard offset edge shadow: `0 4px 0 rgba(26, 26, 26, 0.12)`.
- **Level 3 (SOS System Alert Overlays):** Full-screen shield with `#D92D20` prominent perimeter border (4px) guaranteeing unequivocal situational urgency.

## Shapes

A standardized radius of `8px` (`roundedness: 2`) forms the structural envelope across interactive elements. 

- Interactive controls, field inputs, and diagnostic cards utilize an 8px radius (`0.5rem`) to project modern stability without appearing fragile or playful.
- Large icon tiles within Patient Mode use a 16px radius (`rounded-lg` / `1rem`) to create distinct, tactile, easily identifiable physical stamp surfaces.
- Fully rounded pill forms are disallowed for content-bearing containers; they are reserved strictly for high-contrast triage status indicators and filter toggles.

## Components

### Buttons
- **Primary Patient Action:** Minimum height `56px`. Solid fill in Primary Teal (`#0B7285`) with white bold text (`18px`). Full width on mobile.
- **Doctor Clinical Action:** Height `48px`. Navy (`#1E3A5F`) fill or 2px outline. High density, pairing precise clinical verbs with clear glyphs.
- **Destructive Action:** Must **never** be rendered in red. Destructive actions (e.g., delete record, cancel appointment) use a 2px outline in `#1A1A1A` with a dark charcoal label or `#E8590C` if risk of data loss exists.
- **Emergency SOS Trigger:** Minimum height `64px`. Solid `#D92D20` with white bold text, accompanied by an unmistakable emergency siren icon. Protected by a slide-to-confirm pattern or 2-second hold interaction to prevent accidental pocket activation.

### Cards & Patient Action Tiles
- **Patient Mode "Grandmother Tiles":** Two-column or full-width vertical stack. Minimum height `112px`. Features a 40x40dp icon (in `#0B7285`), followed by a 20px bold label (e.g., "Talk to Doctor", "My Medicines"). Surface: `#FFFFFF` with 2px border `#CFD8DC`.
- **Doctor Patient-Row Card:** Compact list item (height `72px`). Left edge color-coded by triage level (Normal: `#2F9E44`, High Risk/Caution: `#E8590C`). Includes patient name, age/gender, presenting complaint, and vital telemetry summary.

### Form Inputs & Selectors
- **Input Fields:** Minimum height `56px`. Background `#FFFFFF`, border 2px `#757575` (resting) transition to 2px `#0B7285` (focus). Label permanently pinned above input at 16px bold (never floating placeholder text that disappears when typing).
- **Error States:** Border color switches to Warning Amber-Orange (`#E8590C`) with a bold 14px descriptive inline hint below the field. Red is prohibited.

### Checkboxes & Radio Controls
- Touch target padded to `48x48dp` with an explicit visual box/ring of `24x24dp`. 
- Checked state uses `#0B7285` with high-contrast interior checkmark (`#FFFFFF`) at 2.5px stroke weight.

### Triage & Health Status Chips
- Height `36px`, padding `0 12px`.
- **Normal:** Solid `#2F9E44` with white text.
- **Moderate / High-Risk Warning:** Solid `#E8590C` with white text.
- **Critical / Emergency:** Solid `#D92D20` with white text (strictly life-threatening vitals only).

### Audio & Visual Assist Indicators
- Dedicated speaker icon button (min `48x48dp`) integrated adjacent to primary text headers in Patient Mode to trigger instant text-to-speech readouts in regional dialects.