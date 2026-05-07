import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
  TouchableOpacity,
} from "react-native";

const BRAND = {
  bg: "#000000",
  card: "#0B1220",
  border: "#1F2937",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  muted: "#6B7280",
  accent: "#00E396",
};

export default function SupportScreen() {
  const handleEmail = () => {
    Linking.openURL("mailto:support@alphaclara.com");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.wrapper}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}

      <Text style={styles.subtitle}>
        We're here to help you with your Alphaclara experience.
      </Text>

      {/* CARD */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Need Assistance?</Text>

        <Text style={styles.text}>
          If you're experiencing issues with the app, have questions about your
          account, alerts, or features, feel free to reach out to us.
        </Text>

        <TouchableOpacity style={styles.emailBtn} onPress={handleEmail}>
          <Text style={styles.emailText}>support@alphaclara.ai</Text>
        </TouchableOpacity>
      </View>

      {/* WHAT WE CAN HELP WITH */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>We can help with:</Text>

        <Text style={styles.bullet}>• Account and login issues</Text>
        <Text style={styles.bullet}>• Notification and alert settings</Text>
        <Text style={styles.bullet}>• Watchlist and portfolio features</Text>
        <Text style={styles.bullet}>• App performance or bugs</Text>
        <Text style={styles.bullet}>• Feedback and suggestions</Text>
      </View>

      {/* DISCLAIMER */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Important Note</Text>

        <Text style={styles.text}>
          Alphaclara provides market insights for educational and informational
          purposes only. We do not provide financial, investment, trading, tax,
          or legal advice.
        </Text>
      </View>

      {/* FOOTER */}
      <View style={styles.footerWrap}>
        <Text style={styles.powered}>
          Powered by <Text style={{ color: BRAND.accent }}>Alphaclara</Text>
        </Text>

        <Text style={styles.footer}>
          © 2026 Alphaclara. All rights reserved.
        </Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  wrapper: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 40,
  },

  title: {
    color: BRAND.accent,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: BRAND.sub,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
    marginBottom: 12,
  },

  sectionTitle: {
    color: BRAND.accent,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },

  text: {
    color: BRAND.sub,
    fontSize: 14,
    lineHeight: 20,
  },

  bullet: {
    color: BRAND.sub,
    fontSize: 14,
    marginBottom: 4,
  },

  emailBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0,227,150,0.1)",
    borderWidth: 1,
    borderColor: BRAND.accent,
    alignItems: "center",
  },

  emailText: {
    color: BRAND.accent,
    fontWeight: "800",
  },

  footerWrap: {
    alignItems: "center",
    marginTop: 20,
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
  },

  footer: {
    color: BRAND.muted,
    fontSize: 11,
  },
});
