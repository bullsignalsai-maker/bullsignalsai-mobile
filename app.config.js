// app.config.js
import "dotenv/config";

export default {
  expo: {
    name: "BullSignalsAI",
    slug: "bullsignalsai",
    owner: "bullsignalsai",
    scheme: "bullsignalsai",  // ✅ REQUIRED FOR DEV CLIENT LAN MODE
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",

    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000",
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.anonymous.BullSignalsAI",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      package: "com.anonymous.BullSignalsAI",
    },

    web: {
      favicon: "./assets/favicon.png",
    },

    plugins: [
      "expo-secure-store",
      "expo-asset",
      "expo-notifications",
    ],

    extra: {
      eas: {
        projectId: "2bfff8b1-676c-461b-a991-ed884e800110",
      },
    },
  },
};
