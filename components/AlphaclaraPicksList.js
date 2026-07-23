// components/AlphaclaraPicksList.js
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import {
  formatPickedDaysAgo,
  getPickPerformanceDisplay,
} from "../utils/formatters";

function PickRow({ item, isLast, onPress }) {
  const { firstPickedPrice, pctText, color: pctColor } =
    getPickPerformanceDisplay(item);
  const pickedAgo = formatPickedDaysAgo(item.firstPickedDate);

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      style={[styles.row, !isLast && styles.divider]}
      onPress={onPress}
    >
      <View style={styles.logoCircle}>
        {item.logoUrl ? (
          <Image
            source={{ uri: item.logoUrl }}
            style={styles.logoImage}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.logoText}>
            {String(item.symbol || "").slice(0, 4)}
          </Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.symbol}>{item.symbol}</Text>
        </View>

        <Text style={styles.company} numberOfLines={1}>
          {item.companyName || item.symbol}
        </Text>

        {!!pickedAgo && <Text style={styles.pickedAgo}>{pickedAgo}</Text>}
      </View>

      <View style={styles.right}>
        {firstPickedPrice != null && (
          <Text
            style={styles.pickPrice}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {`Picked $${firstPickedPrice.toFixed(2)}`}
          </Text>
        )}
        <Text style={styles.price} numberOfLines={1}>
          {item.currentPrice != null
            ? `$${item.currentPrice.toFixed(2)}`
            : "--"}
        </Text>
        <Text
          style={[styles.move, { color: pctColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {pctText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function TierGroup({ label, dotColor, items, onPressItem, emptyPlaceholder }) {
  return (
    <View style={styles.tierWrap}>
      <View style={styles.tierHeaderRow}>
        <View style={[styles.tierDot, { backgroundColor: dotColor }]} />
        <Text style={styles.tierLabel}>{label}</Text>
      </View>

      {items.length > 0 ? (
        <>
          <View style={styles.shell}>
            {items.map((item, index) => (
              <PickRow
                key={item.key}
                item={item}
                isLast={index === items.length - 1}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onPressItem?.(item);
                }}
              />
            ))}
          </View>

          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(212,166,58,0.080)",
              "rgba(212,166,58,0.018)",
              "rgba(0,0,0,0)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glow}
          />
        </>
      ) : (
        !!emptyPlaceholder && (
          <Text style={styles.tierEmptyText}>{emptyPlaceholder}</Text>
        )
      )}
    </View>
  );
}

export default function AlphaclaraPicksList({
  items = [],
  onPressItem,
  emptyText = "No recent picks to show — check back soon.",
}) {
  if (items.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  const fresh = items.filter((i) => i.tier === "fresh");
  const tracking = items.filter(
    (i) => i.tier !== "fresh" && i.tier !== "checked",
  );
  const checked = items.filter((i) => i.tier === "checked");

  return (
    <>
      {fresh.length > 0 && (
        <TierGroup
          label="Fresh Today"
          dotColor={BRAND.accent}
          items={fresh}
          onPressItem={onPressItem}
        />
      )}

      {tracking.length > 0 && (
        <TierGroup
          label="Still Tracking"
          dotColor={BRAND.amber}
          items={tracking}
          onPressItem={onPressItem}
        />
      )}

      <TierGroup
        label="Checked"
        dotColor={BRAND.sub}
        items={checked}
        onPressItem={onPressItem}
        emptyPlaceholder="No completed picks yet — check back soon"
      />
    </>
  );
}

const styles = StyleSheet.create({
  tierWrap: {
    marginBottom: 14,
  },

  tierHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginBottom: 6,
  },

  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 6,
  },

  tierLabel: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    letterSpacing: 0.3,
  },

  tierEmptyText: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 16,
    marginHorizontal: 10,
    fontFamily: TYPO.fontFamily.medium,
  },

  shell: {
    marginHorizontal: 6,
    backgroundColor: "#0B1220",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.22)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 7,
  },

  row: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  logoCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  logoText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.25,
  },

  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  body: {
    flex: 1,
    paddingRight: 10,
  },

  topLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  symbol: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.45,
    marginRight: 7,
  },

  company: {
    color: BRAND.sub,
    fontSize: 11.4,
    marginBottom: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  pickedAgo: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 1,
  },

  right: {
    width: 92,
    alignItems: "flex-end",
  },

  pickPrice: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
    fontVariant: ["tabular-nums"],
    marginBottom: 1,
  },

  price: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 15.8,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  move: {
    marginTop: 4,
    fontSize: 11.4,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  emptyText: {
    color: BRAND.sub,
    fontSize: 12.5,
    marginHorizontal: 12,
    marginBottom: 14,
    fontFamily: TYPO.fontFamily.medium,
    textAlign: "center",
  },

  glow: {
    position: "absolute",
    top: -70,
    right: -70,
    width: 160,
    height: 160,
    borderRadius: 120,
    opacity: 0.72,
  },
});
