// screens/LoginScreen.js
import React, { useState } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // === HANDLE LOGIN ===
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing Info", "Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);

      // ✅ Firebase Auth login
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // ✅ Fetch profile from Firestore
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        await AsyncStorage.setItem(
          "profile_" + user.email,
          JSON.stringify(profileData)
        );
      }

      // ✅ Cache user session
      await AsyncStorage.setItem("userToken", user.email);
      navigation.replace("Main");
    } catch (error) {
      console.error("Login Error:", error);
      let message = "Unable to log in. Please try again.";
      if (error.code === "auth/user-not-found")
        message = "No user found with this email.";
      else if (error.code === "auth/wrong-password")
        message = "Incorrect password.";
      else if (error.code === "auth/invalid-email")
        message = "Invalid email address.";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  // === HANDLE PASSWORD RESET ===
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Input Required", "Please enter your email first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        "Password Reset Email Sent",
        "Check your inbox for a link to reset your password."
      );
    } catch (error) {
      console.error("Password Reset Error:", error);
      let message = "Unable to send reset email.";
      if (error.code === "auth/user-not-found")
        message = "No user found with this email.";
      else if (error.code === "auth/invalid-email")
        message = "Invalid email format.";
      Alert.alert("Error", message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* === LOGO + APP NAME === */}
      <View style={styles.header}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>AlphaWise</Text>
        <Text style={styles.subtitle}>Welcome Back</Text>
      </View>

      {/* === FORM INPUTS === */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* === FORGOT PASSWORD === */}
        <TouchableOpacity
          onPress={handleForgotPassword}
          style={styles.forgotContainer}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* === LOGIN BUTTON === */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Logging In..." : "Log In"}
          </Text>
        </TouchableOpacity>

        {/* === SIGNUP LINK === */}
        <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
          <Text style={styles.link}>
            Don’t have an account?{" "}
            <Text style={styles.linkHighlight}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// === STYLES ===
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: 40 },
  logo: { width: 70, height: 70, marginBottom: 8 },
  title: { color: "#00E396", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#9CA3AF", fontSize: 18, marginTop: 6 },
  form: { marginTop: 20 },
  input: {
    backgroundColor: "#111",
    color: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  forgotContainer: {
    alignItems: "flex-end",
    marginTop: -8,
    marginBottom: 12,
  },
  forgotText: {
    color: "#00E396",
    fontSize: 14,
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#00E396",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#000", fontWeight: "700", fontSize: 17 },
  link: { color: "#9CA3AF", textAlign: "center", marginTop: 22, fontSize: 15 },
  linkHighlight: { color: "#00E396", fontWeight: "600" },
});
