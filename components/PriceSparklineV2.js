// components/PriceSparklineV2.js
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

const HEIGHT = 40;
const WIDTH = 110;
const STROKE = 2.5;

export default function PriceSparklineV2({ data = [] }) {
  const chart = useMemo(() => {
    if (!data || data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    if (min === max) return null;

    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * WIDTH;
      const y = HEIGHT - ((v - min) / (max - min)) * HEIGHT;
      return { x, y };
    });

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }

    const area =
      `${d} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;

    const up = data[data.length - 1] >= data[0];

    return {
      line: d,
      area,
      color: up ? "#00E396" : "#EF4444",
    };
  }, [data]);

  if (!chart) {
    return (
      <View
        style={{
          width: WIDTH,
          height: HEIGHT,
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 6,
        }}
      />
    );
  }

  return (
    <Svg width={WIDTH} height={HEIGHT}>
      <Path
        d={chart.area}
        fill={chart.color}
        opacity={0.18}
      />
      <Path
        d={chart.line}
        stroke={chart.color}
        strokeWidth={STROKE}
        fill="none"
      />
    </Svg>
  );
}
