// app.config.js
import "dotenv/config";

export default {
  expo: {
    name: "Alphaclara",
    slug: "bullsignalsai",
    owner: "bullsignalsai",
    scheme: "alphaclara",
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
      bundleIdentifier: "ai.alphaclara.app",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSPhotoLibraryUsageDescription: "Allow access to your photos to upload profile picture.",
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      package: "ai.alphaclara.app",           
    },

    web: {
      favicon: "./assets/favicon.png",
    },

    plugins: [
      "expo-secure-store",
      "expo-asset",
      "expo-notifications",
    ],

    updates: {
      url: "https://u.expo.dev/2bfff8b1-676c-461b-a991-ed884e800110",
    },

    runtimeVersion: {
      policy: "appVersion",
    },

    extra: {
      eas: {
        projectId: "2bfff8b1-676c-461b-a991-ed884e800110",
      },
    },
  },
};