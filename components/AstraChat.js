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
import AstraAnimatedIcon from "../components/AstraAnimatedIcon";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

export default function AstraChat({ visible, onClose, portfolioData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [askedIds, setAskedIds] = useState([]);
  const [suggestedFollowups, setSuggestedFollowups] = useState([]);
  const scrollRef = useRef(null);

  const makeId = (suffix) =>
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${suffix}`;

  const buildAllChips = () => {
    const isMarketMode = portfolioData?.contextType === "market";
    const isStockDetailMode = portfolioData?.contextType === "stock_detail";

    if (isMarketMode) {
      return [
        { id: "market_pulse", label: "Explain today’s market pulse" },
        { id: "market_risk", label: "What is market risk now?" },
        { id: "spy_qqq", label: "What are SPY and QQQ showing?" },
        { id: "crypto_commodities", label: "Crypto and commodities view" },
        { id: "market_news", label: "Summarize market news" },
        { id: "market_movers", label: "Explain top movers" },
      ];
    }

    if (isStockDetailMode) {
      const stockSymbol = portfolioData?.symbol || "this stock";
      return [
        { id: "stock_explain", label: `Explain ${stockSymbol}` },
        { id: "decision_explain", label: `Why this rating?` },
        { id: "pattern_explain", label: `Explain the pattern` },
        { id: "technical_explain", label: `Explain technicals` },
        { id: "risk_explain", label: `Biggest risk?` },
      ];
    }

    const p = portfolioData?.positions || [];
    const count = p.length;

    const base = [
      { id: "overview", label: "Portfolio overview" },
      { id: "risk_exposure", label: "Risk exposure" },
      { id: "overweight", label: "Overweight / underweight?" },
      { id: "worst", label: "Positions needing attention" },
      { id: "ai_suggestions", label: "Rebalancing context" },
    ];

    if (count === 1) {
      const s = p[0].symbol;
      return [...base, { id: "explain_single", label: `Explain ${s}` }];
    }

    if (count === 2) {
      const a = p[0].symbol;
      const b = p[1].symbol;
      return [
        ...base,
        { id: "compare_two", label: `Compare ${a} vs ${b}` },
        { id: "leader", label: "Which leads performance?" },
      ];
    }

    if (count >= 3) {
      return [
        ...base,
        { id: "top3_explain", label: "Explain top holdings" },
        { id: "compare_top3", label: "Compare top holdings" },
        { id: "leader", label: "Main performance driver" },
      ];
    }

    return base;
  };

  const allChips = buildAllChips();
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

  useEffect(() => {
    if (visible) {
      setMessages([
        {
          id: "welcome",
          from: "astra",
          text:
            portfolioData?.contextType === "market"
              ? "Ask Astra about market context, risk sentiment, movers, news, crypto, and major indexes."
              : portfolioData?.contextType === "stock_detail"
                ? `Ask Astra about ${portfolioData?.symbol || "this stock"} — signal, pattern, technicals, and risks.`
                : "Ask Astra about your portfolio, holdings, risk exposure, and performance context.",
        },
      ]);

      setInput("");
      setAskedIds([]);
      setSuggestedFollowups([]);
    }
  }, [visible]);

  const askAstra = async ({ question_id = null, question_text = null }) => {
    const isStockDetailMode = portfolioData?.contextType === "stock_detail";
    const isMarketMode = portfolioData?.contextType === "market";

    if (
      !isStockDetailMode &&
      !isMarketMode &&
      (!portfolioData ||
        !portfolioData.positions ||
        portfolioData.positions.length === 0)
    ) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId("err"),
          from: "astra",
          text: "Add at least one stock to your portfolio so Astra can explain performance and risk context.",
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
        prev.includes(question_id) ? prev : [...prev, question_id],
      );
    }

    const userMsg = {
      id: makeId("user"),
      from: "user",
      text: label,
    };

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
          text:
            result?.answer?.trim() ||
            "Astra could not generate a response right now. Please try again.",
          cards: result?.cards || [],
        },
      ]);

      setSuggestedFollowups(result.suggestedFollowups || []);
      scrollToEnd();
    } catch (err) {
      console.warn("AstraChat error:", err);

      setMessages((prev) => [
        ...prev.filter((m) => m.from !== "typing"),
        {
          id: makeId("err"),
          from: "astra",
          text: "Astra is temporarily unavailable. Please try again shortly.",
        },
      ]);

      scrollToEnd();
    } finally {
      setLoading(false);
    }
  };

  const sendCustom = () => {
    const text = input.trim();
    if (!text || loading) return;

    Keyboard.dismiss();
    askAstra({ question_text: text });
  };
  const resetChat = () => {
    setMessages([
      {
        id: "welcome",
        from: "astra",
        text:
          portfolioData?.contextType === "market"
            ? "Ask Astra about market context, risk sentiment, movers, news, crypto, and major indexes."
            : portfolioData?.contextType === "stock_detail"
              ? `Ask Astra about ${portfolioData?.symbol || "this stock"} — signal, pattern, technicals, and risks.`
              : "Ask Astra about your portfolio, holdings, risk exposure, and performance context.",
      },
    ]);

    setInput("");
    setAskedIds([]);
    setSuggestedFollowups([]);
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
            <View style={styles.handleBar} />

            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.avatar}>
                  <AstraAnimatedIcon size={42} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.astraTitle}>Astra</Text>
                  <Text style={styles.astraTagline}>
                    AI Market & Portfolio Assistant
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <Pressable onPress={resetChat} style={styles.clearBtn}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>

                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={BRAND.sub} />
                </Pressable>
              </View>
            </View>

            <View style={styles.messagesBox}>
              <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
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
                            <View
                              key={`${m.id}-card-${idx}`}
                              style={styles.answerCard}
                            >
                              <Text style={styles.answerCardTitle}>
                                {card.title}
                              </Text>
                              <Text style={styles.answerCardValue}>
                                {card.value}
                              </Text>
                              {!!card.subtitle && (
                                <Text style={styles.answerCardSubtitle}>
                                  {card.subtitle}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ),
                )}

                {!hasAsked && (
                  <View style={styles.starterBlock}>
                    <Text style={styles.chipHeader}>Quick questions</Text>

                    {starterChips.map((c) => (
                      <Pressable
                        key={c.id}
                        style={({ pressed }) => [
                          styles.chip,
                          pressed && { opacity: 0.75 },
                        ]}
                        onPress={() =>
                          askAstra({
                            question_id: c.id,
                            question_text: c.label,
                          })
                        }
                      >
                        <Ionicons
                          name="sparkles-outline"
                          size={14}
                          color={BRAND.amber}
                        />
                        <Text style={styles.chipText}>{c.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>

            {hasAsked &&
              suggestedFollowups.length === 0 &&
              moreChips.length > 0 && (
                <View style={styles.followupArea}>
                  <Text style={styles.chipHeader}>More insights</Text>

                  {moreChips.slice(0, 2).map((q) => (
                    <Pressable
                      key={q.id}
                      style={({ pressed }) => [
                        styles.chip,
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={() =>
                        askAstra({ question_id: q.id, question_text: q.label })
                      }
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={14}
                        color={BRAND.amber}
                      />
                      <Text style={styles.chipText}>{q.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

            {suggestedFollowups.length > 0 && (
              <View style={styles.followupArea}>
                <Text style={styles.chipHeader}>Suggested follow-ups</Text>

                {suggestedFollowups.slice(0, 2).map((q, idx) => (
                  <Pressable
                    key={`followup-${idx}-${q}`}
                    style={({ pressed }) => [
                      styles.chip,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={() => askAstra({ question_text: q })}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={14}
                      color={BRAND.green}
                    />
                    <Text style={styles.chipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.disclaimerText}>
              Educational AI insights only. Not financial, investment, trading,
              or tax advice.
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask Astra anything..."
                placeholderTextColor={BRAND.muted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendCustom}
                returnKeyType="send"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  (!input.trim() || loading) && styles.sendDisabled,
                  pressed && input.trim() && !loading && { opacity: 0.75 },
                ]}
                disabled={!input.trim() || loading}
                onPress={sendCustom}
              >
                <Ionicons name="send" size={15} color="#0A0A0A" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },

  bgTouch: {
    flex: 1,
  },

  card: {
    backgroundColor: BRAND.card2,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    height: "90%",
  },

  handleBar: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: BRAND.border,
    alignSelf: "center",
    marginBottom: 10,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.softBorder,
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    marginRight: 8,
  },

  astraTitle: {
    color: BRAND.text,
    fontSize: 22,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.2,
  },

  astraTagline: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 1,
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  messagesBox: {
    flex: 1,
    marginTop: 10,
    marginBottom: 8,
  },

  scroll: {
    flex: 1,
  },

  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: BRAND.accent,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    marginVertical: 4,
    maxWidth: "82%",
  },

  userText: {
    color: "#0A0A0A",
    fontFamily: TYPO.fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
  },

  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(17,24,39,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 18,
    marginVertical: 5,
    maxWidth: "92%",
  },

  botText: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: TYPO.fontFamily.regular,
  },

  typingBubble: {
    alignSelf: "flex-start",
    backgroundColor: BRAND.card,
    borderColor: BRAND.border,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 6,
  },

  dotsRow: {
    flexDirection: "row",
    columnGap: 4,
  },

  dot: {
    width: 5,
    height: 5,
    backgroundColor: BRAND.sub,
    borderRadius: 3,
  },

  starterBlock: {
    marginTop: 12,
  },

  followupArea: {
    marginBottom: 8,
  },

  chipHeader: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    marginBottom: 6,
  },

  chipText: {
    color: BRAND.text,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
    flexShrink: 1,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 6,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  input: {
    flex: 1,
    backgroundColor: BRAND.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: BRAND.text,
    fontSize: 13,
    marginRight: 8,
    fontFamily: TYPO.fontFamily.medium,
  },

  sendBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  sendDisabled: {
    backgroundColor: "#374151",
  },

  disclaimerText: {
    color: BRAND.muted,
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
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },

  answerCardTitle: {
    color: BRAND.muted,
    fontSize: 10.5,
    marginBottom: 3,
    fontFamily: TYPO.fontFamily.semibold,
  },

  answerCardValue: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  answerCardSubtitle: {
    color: BRAND.sub,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.regular,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },

  clearBtn: {
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  clearText: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },
});
