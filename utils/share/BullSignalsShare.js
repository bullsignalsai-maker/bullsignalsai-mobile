import { Share, Alert } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Asset } from "expo-asset";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { BULLSIGNALS_DISCLAIMER } from "./disclaimers";
import { drawMultilineText } from "./pdfLayout";

export async function shareBullSignalsText({
  title,
  subtitle,
  body,
}) {
  const message = `
Alphaclara
AI-Powered Market Intelligence

${title}
${subtitle ? subtitle + "\n" : ""}
${body}

${BULLSIGNALS_DISCLAIMER}
`;

  await Share.share({
    title: "Alphaclara Analysis",
    message,
  });
}

export async function shareBullSignalsPDF({
  title,
  subtitle,
  sections = [], // [{ label, text }]
}) {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const bullGreen = rgb(0, 0.89, 0.59);
    const bg = rgb(0.05, 0.05, 0.05);
    const text = rgb(0.85, 0.85, 0.85);
    const white = rgb(1, 1, 1);

    // === Background ===
    page.drawRectangle({ x: 0, y: 0, width, height, color: bg });

    // === Header ===
    page.drawRectangle({
      x: 0,
      y: height - 80,
      width,
      height: 80,
      color: bullGreen,
    });

    page.drawText("Alphaclara", {
      x: 40,
      y: height - 50,
      size: 26,
      color: white,
    });

    page.drawText("AI-Powered Market Analysis", {
      x: 40,
      y: height - 70,
      size: 12,
      color: white,
    });

    // === Logo ===
    const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
    await logoAsset.downloadAsync();
    const logoBase64 = await FileSystem.readAsStringAsync(
      logoAsset.localUri,
      { encoding: "base64" }
    );
    const logoImage = await pdfDoc.embedPng(
      Uint8Array.from(atob(logoBase64), c => c.charCodeAt(0))
    );
    const logoDims = logoImage.scale(0.15);
    page.drawImage(logoImage, {
      x: width - logoDims.width - 40,
      y: height - 65,
      width: logoDims.width,
      height: logoDims.height,
    });

    let y = height - 120;

    // === Title ===
    page.drawText(title, { x: 40, y, size: 18, color: bullGreen });
    y -= 20;

    if (subtitle) {
      page.drawText(subtitle, { x: 40, y, size: 12, color: text });
      y -= 20;
    }

    // === Sections ===
    sections.forEach(({ label, text: content }) => {
      page.drawText(label, {
        x: 40,
        y,
        size: 14,
        color: bullGreen,
      });
      y -= 18;

      y = drawMultilineText(
        page,
        content || "Not available",
        font,
        12,
        40,
        y,
        width - 80,
        text
      );

      y -= 24;
    });

    // === Disclaimer ===
    y -= 10;
    page.drawLine({
      start: { x: 40, y },
      end: { x: width - 40, y },
      thickness: 0.5,
      color: bullGreen,
    });
    y -= 14;

    drawMultilineText(
      page,
      BULLSIGNALS_DISCLAIMER,
      font,
      9,
      40,
      y,
      width - 80,
      text
    );

    // === Save & Share ===
    const pdfBytes = await pdfDoc.save();
    const uri = FileSystem.cacheDirectory + "bullsignals-analysis.pdf";
    await FileSystem.writeAsStringAsync(
      uri,
      Buffer.from(pdfBytes).toString("base64"),
      { encoding: FileSystem.EncodingType.Base64 }
    );

    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share Alphaclara Analysis",
    });
  } catch (e) {
    console.warn("PDF failed, fallback to text:", e.message);
    Alert.alert("Share failed", "Sharing as text instead.");
  }
}
