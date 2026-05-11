import React from "react";
import { Text } from "react-native";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

export function getMoveLabel(changePct) {
  if (typeof changePct !== "number" || Number.isNaN(changePct)) {
    return null;
  }

  // -------------------------------------------------
  // Bullish
  // -------------------------------------------------

  if (changePct >= 5) return "↗ Exploding";

  if (changePct >= 2) return "↗ Rising fast";

  if (changePct >= 0.35) return "↗ Rising";

  // -------------------------------------------------
  // Neutral
  // -------------------------------------------------

  if (changePct > -0.35) return "Mostly steady";

  // -------------------------------------------------
  // Bearish
  // -------------------------------------------------

  if (changePct > -2) return "↘ Pulling back";

  if (changePct > -5) return "↘ Dropping fast";

  return "↘ Breaking down";
}

export function getMoveLabelColor(changePct) {
  if (typeof changePct !== "number" || Number.isNaN(changePct)) {
    return BRAND.sub;
  }

  // Bullish
  if (changePct >= 5) return "#00E396";

  if (changePct >= 2) return "#6CCB5F";

  if (changePct >= 0.35) return "#8CD97A";

  // Neutral
  if (changePct > -0.35) return BRAND.sub;

  // Bearish
  if (changePct > -2) return "#FF99A4";

  if (changePct > -5) return "#FF6B81";

  return "#FF4D67";
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
          fontFamily: TYPO.fontFamily.semibold,

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
