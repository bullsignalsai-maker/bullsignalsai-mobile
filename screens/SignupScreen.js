// screens/SignupScreen.js
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
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default function SignupScreen({ navigation }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState({});

  const validateInputs = () => {
    const newErrors = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email))
      newErrors.email = "Invalid email format";
    if (!password.trim()) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateInputs()) {
      Alert.alert("Validation Error", "Please correct highlighted fields.");
      return;
    }

    try {
      // ✅ Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // ✅ Store profile in Firestore
      await setDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        bio,
        email,
        createdAt: new Date().toISOString(),
      });

      // ✅ Cache locally
      await AsyncStorage.setItem("userToken", user.email);
      await AsyncStorage.setItem(
        "profile_" + user.email,
        JSON.stringify({ firstName, lastName, bio, email })
      );

      Alert.alert("Success", "Account created successfully. Please log in.");
      navigation.navigate("Login");
    } catch (error) {
      console.error("Signup Error:", error);
      let msg = "Signup failed. Try again later.";
      if (error.code === "auth/email-already-in-use")
        msg = "Email already registered.";
      else if (error.code === "auth/invalid-email")
        msg = "Invalid email address.";
      else if (error.code === "auth/weak-password")
        msg = "Password too weak.";
      Alert.alert("Error", msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* LOGO + TITLE */}
        <View style={styles.header}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join Alphaclara and stay ahead with AI-powered market insights.
          </Text>
        </View>

        {/* INPUTS */}
        <View style={styles.form}>
          <TextInput
            style={[styles.input, errors.firstName && styles.inputError]}
            placeholder="First Name"
            placeholderTextColor="#666"
            value={firstName}
            onChangeText={setFirstName}
          />
          {errors.firstName && (
            <Text style={styles.errorText}>{errors.firstName}</Text>
          )}

          <TextInput
            style={[styles.input, errors.lastName && styles.inputError]}
            placeholder="Last Name"
            placeholderTextColor="#666"
            value={lastName}
            onChangeText={setLastName}
          />
          {errors.lastName && (
            <Text style={styles.errorText}>{errors.lastName}</Text>
          )}

          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {errors.password && (
            <Text style={styles.errorText}>{errors.password}</Text>
          )}

          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Short Bio (Optional)"
            placeholderTextColor="#666"
            value={bio}
            onChangeText={setBio}
            multiline
          />
        </View>

        {/* SIGN UP BUTTON */}
        <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>

        {/* FOOTER LINK */}
        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
          <Text style={styles.link}>Already have an account? Log In</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#000" },
  container: {
    flexGrow: 1,
    backgroundColor: "#000",
    padding: 20,
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: 20 },
  logo: { width: 80, height: 80, marginBottom: 10 },
  title: { color: "#00E396", fontSize: 28, fontWeight: "bold" },
  subtitle: {
    color: "#A3A3A3",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  form: { marginTop: 20 },
  input: {
    backgroundColor: "#111",
    color: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  inputError: { borderColor: "#EF4444" },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 4,
  },
  button: {
    backgroundColor: "#00E396",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  link: {
    color: "#00E396",
    textAlign: "center",
    marginTop: 20,
    fontSize: 15,
  },
});
