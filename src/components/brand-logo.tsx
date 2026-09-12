import Svg, { Circle, Path, Rect } from "react-native-svg";

import { brand } from "@/lib/theme";

/**
 * The MedLink emblem, traced from
 * stitch_medlink_rural_healthcare_app/medlink_brand_logo/code.html as-is:
 * two interlocking care links on a teal stamp, with a medical-cross hint.
 */
export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width={100} height={100} rx={24} fill={brand.primaryTeal} />
      <Circle
        cx={50}
        cy={50}
        r={34}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={4}
        strokeOpacity={0.25}
      />
      <Path
        d="M38 32 C28 32 24 38 24 50 C24 62 28 68 38 68 C44 68 47 65 50 60 C53 65 56 68 62 68 C72 68 76 62 76 50 C76 38 72 32 62 32 C56 32 53 35 50 40 C47 35 44 32 38 32 Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={50} r={5} fill="#FFFFFF" />
    </Svg>
  );
}
