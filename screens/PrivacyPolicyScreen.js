import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import CustomHeader from "../components/CustomHeader";

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Privacy Policy</Text>

      <Text style={styles.updated}>Last Updated: January 2025</Text>

      <Text style={styles.text}>
        This Privacy Policy describes how Alphaclara (“we,” “our,” or “us”)
        collects, uses, and protects information when you use our mobile
        application. By using the app, you agree to the terms of this Privacy
        Policy.
      </Text>

      <Text style={styles.subTitle}>1. Information We Collect</Text>
      <Text style={styles.text}>
        • Account Information – Email address and encrypted password stored
        locally for login purposes.{"\n"}
        • App Usage Data – Anonymous statistics about app interactions, such as
        features used or pages visited.{"\n"}
        • Device Information – Basic technical data (device ID, OS version,
        crash logs) for performance improvements.{"\n"}
        • No Financial Data – We never collect payment, bank, or trading account details.
      </Text>

      <Text style={styles.subTitle}>2. How We Use Information</Text>
      <Text style={styles.text}>
        • To provide core app functions and personalized features.{"\n"}
        • To improve AI signal accuracy and user experience.{"\n"}
        • To send important alerts and market updates (if enabled).{"\n"}
        • To analyze app performance and resolve issues.
      </Text>

      <Text style={styles.subTitle}>3. Data Storage & Security</Text>
      <Text style={styles.text}>
        Your data is stored securely on your device and, where applicable, in
        encrypted cloud storage. We implement industry-standard security measures to
        prevent unauthorized access or disclosure.
      </Text>

      <Text style={styles.subTitle}>4. Third-Party Services</Text>
      <Text style={styles.text}>
        The app may use third-party APIs (e.g., market data, sentiment feeds)
        for analysis. We do not share your personal data with third parties for
        marketing purposes.
      </Text>

      <Text style={styles.subTitle}>5. Your Choices</Text>
      <Text style={styles.text}>
        • You can toggle notifications and data sources in the Profile/Settings screen.{"\n"}
        • You may delete stored data by clearing app storage or uninstalling the app.{"\n"}
        • You may contact us for data-related requests at support@bullsignals.ai (placeholder).
      </Text>

      <Text style={styles.subTitle}>6. Children’s Privacy</Text>
      <Text style={styles.text}>
        Alphaclara is not intended for individuals under 18 years of age. We
        do not knowingly collect personal data from children.
      </Text>

      <Text style={styles.subTitle}>7. Disclaimer</Text>
      <Text style={styles.text}>
        We are not legal or financial advisors. All content is for informational and educational purposes only.
      </Text>

      <Text style={styles.subTitle}>8. Changes to this Policy</Text>
      <Text style={styles.text}>
        We may update this Privacy Policy from time to time to reflect changes in
        app features or legal requirements. Updates will be posted within the app.
      </Text>

      <Text style={styles.subTitle}>9. Contact Us</Text>
      <Text style={styles.text}>
        For questions or concerns regarding this Privacy Policy, please contact us at support@bullsignals.ai
      </Text>

      <Text style={styles.footer}>
        © 2025 Alphaclara • Informational use only • No legal advice intended.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20 },
  title: { color: "#00E396", fontSize: 24, fontWeight: "700", marginBottom: 10 },
  updated: { color: "#999", fontSize: 13, marginBottom: 20 },
  subTitle: {
    color: "#00E396",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 6,
  },
  text: { color: "#CCC", fontSize: 15, lineHeight: 22 },
  footer: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
    marginTop: 40,
  },
});
