// screens/LoginScreen.js
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Pressable,
  StatusBar,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

import { auth, db } from "../firebaseConfig";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import { SafeAreaView } from "react-native-safe-area-context"; // ← Added for SafeAreaView fix
import AppButton from "../components/AppButton";
export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [securePassword, setSecurePassword] = useState(true);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef(null);

  const cleanEmail = email.trim().toLowerCase();
  const canLogin = cleanEmail.length > 0 && password.length > 0 && !loading;

  const handleLogin = async () => {
    if (!cleanEmail || !password) {
      Alert.alert(
        "Missing Information",
        "Please enter your email and password.",
      );
      return;
    }

    try {
      setLoading(true);
      Keyboard.dismiss();

      const userCredential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );

      const user = userCredential.user;

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await AsyncStorage.setItem(
          "profile_" + user.email,
          JSON.stringify(docSnap.data()),
        );
      }

      await AsyncStorage.setItem("userToken", user.email);
      navigation.replace("Main");
    } catch (error) {
      console.warn("Login failed:", error?.code);
      Alert.alert(
        "Login Failed",
        "Please check your email and password, then try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!cleanEmail) {
      Alert.alert("Email Required", "Please enter your email address first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      Alert.alert(
        "Password Reset Sent",
        "If an account exists for this email, a reset link will be sent shortly.",
      );
    } catch (error) {
      console.warn("Password reset failed:", error?.code);
      Alert.alert(
        "Password Reset",
        "If an account exists for this email, a reset link will be sent shortly.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.wrapper}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Image
                source={require("../assets/alpha-transparent.png")}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.title}>Alphaclara</Text>
              <Text style={styles.subtitle}>Welcome back</Text>
              <Text style={styles.tagline}>
                Access your AI-powered market intelligence.
              </Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={BRAND.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  importantForAutofill="yes"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    ref={passwordRef}
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor={BRAND.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={securePassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    importantForAutofill="yes"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />

                  <Pressable
                    onPress={() => setSecurePassword((v) => !v)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={securePassword ? "eye-outline" : "eye-off-outline"}
                      size={19}
                      color={BRAND.sub}
                    />
                  </Pressable>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotContainer}
                activeOpacity={0.75}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <AppButton
                title="Sign In"
                onPress={handleLogin}
                disabled={!canLogin}
                loading={loading}
                size="large"
                variant="primary"
                style={styles.signInButton}
              />

              <TouchableOpacity
                onPress={() => navigation.navigate("Signup")}
                activeOpacity={0.75}
              >
                <Text style={styles.link}>
                  Don’t have an account?{" "}
                  <Text style={styles.linkHighlight}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerWrap}>
              <Text style={styles.footerText}>
                By continuing, you agree to Alphaclara’s{" "}
                <Text
                  style={styles.footerLink}
                  onPress={() => navigation.navigate("TermsOfUseScreen")}
                >
                  Terms of Use
                </Text>{" "}
                and{" "}
                <Text
                  style={styles.footerLink}
                  onPress={() => navigation.navigate("PrivacyPolicy")}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
              <Text style={styles.disclaimer}>
                Alphaclara provides market insights for educational and
                informational purposes only. Not financial advice.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  wrapper: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingTop: 54,
    paddingBottom: 40,
  },

  header: {
    alignItems: "center",
    marginBottom: 20,
  },

  logo: {
    width: 72,
    height: 72,
    marginBottom: 8,
  },

  formCard: {
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 16,
  },

  fieldBlock: {
    marginBottom: 14,
  },

  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 14,
  },

  eyeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  forgotContainer: {
    alignItems: "flex-end",
    marginTop: -2,
    marginBottom: 12,
  },

  footerWrap: {
    marginTop: 22,
    paddingHorizontal: 10,
    alignItems: "center",
  },

  title: {
    color: BRAND.text,
    fontSize: 28,
    fontFamily: TYPO.extrabold,
    letterSpacing: 0.2,
  },

  subtitle: {
    color: BRAND.text,
    fontSize: 20,
    fontFamily: TYPO.bold,
    marginTop: 10,
  },

  tagline: {
    color: BRAND.muted,
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 10,
    fontFamily: TYPO.regular,
  },

  label: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.bold,
    marginBottom: 7,
  },

  input: {
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.semibold,
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.semibold,
  },

  forgotText: {
    color: BRAND.sub,
    fontSize: 13,
    fontFamily: TYPO.semibold,
  },
  link: {
    color: BRAND.sub,
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
    fontFamily: TYPO.medium,
  },

  linkHighlight: {
    color: BRAND.text,
    fontFamily: TYPO.bold,
  },

  footerText: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "center",
    fontFamily: TYPO.regular,
  },

  footerLink: {
    color: BRAND.text,
    fontFamily: TYPO.semibold,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
    opacity: 0.8,
    fontFamily: TYPO.regular,
  },
  signInButton: {
    marginTop: 4,
  },
});
