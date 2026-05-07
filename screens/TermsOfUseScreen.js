import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { BRAND } from "../constants/theme";

export default function TermsOfUseScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.updated}>Last Updated: May 2026</Text>

      <View style={styles.card}>
        <Text style={styles.text}>
          These Terms of Use govern your access to and use of the Alphaclara
          mobile application. By using Alphaclara, you agree to these Terms.
        </Text>
      </View>

      <Section title="1. Informational Use Only">
        Alphaclara provides AI-powered market insights, AI ratings, portfolio
        context, crypto movement alerts, and related information for educational
        and informational purposes only. Alphaclara does not provide financial,
        investment, trading, tax, legal, or professional advice.
      </Section>

      <Section title="2. No Investment Recommendation">
        Any ratings, alerts, summaries, or AI-generated explanations are not
        recommendations to buy, sell, hold, or trade any security,
        cryptocurrency, or financial instrument. You are solely responsible for
        your own decisions.
      </Section>

      <Section title="3. Market Risk">
        Investing and trading involve risk, including possible loss of
        principal. Market data may be delayed, incomplete, inaccurate, or
        unavailable. Alphaclara does not guarantee accuracy, performance,
        outcomes, or future results.
      </Section>

      <Section title="4. AI-Generated Content">
        Alphaclara may use automated analysis and AI-generated explanations to
        provide market context, alerts, summaries, and confidence indicators.
        AI-generated content may contain errors or omissions and should not be
        relied upon as the sole basis for any financial decision.
      </Section>

      <Section title="5. User Responsibilities">
        You agree to use Alphaclara lawfully and responsibly. You must not
        misuse, disrupt, reverse engineer, overload, or attempt unauthorized
        access to the app, backend systems, APIs, or data.
      </Section>

      <Section title="6. Third-Party Data and Services">
        Alphaclara may use third-party services for market data, analytics,
        authentication, cloud storage, and notifications. We are not responsible
        for interruptions, inaccuracies, or changes in third-party services.
      </Section>

      <Section title="7. Alerts and Notifications">
        Alerts are provided for convenience and may be delayed, missed,
        duplicated, or unavailable. You can manage notification preferences
        within the app. Alerts should not be treated as financial advice or
        emergency notices.
      </Section>

      <Section title="8. Limitation of Liability">
        To the maximum extent permitted by law, Alphaclara and its operators are
        not liable for losses, damages, missed opportunities, investment
        outcomes, or decisions made based on app content, alerts, ratings, or
        market information.
      </Section>

      <Section title="9. Changes to the App or Terms">
        We may update, modify, suspend, or discontinue features at any time. We
        may also update these Terms from time to time. Continued use of the app
        means you accept the updated Terms.
      </Section>

      <Section title="10. Privacy">
        Your use of Alphaclara is also governed by our Privacy Policy, which
        explains how data is collected, used, and protected.
      </Section>

      <Section title="11. Contact">
        For questions about these Terms, contact us at support@alphaclara.ai
      </Section>

      <View style={styles.footerWrap}>
        <Text style={styles.powered}>
          Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
        </Text>
        <Text style={styles.footer}>
          © 2026 Alphaclara. All rights reserved.
        </Text>
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
    marginBottom: 6,
    textAlign: "center",
  },

  updated: {
    color: BRAND.muted,
    fontSize: 12.5,
    marginBottom: 18,
    textAlign: "center",
    fontWeight: "700",
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
    fontSize: 15.5,
    fontWeight: "900",
    marginBottom: 7,
  },

  text: {
    color: BRAND.sub,
    fontSize: 14,
    lineHeight: 21,
  },

  footerWrap: {
    alignItems: "center",
    marginTop: 22,
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
  },

  footerBrand: {
    color: BRAND.accent,
    fontWeight: "700",
  },

  footer: {
    color: BRAND.muted,
    fontSize: 11,
    textAlign: "center",
  },
});
