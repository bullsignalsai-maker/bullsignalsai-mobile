# BullSignalsAI – AI-Driven Insights Screen

## Overview
The **AI-Driven Insights Screen** transforms complex market analytics into a visually intuitive dashboard powered by AI.  
It provides real-time sentiment tracking, short-term predictions, and sector-wise comparisons — helping users make informed, confidence-based trading decisions.

---

## Purpose
To deliver an AI-powered “Market Mood Board” — summarizing where market sentiment is heading and why — through an engaging, animated experience.

---

## Core Features

| Component | Description |
|------------|-------------|
| **Sentiment Gauge** | Circular animated indicator showing overall market mood (Bullish, Neutral, Bearish). Includes glow pulse if sentiment ≥ 70%. |
| **7-Day Sentiment Trend** | Line chart showing AI-tracked daily sentiment progression. |
| **Next 24-Hour Forecast** | AI-generated short prediction in natural language (“+1.2% rise led by Tech”). |
| **Sector Sentiment Comparison** | Bar chart comparing confidence levels across key sectors — Tech, Energy, Finance, Healthcare. |
| **AI Highlights Ticker** | Animated ticker cycling through 3–4 concise AI insights (“Tech leads sentiment +2.3%”). |
| **Share Insight Button** | One-tap export for AI summary and forecast — easy for sharing on social platforms. |

---

## ⚙️ Technical Stack

- **Frontend Framework:** React Native (Expo)
- **Animation Engine:** React Native Animated API  
- **Charts:** react-native-chart-kit (LineChart & BarChart)
- **SVG Rendering:** react-native-svg
- **State Management:** useState / useEffect Hooks
- **Mock Data:** Placeholder JSON (to be replaced with real APIs)
- **Data Sources (Future):**
  - Grok API for market AI analysis  
  - Finnhub / X sentiment feeds  

---

## Data Flow Overview

```text
AI Engine (mock / live)
       ↓
 Sentiment Metrics → Gauge Animation
 Sector Data       → Bar Chart
 Weekly Forecast   → Line Chart
 Text Highlights   → Auto-scroll ticker
