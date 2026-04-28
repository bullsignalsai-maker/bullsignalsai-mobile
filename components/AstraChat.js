// components/AstraChat.js

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { askAstra as askAstraService } from "../services/astraService";

export default function AstraChat({ visible, onClose, portfolioData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [askedIds, setAskedIds] = useState([]); // which predefined questions already used
  const [suggestedFollowups, setSuggestedFollowups] = useState([]);
  const scrollRef = useRef(null);

  
  // -----------------------------------------------------
// DYNAMIC QUESTION BUILDER (based on portfolio size)
// -----------------------------------------------------
const buildAllChips = () => {
  const isStockDetailMode = portfolioData?.contextType === "stock_detail";
  const stockSymbol = portfolioData?.symbol || "this stock";

  if (isStockDetailMode) {
    return [
      { id: "stock_explain", label: `Explain ${stockSymbol}` },
      { id: "decision_explain", label: `Why is ${stockSymbol} rated this way?` },
      { id: "pattern_explain", label: `Explain ${stockSymbol} pattern` },
      { id: "technical_explain", label: `Explain ${stockSymbol} technicals` },
      { id: "risk_explain", label: `What is the biggest risk?` },
    ];
  }

  const p = portfolioData?.positions || [];
  const count = p.length;

  const base = [
    { id: "overview", label: "Portfolio overview" },
    { id: "risk_exposure", label: "Risk exposure" },
    { id: "overweight", label: "Overweight / underweight?" },
    { id: "worst", label: "Which positions need attention?" },
    { id: "ai_suggestions", label: "Rebalancing suggestions" },
  ];

  if (count === 0) return base;

  if (count === 1) {
    const s = p[0].symbol;
    return [
      ...base,
      { id: "explain_single", label: `Explain ${s}` },
      { id: "why_moves", label: `Why does ${s} move my portfolio?` },
    ];
  }

  if (count === 2) {
    const a = p[0].symbol;
    const b = p[1].symbol;
    return [
      ...base,
      { id: "explain_two", label: `Explain ${a} and ${b}` },
      { id: "compare_two", label: `Compare ${a} vs ${b}` },
      { id: "leader", label: "Which stock leads performance?" },
    ];
  }

  // 3 or more holdings
  return [
    ...base,
    { id: "top3_explain", label: "Explain top 3 holdings" },
    { id: "compare_top3", label: "Compare top 3 holdings" },
    { id: "leader", label: "Which stock contributes most?" },
  ];
};

// All chips dynamically
const allChips = buildAllChips();

// First-time starter chips = first 3 of dynamic list
const starterChips = allChips.slice(0, 3);
const starterIds = new Set(starterChips.map((c) => c.id));


  const hasAsked = askedIds.length > 0;
  const askedSet = new Set(askedIds);
  const remainingChips = allChips.filter((c) => !askedSet.has(c.id));
  const moreChips = remainingChips.filter((c) => !starterIds.has(c.id));


  const scrollToEnd = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 30);
  };
const makeId = (suffix) =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${suffix}`;
  // Reset Astra every time it is opened
  useEffect(() => {
    if (visible) {
      setMessages([
        {
          id: "welcome",
          from: "astra",
          text:
  portfolioData?.contextType === "stock_detail"
    ? `Ask Astra anything about ${portfolioData?.symbol || "this stock"} — signal, pattern, technicals, risks, or what could change.`
    : "Meet Astra — your AI co-pilot that monitors your holdings and explains what matters in clear, simple language. Select a quick question below or ask anything.",
        },
      ]);
      setInput("");
      setAskedIds([]);
      setSuggestedFollowups([]);
    }
  }, [visible]);

  // Core ask logic → calls /astra-chat
  const askAstra = async ({ question_id = null, question_text = null }) => {
    const isStockDetailMode = portfolioData?.contextType === "stock_detail";

    if (
      !isStockDetailMode &&
      (!portfolioData ||
        !portfolioData.positions ||
        portfolioData.positions.length === 0)
    ) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId("err"),
          from: "astra",
          text:
            "Add at least one stock to your portfolio so I can analyze performance, risk, and trends.",
        },
      ]);
      scrollToEnd();
      return;
    }

    const label =
      question_text ||
      allChips.find((x) => x.id === question_id)?.label ||
      "Question";

    if (question_id) {
      setAskedIds((prev) =>
        prev.includes(question_id) ? prev : [...prev, question_id]
      );
    }

    const userMsg = {
      id: makeId("user"),
      from: "user",
      text: label,
    };

    // user bubble + immediate typing dots
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: makeId("typing"), from: "typing", text: "" },
    ]);
    setInput("");
    scrollToEnd();
    setLoading(true);

    try {
  const chatHistory = messages
    .filter((m) => m.from === "user" || m.from === "astra")
    .slice(-6)
    .map((m) => ({
      role: m.from === "user" ? "user" : "assistant",
      text: m.text,
    }));

  const result = await askAstraService({
    ...portfolioData,
    question_id,
    question: question_text || label,
    chat_history: chatHistory,
  });

  setMessages((prev) => [
  ...prev.filter((m) => m.from !== "typing"),
    {
    id: makeId("astra"),
    from: "astra",
    text: result.answer,
    cards: result.cards || [],
  },
]);

setSuggestedFollowups(result.suggestedFollowups || []);

scrollToEnd();
} catch (err) {
  console.log("AstraChat error:", err);

  setMessages((prev) => [
    ...prev.filter((m) => m.from !== "typing"),
    {
      id: makeId("err"),
      from: "astra",
      text: "I couldn't reach Astra right now. Please try again shortly.",
    },
  ]);

  scrollToEnd();
} finally {
  setLoading(false);
}
  };

  const sendCustom = () => {
    const text = input.trim();
    if (!text) return;
    Keyboard.dismiss();
    askAstra({ question_text: text });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Pressable style={styles.bgTouch} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={70}
        >
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.avatar}>
                  <Ionicons name="aperture" size={35} color="#00E396" />
                </View>

                <View>
                  <Text style={styles.astraTitle}>Astra</Text>
                  <Text style={styles.astraTagline}>
                    Artificial Stock Trading & Risk Analyst
                  </Text>
                </View>
              </View>

              <Pressable onPress={onClose}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Messages + starter chips */}
            <View style={styles.messagesBox}>
              <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                onContentSizeChange={scrollToEnd}
              >
                {messages.map((m) =>
                  m.from === "user" ? (
                    <View key={m.id} style={styles.userBubble}>
                      <Text style={styles.userText}>{m.text}</Text>
                    </View>
                  ) : m.from === "typing" ? (
                    <View key={m.id} style={styles.typingBubble}>
                      <View style={styles.dotsRow}>
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                      </View>
                    </View>
                  ) : (
                    <View key={m.id} style={styles.botBubble}>
                    <Text style={styles.botText}>{m.text}</Text>

                    {Array.isArray(m.cards) && m.cards.length > 0 && (
                      <View style={styles.answerCardsWrap}>
                        {m.cards.map((card, idx) => (
                          <View key={`${m.id}-card-${idx}`} style={styles.answerCard}>
                            <Text style={styles.answerCardTitle}>{card.title}</Text>
                            <Text style={styles.answerCardValue}>{card.value}</Text>
                            {!!card.subtitle && (
                              <Text style={styles.answerCardSubtitle}>{card.subtitle}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  )
                )}

                {!hasAsked && (
                  <View style={styles.starterBlock}>
                    <Text style={styles.starterHeader}>Quick questions</Text>
                    <View style={styles.starterChipColumn}>
                      {starterChips.map((c) => (
                        <Pressable
                          key={c.id}
                          style={({ pressed }) => [
                            styles.starterChip,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() =>
                            askAstra({ question_id: c.id, question_text: c.label })
                          }
                        >
                          <Ionicons
                            name="sparkles-outline"
                            size={14}
                            color="#FBBF24"
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.starterChipText}>{c.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* More insights after first question */}
            {hasAsked && suggestedFollowups.length === 0 && moreChips.length > 0 && (
              <>
                <Text style={styles.promptHeader}>More insights</Text>
                <View style={styles.chipColumn}>
                  {moreChips.map((q) => (
                    <Pressable
                      key={q.id}
                      style={({ pressed }) => [
                        styles.chip,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() =>
                        askAstra({ question_id: q.id, question_text: q.label })
                      }
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={14}
                        color="#FBBF24"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.chipText}>{q.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {suggestedFollowups.length > 0 && (
              <>
                <Text style={styles.promptHeader}>Suggested follow-ups</Text>

                <View style={styles.chipColumn}>
                  {suggestedFollowups.slice(0, 2).map((q, idx) => (
                    <Pressable
                      key={`followup-${idx}-${q}`}
                      style={({ pressed }) => [
                        styles.chip,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => askAstra({ question_text: q })}
                    >
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={14}
                        color="#00E396"
                        style={{ marginRight: 6 }}
                      />

                      <Text style={styles.chipText}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {/* Input */}
            <Text style={styles.disclaimerText}>
              Astra provides educational AI insights only, not personal financial advice.
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask Astra anything..."
                placeholderTextColor="#6B7280"
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendCustom}
                returnKeyType="send"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={sendCustom}
              >
                <Ionicons name="send" size={16} color="#000" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// STYLES
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  bgTouch: { flex: 1 },

  card: {
    backgroundColor: "#020617",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: "#1F2937",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    height: "92%",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0B1120",
    borderWidth: 1.5,
    borderColor: "#0B1120",
    justifyContent: "center",
    alignItems: "center",
  },

  astraTitle: {
    color: "#00E396",
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: 1.8,
    fontFamily:
      Platform.OS === "ios"
        ? "HelveticaNeue-CondensedBlack"
        : "RobotoCondensed-Bold",
  },

  astraTagline: {
    color: "#9CA3AF",
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 0.8,
    marginTop: -1,
    fontFamily:
      Platform.OS === "ios" ? "HelveticaNeue-Medium" : "Roboto-Medium",
  },

  messagesBox: {
    flex: 1,
    marginTop: 6,
    marginBottom: 8,
    minHeight: 80,
  },
  scroll: { flexGrow: 0 },

  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#00E396",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    marginVertical: 4,
    maxWidth: "80%",
  },
  userText: { color: "#052e16", fontWeight: "600", fontSize: 12 },

  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1F2937",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    marginVertical: 4,
    maxWidth: "90%",
  },
  botText: { color: "#E5E7EB", fontSize: 12, lineHeight: 17 },

  typingBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#0B1120",
    borderColor: "#1F2937",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 6,
  },
  dotsRow: { flexDirection: "row", gap: 4 },
  dot: { width: 5, height: 5, backgroundColor: "#9CA3AF", borderRadius: 3 },

  starterBlock: {
    marginTop: 10,
  },
  starterHeader: {
    color: "#9CA3AF",
    fontSize: 11,
    marginBottom: 6,
  },
  starterChipColumn: {
    marginBottom: 8,
  },
  starterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 6,
  },
  starterChipText: {
    color: "#E5E7EB",
    fontSize: 12,
  },

  promptHeader: {
    color: "#9CA3AF",
    fontSize: 11,
    marginBottom: 6,
  },
  chipColumn: {
    marginBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 6,
  },
  chipText: { color: "#E5E7EB", fontSize: 11 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  input: {
    flex: 1,
    backgroundColor: "#020617",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1F2937",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#E5E7EB",
    fontSize: 12,
    marginRight: 8,
  },
  sendBtn: {
    width: 34,
    height: 34,
    backgroundColor: "#00E396",
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  disclaimerText: {
  color: "#6B7280",
  fontSize: 10.5,
  lineHeight: 14,
  textAlign: "center",
  marginBottom: 4,
},
answerCardsWrap: {
  marginTop: 8,
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8,
},

answerCard: {
  width: "48%",
  backgroundColor: "#020617",
  borderWidth: 1,
  borderColor: "#1F2937",
  borderRadius: 12,
  paddingHorizontal: 9,
  paddingVertical: 8,
},

answerCardTitle: {
  color: "#9CA3AF",
  fontSize: 10.5,
  marginBottom: 3,
},

answerCardValue: {
  color: "#00E396",
  fontSize: 13,
  fontWeight: "800",
},

answerCardSubtitle: {
  color: "#E5E7EB",
  fontSize: 10.5,
  lineHeight: 14,
  marginTop: 3,
},
});
