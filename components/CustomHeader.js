import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

export default function CustomHeader({ title }) {
  const navigation = useNavigation();

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back-outline" size={24} color="#00E396" />
      </TouchableOpacity>

      <View style={styles.centerContainer}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Alphaclara</Text>
      </View>

      <Text style={styles.pageTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#000",
    paddingTop: 55,
    paddingBottom: 20,
    borderBottomColor: "#1F2937",
    borderBottomWidth: 1,
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 58,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  centerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 6,
  },
  appName: {
    color: "#00E396",
    fontSize: 20,
    fontWeight: "700",
  },
  pageTitle: {
    color: "#9CA3AF",
    fontSize: 14,
    letterSpacing: 0.6,
  },
});
