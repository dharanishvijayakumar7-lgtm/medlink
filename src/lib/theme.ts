/**
 * Rural Clinical Core — the design system from
 * stitch_medlink_rural_healthcare_app/rural_clinical_core/DESIGN.md.
 *
 * Single source of truth for colour, type, spacing, radius and elevation.
 * Components reference these tokens; no component hardcodes a hex value.
 *
 * Two colour vocabularies live here on purpose:
 *  - `palette` is the M3-style role set from the DESIGN.md frontmatter, which
 *    is what the Stitch mockups actually paint with.
 *  - `brand` is the named set from the DESIGN.md prose. They are close but not
 *    identical (prose Primary Teal #0B7285 is the frontmatter's
 *    `primary-container`), so both are kept rather than silently picking one.
 *
 * `colors` merges them and adds the semantic names components use.
 */

// --- M3 role set (DESIGN.md frontmatter) ------------------------------------

export const palette = {
  surface: "#fcf9f8",
  surfaceDim: "#dcd9d9",
  surfaceBright: "#fcf9f8",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f6f3f2",
  surfaceContainer: "#f0eded",
  surfaceContainerHigh: "#eae7e7",
  surfaceContainerHighest: "#e5e2e1",
  onSurface: "#1c1b1b",
  onSurfaceVariant: "#3f484b",
  inverseSurface: "#313030",
  inverseOnSurface: "#f3f0ef",
  outline: "#6f797c",
  outlineVariant: "#bec8cc",
  surfaceTint: "#00687a",

  primary: "#005868",
  onPrimary: "#ffffff",
  primaryContainer: "#0b7285",
  onPrimaryContainer: "#bdf0ff",
  inversePrimary: "#82d2e7",
  primaryFixed: "#abedff",
  primaryFixedDim: "#82d2e7",
  onPrimaryFixed: "#001f26",
  onPrimaryFixedVariant: "#004e5c",

  secondary: "#455f87",
  onSecondary: "#ffffff",
  secondaryContainer: "#b5d0fd",
  onSecondaryContainer: "#3e5980",
  secondaryFixed: "#d5e3ff",
  secondaryFixedDim: "#adc8f5",
  onSecondaryFixed: "#001c3b",
  onSecondaryFixedVariant: "#2d486d",

  tertiary: "#8e3200",
  onTertiary: "#ffffff",
  tertiaryContainer: "#b64200",
  onTertiaryContainer: "#ffe2d8",
  tertiaryFixed: "#ffdbce",
  tertiaryFixedDim: "#ffb598",
  onTertiaryFixed: "#370e00",
  onTertiaryFixedVariant: "#7f2b00",

  error: "#ba1a1a",
  onError: "#ffffff",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",

  background: "#fcf9f8",
  onBackground: "#1c1b1b",
  surfaceVariant: "#e5e2e1",
} as const;

// --- Named brand colours (DESIGN.md prose) ----------------------------------

export const brand = {
  /** Healing, calm, institutional reliability. Primary patient CTAs. */
  primaryTeal: "#0B7285",
  /** Anchors clinician interfaces and authoritative professional actions. */
  doctorNavy: "#1E3A5F",
  /** Every non-emergency alert: high risk, missed doses, warnings, errors. */
  warningAmber: "#E8590C",
  /**
   * Life-threatening triggers ONLY - SOS, ambulance dispatch, panic events.
   * Never for destructive buttons, error states, invalid input, or clinical
   * warnings. Those all use warningAmber.
   */
  emergencyRed: "#D92D20",
  successForest: "#2F9E44",
  /** Anti-glare off-white that avoids backlight bleed in midday sun. */
  canvas: "#FAFAFA",
  /** 13:1+ contrast against canvas. */
  ink: "#1A1A1A",
} as const;

// --- Semantic colours used by components ------------------------------------

export const colors = {
  ...palette,

  // Brand names, available directly.
  primaryTeal: brand.primaryTeal,
  doctorNavy: brand.doctorNavy,
  warningAmber: brand.warningAmber,
  emergencyRed: brand.emergencyRed,
  successForest: brand.successForest,
  canvas: brand.canvas,
  ink: brand.ink,

  /** Page background. */
  bg: palette.surface,
  /** Level 1 card surface. */
  card: palette.surfaceContainerLowest,
  /** Structural border that carries elevation instead of a shadow. */
  border: "#E2E7EA",
  borderStrong: palette.outlineVariant,
  /** Resting 2px input border; focus switches to `patient`. */
  inputBorder: "#757575",
  /** "Grandmother tile" border. */
  tileBorder: "#CFD8DC",
  /** 2px border marking an active clinician card. */
  borderClinical: brand.doctorNavy,

  text: palette.onSurface,
  muted: palette.onSurfaceVariant,
  faint: palette.outline,

  /** Patient mode accent. */
  patient: palette.primaryContainer,
  patientDark: palette.primary,
  patientTint: palette.primaryFixed,
  /** Quiet background for patient icon circles and selected rows. */
  patientSoft: "#E3F3F6",
  onPatient: palette.onPrimary,

  /** Doctor mode accent. */
  doctor: palette.secondary,
  doctorDark: palette.onSecondaryFixed,
  doctorTint: palette.secondaryFixed,
  /** Quiet background for doctor icon circles and selected rows. */
  doctorSoft: "#E8EEF7",
  onDoctor: palette.onSecondary,

  /**
   * Non-emergency alerting. Amber, never red - DESIGN.md reserves red for
   * life-threatening events only.
   */
  warning: brand.warningAmber,
  warningTint: palette.tertiaryFixed,
  warningSoft: "#FFF1EA",
  onWarning: "#ffffff",

  /** Life-threatening only. */
  emergency: brand.emergencyRed,
  emergencyTint: palette.errorContainer,
  onEmergency: "#ffffff",

  success: brand.successForest,
  successTint: "#d8f3dd",
  successSoft: "#EAF7EC",
  onSuccess: "#ffffff",
} as const;

// --- Typography -------------------------------------------------------------
//
// Noto Sans carries every script the app needs (Devanagari, Tamil, Telugu,
// Bengali, Latin). Android ignores fontWeight on custom families, so each
// style names its own file rather than relying on a weight.
//
// Sized for older eyes: body text is 18, and nothing is smaller than 16.
// Indic scripts need the generous line heights for their marks.

export const fonts = {
  regular: "NotoSans_400Regular",
  medium: "NotoSans_500Medium",
  semibold: "NotoSans_600SemiBold",
  bold: "NotoSans_700Bold",
} as const;

type TextStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
};

export const type: Record<
  | "headlineXl"
  | "headlineXlMobile"
  | "headlineLg"
  | "headlineMd"
  | "bodyXl"
  | "bodyLg"
  | "bodyMd"
  | "labelLg"
  | "labelMd"
  | "display",
  TextStyle
> = {
  headlineXl: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 42 },
  headlineXlMobile: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 38 },
  headlineLg: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 34 },
  headlineMd: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 30 },
  bodyXl: { fontFamily: fonts.regular, fontSize: 20, lineHeight: 30 },
  bodyLg: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 28 },
  bodyMd: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 28 },
  labelLg: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26 },
  /** The absolute floor. Nothing in the system may be smaller. */
  labelMd: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  /**
   * Not in DESIGN.md's scale - added for one job: the emergency number on the
   * SOS screen, which has to be readable at arm's length while dialling.
   * Do not use it for anything else.
   */
  display: { fontFamily: fonts.bold, fontSize: 64, lineHeight: 72 },
};

// --- Overlays -----------------------------------------------------------------
//
// White or black at a fixed alpha, for things sitting on a coloured or dark
// surface (the teal symptom-check card, the navy triage hero, the call screen).

export const overlay = {
  /** Tinted fill for a tile, pill or button on a coloured card. */
  onColorFill: "rgba(255,255,255,0.2)",
  /** The quieter, switched-off state of such a fill. */
  onColorFaint: "rgba(255,255,255,0.08)",
  /**
   * Secondary text on a coloured card. Deliberately high: DESIGN.md avoids
   * low-opacity text, which washes out in direct sunlight.
   */
  onColorText: "rgba(255,255,255,0.9)",
  /** A darkening strip inside a navy hero. */
  scrim: "rgba(0,0,0,0.18)",
} as const;

// --- Spacing (8pt grid) -----------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  /** Outer page margin on mobile. */
  margin: 20,
  marginTablet: 24,
  gutter: 16,
  gutterMobile: 12,
} as const;

// --- Radius -----------------------------------------------------------------

export const radius = {
  sm: 6,
  /** Controls, inputs and buttons. */
  md: 14,
  /** Cards and banners - soft, friendly corners. */
  lg: 20,
  /** Patient-mode icon tiles - tactile physical stamp surfaces. */
  tile: 18,
  xl: 28,
  /** Status chips and filter toggles ONLY - never content containers. */
  pill: 9999,
} as const;

// --- Touch targets ----------------------------------------------------------

export const touch = {
  /** Absolute physical minimum. */
  min: 48,
  /** Doctor clinical action. */
  doctorAction: 48,
  /** Primary patient action and form inputs. */
  patientAction: 60,
  /** Emergency SOS trigger - damp hands, tremors, field conditions. */
  sos: 64,
  /** "Grandmother tile" minimum height. */
  tile: 112,
  /** Doctor patient-row card. */
  row: 72,
  /** Triage status chip and filter toggle. */
  chip: 44,
} as const;

// --- Elevation --------------------------------------------------------------
//
// No soft multi-stop drop shadows: they wash out under 1000+ nit sunlight and
// cost battery. Depth comes from structural borders and surface tiers, with a
// hard offset edge on level 2. Android `elevation` is deliberately left at 0
// because it can only draw a soft shadow.

export const elevation = {
  /** Level 1: cards, modules, input containers. */
  level1: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  /** Level 1, active clinician card. */
  level1Clinical: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.borderClinical,
  },
  /** Level 2: popovers, sticky action panels, triage modals. */
  level2: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 0,
  },
  /** Level 3: SOS system alert overlay. */
  level3: {
    borderWidth: 4,
    borderColor: colors.emergency,
  },
} as const;
