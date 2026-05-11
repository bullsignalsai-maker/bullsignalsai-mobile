import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
  TouchableOpacity,
} from "react-native";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
export default function SupportScreen() {
  const handleEmail = () => {
    Linking.openURL("mailto:support@alphaclara.ai");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.wrapper}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <Text style={styles.title}>Support</Text>
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
          Powered by{" "}
          <Text style={{ color: BRAND.text, fontFamily: TYPO.fontFamily.bold }}>
            Alphaclara
          </Text>
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
    color: BRAND.text,
    fontSize: 28,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
    textAlign: "center",
  },

  subtitle: {
    color: BRAND.sub,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
    fontFamily: TYPO.fontFamily.medium,
  },

  card: {
    backgroundColor: "rgba(17,24,39,0.82)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    marginBottom: 12,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: TYPO.fontFamily.extrabold,
    marginBottom: 8,
  },

  text: {
    color: BRAND.sub,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: TYPO.fontFamily.regular,
  },

  bullet: {
    color: BRAND.sub,
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
    fontFamily: TYPO.fontFamily.regular,
  },

  emailBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  emailText: {
    color: "#0A0A0A",
    fontFamily: TYPO.fontFamily.bold,
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
    fontFamily: TYPO.fontFamily.medium,
  },

  footer: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.regular,
  },
  footerWrap: {
    alignItems: "center",
    marginTop: 20,
  },
});
