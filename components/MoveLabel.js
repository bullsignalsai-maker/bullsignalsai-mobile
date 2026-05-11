import React from "react";
import { Text } from "react-native";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

function getThresholds(price) {
  const p = typeof price === "number" && !Number.isNaN(price) ? price : null;

  // Lower-priced / more volatile stocks
  if (p !== null && p < 20) {
    return {
      steady: 0.6,
      risingFast: 4,
      exploding: 8,
      pullingBack: -4,
      droppingFast: -8,
    };
  }

  // Mid-priced stocks
  if (p !== null && p < 100) {
    return {
      steady: 0.45,
      risingFast: 3,
      exploding: 6,
      pullingBack: -3,
      droppingFast: -6,
    };
  }

  // Large-cap / higher-priced stocks
  return {
    steady: 0.35,
    risingFast: 2.5,
    exploding: 5,
    pullingBack: -2.5,
    droppingFast: -5,
  };
}

export function getMoveLabel(changePct, price) {
  if (typeof changePct !== "number" || Number.isNaN(changePct)) {
    return null;
  }

  const t = getThresholds(price);

  if (changePct >= t.exploding) return "↗ Exploding";
  if (changePct >= t.risingFast) return "↗ Rising fast";
  if (changePct >= t.steady) return "↗ Rising";

  if (changePct > -t.steady) return "Mostly steady";

  if (changePct > t.pullingBack) return "↘ Pulling back";
  if (changePct > t.droppingFast) return "↘ Dropping fast";

  return "↘ Breaking down";
}

export function getMoveLabelColor(changePct, price) {
  if (typeof changePct !== "number" || Number.isNaN(changePct)) {
    return BRAND.sub;
  }

  const t = getThresholds(price);

  if (changePct >= t.exploding) return "#00E396";
  if (changePct >= t.risingFast) return "#6CCB5F";
  if (changePct >= t.steady) return "#8CD97A";

  if (changePct > -t.steady) return BRAND.sub;

  if (changePct > t.pullingBack) return "#FF99A4";
  if (changePct > t.droppingFast) return "#FF6B81";

  return "#FF4D67";
}

export default function MoveLabel({
  changePct,
  price,
  style,
  numberOfLines = 1,
}) {
  const label = getMoveLabel(changePct, price);

  if (!label) return null;

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: getMoveLabelColor(changePct, price),
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
