// screens/SignupScreen.js
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
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
  TouchableOpacity, // Added
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

import { auth, db } from "../firebaseConfig";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import AppButton from "../components/AppButton";
import { SafeAreaView } from "react-native-safe-area-context"; // Added

export default function SignupScreen({ navigation }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");

  const [securePassword, setSecurePassword] = useState(true);
  const [loading, setLoading] = useState(false);

  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const cleanEmail = email.trim().toLowerCase();

  const canSignup =
    firstName.trim() &&
    lastName.trim() &&
    cleanEmail &&
    password.length >= 6 &&
    !loading;

  const handleSignup = async () => {
    if (!canSignup) {
      Alert.alert("Incomplete Form", "Please fill all required fields.");
      return;
    }

    try {
      setLoading(true);
      Keyboard.dismiss();

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        bio,
        email: cleanEmail,
        createdAt: new Date().toISOString(),
      });

      await AsyncStorage.setItem("userToken", user.email);
      await AsyncStorage.setItem(
        "profile_" + user.email,
        JSON.stringify({ firstName, lastName, bio, email: cleanEmail }),
      );

      navigation.replace("Main");
    } catch (error) {
      console.warn("Signup failed:", error?.code);
      Alert.alert(
        "Signup Failed",
        "Unable to create account. Please try again.",
      );
    } finally {
      setLoading(false);
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
            contentContainerStyle={styles.wrapper}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <View style={styles.header}>
              <Image
                source={require("../assets/alpha-transparent.png")}
                style={styles.logo}
              />
              <Text style={styles.title}>Alphaclara</Text>
              <Text style={styles.subtitle}>Create account</Text>
              <Text style={styles.tagline}>
                Get started with AI-powered market intelligence.
              </Text>
            </View>

            {/* FORM */}
            <View style={styles.formCard}>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor={BRAND.muted}
                value={firstName}
                onChangeText={setFirstName}
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
              />

              <TextInput
                ref={lastNameRef}
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor={BRAND.muted}
                value={lastName}
                onChangeText={setLastName}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />

              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={BRAND.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              <View style={styles.passwordWrap}>
                <TextInput
                  ref={passwordRef}
                  style={styles.passwordInput}
                  placeholder="Password (min 6 chars)"
                  placeholderTextColor={BRAND.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={securePassword}
                  returnKeyType="done"
                />

                <Pressable onPress={() => setSecurePassword((v) => !v)}>
                  <Ionicons
                    name={securePassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={BRAND.sub}
                  />
                </Pressable>
              </View>

              <TextInput
                style={[styles.input, { height: 70 }]}
                placeholder="Short Bio (optional)"
                placeholderTextColor={BRAND.muted}
                value={bio}
                onChangeText={setBio}
                multiline
              />
              <AppButton
                title="Create Account"
                onPress={handleSignup}
                disabled={!canSignup}
                loading={loading}
                size="large"
                variant="primary"
                style={styles.createButton}
              />

              {/* Fixed Link */}
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.link}>
                  Already have an account?{" "}
                  <Text style={styles.linkHighlight}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>

            {/* FOOTER */}
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND.bg },
  screen: { flex: 1, backgroundColor: BRAND.bg },
  wrapper: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: { alignItems: "center", marginBottom: 20 },
  logo: { width: 70, height: 70 },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  footerWrap: { marginTop: 20, alignItems: "center" },
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
    marginTop: 8,
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
  input: {
    backgroundColor: BRAND.card2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: BRAND.text,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    fontSize: 15,
    fontFamily: TYPO.semibold,
  },
  passwordInput: {
    flex: 1,
    color: BRAND.text,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: TYPO.semibold,
  },
  createButton: {
    marginTop: 10,
  },
  link: {
    color: BRAND.sub,
    textAlign: "center",
    marginTop: 18,
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
});
