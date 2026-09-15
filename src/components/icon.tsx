import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

/**
 * Icons, addressed by the Material Symbols names the mockups use.
 *
 * The mockups load `Material Symbols Outlined`. @expo/vector-icons ships
 * `MaterialIcons`, the same Google set one generation earlier, where the names
 * match but use hyphens. Screens therefore write the mockup name verbatim
 * (`health_and_safety`) and this maps it across.
 *
 * A couple of glyphs were only added in Material Symbols and have no
 * MaterialIcons entry. Those come from MaterialCommunityIcons, which has the
 * same drawing - a closer match than substituting a different glyph.
 */
const COMMUNITY_ONLY: Record<string, string> = {
  stethoscope: "stethoscope",
  clinical_notes: "clipboard-pulse-outline",
  monitoring: "chart-timeline-variant",
  emergency_home: "home-alert-outline",
};

export type IconName = string;

export function Icon({
  name,
  size = 24,
  color,
  style,
}: {
  /** Material Symbols name, e.g. "health_and_safety". */
  name: IconName;
  size?: number;
  color: string;
  style?: object;
}) {
  const community = COMMUNITY_ONLY[name];
  if (community) {
    return (
      <MaterialCommunityIcons
        name={community as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
        size={size}
        color={color}
        style={style}
      />
    );
  }

  // Underscores to hyphens is the whole difference between the two name sets.
  const materialName = name.replace(/_/g, "-");
  return (
    <MaterialIcons
      name={materialName as React.ComponentProps<typeof MaterialIcons>["name"]}
      size={size}
      color={color}
      style={style}
    />
  );
}
