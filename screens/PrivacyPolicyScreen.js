import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { BRAND } from "../constants/theme";

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.updated}>Last Updated: May 2026</Text>

      <View style={styles.card}>
        <Text style={styles.text}>
          Alphaclara (“we,” “our,” or “us”) respects your privacy and is
          committed to protecting your information. This Privacy Policy explains
          how we collect, use, and safeguard your data when you use our mobile
          application.
        </Text>
      </View>

      <Section title="1. Information We Collect">
        • Account Information – Email used for authentication (Firebase).{"\n"}•
        App Data – Watchlist, portfolio, preferences, alerts.{"\n"}• Device &
        Technical Data – Device info and crash logs.{"\n"}• Usage Data –
        Anonymous usage insights.{"\n"}• Push Notification Token – For alerts
        (if enabled).{"\n"}• No Sensitive Financial Data collected.
      </Section>

      <Section title="2. How We Use Information">
        • Provide core functionality (watchlists, alerts).{"\n"}• Deliver
        AI-powered insights.{"\n"}• Send notifications (if enabled).{"\n"}•
        Monitor performance and fix issues.{"\n"}• Alphaclara uses automated
        analysis and AI models to generate market context, insights, alerts, and
        summaries.
      </Section>

      <Section title="3. Data Storage & Security">
        Data is securely stored using trusted cloud infrastructure (Firebase /
        Google Cloud). Industry-standard protections are used, but absolute
        security cannot be guaranteed.
      </Section>

      <Section title="4. Third-Party Services">
        • Market data providers (Finnhub, Polygon, CoinGecko){"\n"}• Cloud
        services (Firebase, hosting providers){"\n"}
        These services process only necessary data. We do not sell or share your
        personal data for advertising.
      </Section>

      <Section title="5. Push Notifications">
        Alphaclara may send alerts related to market activity and system
        insights. You can control notifications in app settings.
      </Section>

      <Section title="6. Your Choices & Rights">
        • Manage or disable notifications{"\n"}• Modify or delete your data
        {"\n"}• Request account/data deletion via support{"\n"}• Stop using the
        app at any time
      </Section>

      <Section title="7. Data Retention">
        Data is retained only as long as needed to provide services or meet
        legal obligations.
      </Section>

      <Section title="8. Children’s Privacy">
        Alphaclara is not intended for individuals under 18.
      </Section>

      <Section title="9. Financial Disclaimer">
        Alphaclara provides market insights, AI ratings, alerts, and summaries
        for informational and educational purposes only. We do not provide
        financial, investment, legal, or tax advice.
      </Section>

      <Section title="10. Changes to This Policy">
        We may update this policy periodically. Updates will be reflected in the
        app.
      </Section>

      <Section title="11. Contact Us">support@alphaclara.ai</Section>

      <View style={styles.footerWrap}>
        <Text style={styles.powered}>
          Powered by <Text style={styles.brand}>Alphaclara</Text>
        </Text>
        <Text style={styles.footer}>© 2026 Alphaclara</Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.subTitle}>{title}</Text>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 90,
  },

  title: {
    color: BRAND.accent,
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },

  updated: {
    color: BRAND.muted,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 18,
  },

  card: {
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  subTitle: {
    color: BRAND.accent,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 6,
  },

  text: {
    color: BRAND.sub,
    fontSize: 14,
    lineHeight: 21,
  },

  footerWrap: {
    alignItems: "center",
    marginTop: 20,
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 6,
  },

  brand: {
    color: BRAND.accent,
    fontWeight: "700",
  },

  footer: {
    color: BRAND.muted,
    fontSize: 11,
  },
});
