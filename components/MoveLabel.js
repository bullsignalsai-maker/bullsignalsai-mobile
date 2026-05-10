import React from "react";
import { Text } from "react-native";
import { BRAND } from "../constants/theme";

export function getMoveLabel(changePct) {
  if (typeof changePct !== "number" || Number.isNaN(changePct)) return null;

  if (changePct >= 3) return "↗ Rising fast";
  if (changePct >= 1) return "↗ Rising";
  if (changePct <= -3) return "↘ Dropping fast";
  if (changePct <= -1) return "↘ Pulling back";
  return "Mostly steady";
}

export function getMoveLabelColor(changePct) {
  if (typeof changePct !== "number" || Number.isNaN(changePct)) {
    return BRAND.sub;
  }

  if (changePct > 0) return "#6CCB5F"; // premium green
  if (changePct < 0) return "#FF99A4"; // soft bearish red

  return BRAND.sub;
}

export default function MoveLabel({ changePct, style, numberOfLines = 1 }) {
  const label = getMoveLabel(changePct);
  if (!label) return null;

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: getMoveLabelColor(changePct),

          fontSize: 10.5,
          fontWeight: "700",

          fontStyle: "italic",

          letterSpacing: -0.2,

          marginTop: 2,

          textTransform: "none",

          includeFontPadding: false,
        },
        style,
      ]}
    >
      {label}
    </Text>
  );
}
