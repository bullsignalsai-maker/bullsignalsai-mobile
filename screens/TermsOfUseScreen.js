import React from "react";
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function TermsOfUseScreen({ navigation }) {
  const handleAccept = async () => {
    await AsyncStorage.setItem("termsAccepted", "true");
    Alert.alert("Thank you", "You’ve accepted the terms.");
    navigation.goBack();
  };

  const handleDecline = () => {
    Alert.alert(
      "Notice",
      "You must accept the terms to continue using Alphaclara."
    );
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.body}>
        <Text style={styles.intro}>
          These Terms of Use ("Terms") govern your access to and use of the
          Alphaclara mobile application ("App"), owned and operated for
          informational and educational purposes only.
        </Text>

        <Text style={styles.text}>
          By using Alphaclara, you acknowledge that it does not provide
          financial, investment, or legal advice. The App provides AI-driven
          signals and sentiment summaries for informational purposes only.
          Trading and investing involve risk, and Alphaclara is not liable
          for any losses resulting from user decisions.
        </Text>

        <Text style={styles.text}>
          We reserve the right to modify or discontinue parts of the App or
          these Terms at any time. Continued use of the App after updates
          constitutes acceptance of the new Terms.
        </Text>

        <Text style={styles.text}>
          You agree not to use the App for illegal, fraudulent, or malicious
          activities. Any attempt to misuse or disrupt App functionality may
          result in suspension of access.
        </Text>

        <Text style={styles.text}>
          Alphaclara uses anonymized analytics and may integrate with APIs
          from trusted partners (e.g., X, Finnhub, Grok AI) to retrieve market
          data. No personal financial information is collected or stored.
        </Text>

        <Text style={styles.text}>
          For further details, please review our Privacy Policy. If you disagree
          with any terms, please stop using the App immediately.
        </Text>

        {/* Accept / Decline Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.btnText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
            <Text style={styles.btnText}>Decline</Text>
          </TouchableOpacity>
        </View>

        {/* Version and Footer */}
        <Text style={styles.version}>
          Version 1.0 • Last Updated: October 2025
        </Text>

        <Text style={styles.footer}>
          © 2025 Alphaclara. All rights reserved.{"\n"}
          This app is for informational use only and does not provide legal,
          financial, or investment advice.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  intro: {
    color: "#EEE",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
    fontWeight: "600",
  },
  text: {
    color: "#DDD",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 24,
  },
  acceptBtn: {
    backgroundColor: "#00E396",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  declineBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  btnText: { color: "#FFF", fontWeight: "600", fontSize: 16 },
  version: {
    color: "#9CA3AF",
    fontSize: 13,
    textAlign: "center",
    marginTop: 30,
    marginBottom: 10,
  },
  footer: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
