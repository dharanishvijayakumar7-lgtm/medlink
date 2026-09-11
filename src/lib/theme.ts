/** Shared design tokens. Patient screens lean teal, doctor screens lean indigo. */

export const colors = {
  bg: "#F4F6F9",
  surface: "#FFFFFF",
  border: "#E3E8EF",
  text: "#101828",
  muted: "#5B6B7F",
  faint: "#8A97A8",

  patient: "#0B7285",
  patientDark: "#075463",
  patientTint: "#E6F4F6",

  doctor: "#2A4BA0",
  doctorDark: "#1D3878",
  doctorTint: "#EAEFFA",

  danger: "#C62828",
  dangerTint: "#FDECEC",
  success: "#1B7A4B",
  successTint: "#E7F5EE",
  warning: "#B45309",
  warningTint: "#FDF3E3",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Subtle lift for cards; kept identical across platforms. */
export const shadow = {
  shadowColor: "#101828",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;
