// utils/share/BullSignalsPDF.js

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { decode } from "base-64";

const atob = (str) => decode(str);

export async function shareBullSignalsPDF({
  title = "Alphaclara",
  subtitle = "AI-Driven Market Intelligence",
  sections = [],
  filename = "bullsignals-analysis.pdf",
}) {
  // ================== INIT ==================
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.setFont(font);

  // ================== COLORS ==================
  const bullGreen = rgb(0, 0.89, 0.59);
  const darkBg = rgb(0.06, 0.07, 0.09);
  const cardBg = rgb(0.1, 0.12, 0.16);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const white = rgb(1, 1, 1);

  // ================== BACKGROUND ==================
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: darkBg,
  });

  // ================== HEADER ==================
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: bullGreen,
  });

  // Title
  const titleSize = 26;
  const titleWidth = font.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: width / 2 - titleWidth / 2,
    y: height - 54,
    size: titleSize,
    color: white,
  });

  // Subtitle
  if (subtitle) {
    const subSize = 12;
    const subWidth = font.widthOfTextAtSize(subtitle, subSize);
    page.drawText(subtitle, {
      x: width / 2 - subWidth / 2,
      y: height - 72,
      size: subSize,
      color: rgb(0.95, 0.97, 0.96),
    });
  }

  // ================== LOGO ==================
  const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
  await logoAsset.downloadAsync();
  const logoBase64 = await FileSystem.readAsStringAsync(logoAsset.localUri, {
    encoding: "base64",
  });
  const logoBytes = Uint8Array.from(atob(logoBase64), (c) => c.charCodeAt(0));
  const logoImage = await pdfDoc.embedPng(logoBytes);
  const logoDims = logoImage.scale(0.15);

  page.drawImage(logoImage, {
    x: width - logoDims.width - 36,
    y: height - 78,
    width: logoDims.width,
    height: logoDims.height,
  });

  // ================== CONTENT ==================
  let y = height - 120;

  const drawWrappedText = (text, x, maxWidth, size = 13) => {
    const lineHeight = size + 4;
    const words = String(text || "—")
      .replace(/\n+/g, " ")
      .split(" ");
    let line = "";

    words.forEach((word) => {
      const testLine = line + word + " ";
      if (font.widthOfTextAtSize(testLine, size) > maxWidth && line !== "") {
        page.drawText(line.trim(), { x, y, size, color: lightGray });
        y -= lineHeight;
        line = word + " ";
      } else {
        line = testLine;
      }
    });

    if (line.trim()) {
      page.drawText(line.trim(), { x, y, size, color: lightGray });
      y -= lineHeight;
    }
  };

  const drawSectionCard = (label, value) => {
    const cardHeight = 80;

    page.drawRectangle({
      x: 40,
      y: y - cardHeight + 10,
      width: width - 80,
      height: cardHeight,
      color: cardBg,
      borderColor: bullGreen,
      borderWidth: 0.6,
    });

    page.drawText(label.toUpperCase(), {
      x: 50,
      y,
      size: 11,
      color: bullGreen,
    });

    y -= 18;
    drawWrappedText(value, 50, width - 100, 13);
    y -= 28;
  };

  for (const s of sections) {
    drawSectionCard(s.label, s.text || "—");
  }

  // ================== FOOTER ==================
  page.drawLine({
    start: { x: 40, y: 80 },
    end: { x: width - 40, y: 80 },
    thickness: 0.6,
    color: bullGreen,
  });

  page.drawText(
    "Educational purposes only. Not investment advice. Markets involve risk.\n© Alphaclara",
    {
      x: 50,
      y: 48,
      size: 9,
      color: lightGray,
      lineHeight: 12,
    }
  );

  // ================== SAVE & SHARE ==================
  const pdfBytes = await pdfDoc.save();
  const base64 = btoa(String.fromCharCode(...pdfBytes));
  const uri = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: "base64",
  });

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Share Alphaclara Analysis",
  });
}
