// screens/NewsDetailScreen.js
import React, { useEffect, useState } from "react";
import {
 View,
 Text,
 StyleSheet,
 ScrollView,
 ActivityIndicator,
 TouchableOpacity,
 Share,
 Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCachedNewsAnalysis, saveCachedNewsAnalysis } from "../firebaseConfig";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as FileSystem from "expo-file-system/legacy"; // ← LEGACY API (supports readAsStringAsync)
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { decode } from "base-64";


const atob = (str) => decode(str);


export default function NewsDetailScreen({ route }) {
 const { item } = route.params || {};
 const [fullArticle, setFullArticle] = useState("");
 const [aiData, setAiData] = useState(null);
 const [expanded, setExpanded] = useState(false);
 const [loading, setLoading] = useState(true);


 const GROK_API_KEY = process.env.EXPO_PUBLIC_GROK_API_KEY;


 // === Fetch Full Article ===
 const fetchFullArticle = async () => {
   if (!item?.link) return "Full article not available.";
   try {
     const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(item.link)}`;
     const res = await fetch(proxy);
     if (!res.ok) throw new Error();
     const html = await res.text();
     const clean = html
       .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
       .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
       .replace(/<[^>]*>/g, " ")
       .replace(/&nbsp;/g, " ")
       .replace(/&amp;/g, "&")
       .replace(/\s+/g, " ")
       .trim();
     return clean.slice(0, 2000);
   } catch {
     return item.summary || "Unable to load.";
   }
 };


 // === Grok AI – SAFE JSON + Fast ===
 const callGrok = async (text) => {
   if (!GROK_API_KEY) return null;


   try {
     const prompt = `You are a trading analyst. Reply ONLY with valid JSON in this exact structure. Be concise.


News: "${item.headline}" - ${text.slice(0, 1000)}


{
 "summary": "3 lines: what happened?",
 "impact": "3 lines: company/sector/market",
 "tradeIdea": "Long/short + entry/target/stop"
}`;


     const res = await fetch("https://api.x.ai/v1/chat/completions", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${GROK_API_KEY}`,
       },
       body: JSON.stringify({
         model: "grok-4-fast",
         messages: [{ role: "user", content: prompt }],
         temperature: 0.2,
         max_tokens: 300,
         response_format: { type: "json_object" },
       }),
     });


     if (!res.ok) throw new Error();


     const data = await res.json();
     const content = data.choices[0].message.content;
     const jsonMatch = content.match(/\{[\s\S]*\}/);
     if (!jsonMatch) throw new Error("No JSON");


     return JSON.parse(jsonMatch[0]);
   } catch (err) {
     console.warn("Grok failed (using fallback):", err.message);
     return null;
   }
 };


 useEffect(() => {
   if (item) {
     (async () => {
       setLoading(true);


       const article = await fetchFullArticle();
       setFullArticle(article);


       const hash = simpleHash(item.headline);
       const cached = await getCachedNewsAnalysis(hash);
       let analysis = cached;


       if (!analysis) {
         analysis = await callGrok(article);
         if (analysis) await saveCachedNewsAnalysis(hash, analysis);
       }


       if (analysis && typeof analysis.impact === "object") {
         analysis.impact = Object.values(analysis.impact).join("\n");
       }


       setAiData(analysis || {
         summary: "AI analysis unavailable.",
         impact: "No market impact data.",
         tradeIdea: "Hold position.",
       });


       setLoading(false);
     })();
   }
 }, [item]);


 // === TEXT SHARE (existing) ===
 const handleTextShare = async () => {
   try {
     await Share.share({
       title: item.headline,
       message: `${item.headline}\n\nAI Summary: ${aiData.summary}\n\nBullSignalsAI`,
     });
   } catch {}
 };


 // === PDF SHARE – 100% WORKING (Legacy API + No Errors) ===
const handlePDFShare = async () => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 portrait
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.setFont(font);

    // === THEME COLORS ===
    const bullGreen = rgb(0, 0.89, 0.59);
    const darkGray = rgb(0.07, 0.07, 0.07);
    const lightGray = rgb(0.85, 0.85, 0.85);
    const white = rgb(1, 1, 1);

    // === BACKGROUND ===
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: darkGray,
    });

    // === HEADER BAR ===
    page.drawRectangle({
      x: 0,
      y: height - 80,
      width,
      height: 80,
      color: bullGreen,
    });

    // === TITLE ===
    const title = "BullSignalsAI";
    const titleSize = 28;
    const titleWidth = font.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
      x: width / 2 - titleWidth / 2,
      y: height - 50,
      size: titleSize,
      color: white,
    });

    // === LOGO (Top Right) ===
    const logoAsset = Asset.fromModule(require("../assets/logo.png"));
    await logoAsset.downloadAsync();
    const logoUri = logoAsset.localUri;
    const logoBase64 = await FileSystem.readAsStringAsync(logoUri, { encoding: "base64" });
    const logoBytes = Uint8Array.from(atob(logoBase64), c => c.charCodeAt(0));
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImage.scale(0.15);
    page.drawImage(logoImage, {
      x: width - logoDims.width - 40,
      y: height - 70,
      width: logoDims.width,
      height: logoDims.height,
    });

    let y = height - 120;

    // === SECTION DRAWER ===
    const drawSection = (label, text) => {
      page.drawText(label + ":", {
        x: 50,
        y,
        size: 14,
        color: bullGreen,
      });
      y -= 20;
      y = drawMultilineText(page, text || "Not available", font, 12, 50, y, width - 100, lightGray);
      y -= 25;
      page.drawLine({
        start: { x: 50, y },
        end: { x: width - 50, y },
        thickness: 0.4,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 25;
    };

    // === CONTENT ===
    drawSection("Headline", item.headline || "No headline");
    drawSection("AI Summary", aiData.summary);
    drawSection("Market Impact", aiData.impact);
    drawSection("Trade Idea", aiData.tradeIdea);

    // === FOOTER ===
    page.drawLine({
      start: { x: 50, y: 70 },
      end: { x: width - 50, y: 70 },
      thickness: 0.5,
      color: bullGreen,
    });

    const footerText = "Powered by BullSignalsAI";
    const footerWidth = font.widthOfTextAtSize(footerText, 10);
    page.drawText(footerText, {
      x: width / 2 - footerWidth / 2,
      y: 50,
      size: 10,
      color: lightGray,
    });

    // === SAVE PDF ===
    const pdfBytes = await pdfDoc.save();
    const binary = String.fromCharCode(...pdfBytes);
    const pdfBase64 = btoa(binary);

    const uri = FileSystem.cacheDirectory + "bullsignals-insight.pdf";
    await FileSystem.writeAsStringAsync(uri, pdfBase64, { encoding: "base64" });

    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share AI Insight",
    });
  } catch (err) {
    console.warn("PDF failed:", err.message);
    Alert.alert("PDF Failed", "Sharing as text instead.");
    handleTextShare();
  }
};


if (!item) return <Text style={styles.error}>No article.</Text>;

 return (
   <ScrollView style={styles.container}>
     <View style={styles.header}>
       <Text style={styles.source}>BullsignalsAI • {item.timeAgo}</Text>
       <TouchableOpacity onPress={handlePDFShare} style={styles.shareBtn}>
         <Ionicons name="share-social" size={20} color="#00E396" />
         <Text style={styles.shareText}>PDF</Text>
       </TouchableOpacity>
     </View>


     <Text style={styles.title}>{item.headline}</Text>


     {loading ? (
       <View style={styles.card}>
         <ActivityIndicator size="small" color="#00E396" />
       </View>
     ) : (
       <>
         <View style={styles.card}>
           <Text style={styles.cardTitle}>AI Summary</Text>
           <Text style={styles.cardText}>{aiData.summary}</Text>
         </View>


         <View style={styles.card}>
           <Text style={styles.cardTitle}>Market Impact</Text>
           <Text style={styles.cardText}>{aiData.impact}</Text>
         </View>
       </>
     )}


     <Text style={styles.footer}>
       Powered by <Text style={styles.brand}>BullSignalsAI</Text>
     </Text>


     <View style={{ height: 80 }} />
   </ScrollView>
 );
}

function drawMultilineText(page, text, font, size, x, y, maxWidth, color) {
  if (!text) return y;
  const lineHeight = size + 4;
  const words = text.replace(/\n+/g, " ").split(" ");
  let line = "";

  words.forEach(word => {
    const testLine = line + word + " ";
    const testWidth = font.widthOfTextAtSize(testLine, size);
    if (testWidth > maxWidth && line !== "") {
      page.drawText(line.trim(), { x, y, size, color });
      y -= lineHeight;
      line = word + " ";
    } else {
      line = testLine;
    }
  });

  if (line.trim() !== "") {
    page.drawText(line.trim(), { x, y, size, color });
    y -= lineHeight;
  }

  return y;
}
function drawCardSection(page, label, content, font, size, width, y, accent, textColor) {
  const padding = 12;
  const cardHeight = 10;
  const startY = y - padding;

  // Section label
  page.drawText(label + ":", { x: 50, y, size: 14, color: accent });
  y -= 18;

  // Background “card”
  page.drawRectangle({
    x: 40,
    y: y - 6,
    width: width - 80,
    height: 120,
    color: rgb(0.1, 0.1, 0.1),
    borderColor: rgb(0.15, 0.15, 0.15),
    borderWidth: 0.5,
  });

  y -= 16;
  y = drawMultilineText(page, content, font, size, 55, y + 100, width - 100, textColor);
  return y - 30;
}


// === Hash Helper ===
function simpleHash(str) {
 let hash = 0;
 str = str || "";
 for (let i = 0; i < str.length; i++) {
   hash = ((hash << 5) - hash) + str.charCodeAt(i);
   hash = hash & hash;
 }
 return Math.abs(hash).toString(36).slice(0, 10);
}


const styles = StyleSheet.create({
 container: { flex: 1, backgroundColor: "#000", paddingHorizontal: 20, paddingTop: 20 },
 header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
 source: { color: "#9CA3AF", fontSize: 13 },
 title: { color: "#FFF", fontSize: 24, fontWeight: "700", lineHeight: 32, marginBottom: 16 },
 card: { backgroundColor: "#111827", padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "#1F2937" },
 cardTitle: { color: "#00E396", fontSize: 16, fontWeight: "600", marginBottom: 6 },
 cardText: { color: "#E5E7EB", fontSize: 15, lineHeight: 22 },
 shareBtn: { flexDirection: "row", alignItems: "center", padding: 6 },
 shareText: { color: "#00E396", fontSize: 13, marginLeft: 4 },
 footer: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 20 },
 brand: { color: "#00E396", fontWeight: "600" },
 error: { color: "#EF4444", textAlign: "center", marginTop: 50 },
});

