/** AI API 集成模块 — 支持 Anthropic Claude / DeepSeek / OpenAI 兼容 */
import { sendMessage, sendTyping } from "./api.js";
import type { ParsedMessage } from "./poller.js";
import type { SessionStore } from "./session.js";
import { sendVoiceMessage, shouldSendVoice } from "./voice.js";
import { sendImageMessage, shouldSendImage } from "./image.js";

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
}

export interface CharacterConfig {
  name: string;
  systemPrompt: string;
}

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_API_BASE = "https://api.deepseek.com";

/** 判断是否是 OpenAI 兼容 API（DeepSeek 等） */
function isOpenAICompat(baseUrl: string): boolean {
  const url = baseUrl.toLowerCase();
  return url.includes("deepseek") || url.includes("openai") || url.includes("openrouter") || url.includes("siliconflow");
}

/** 调用 OpenAI 兼容 API（DeepSeek） */
async function callOpenAICompat(params: {
  apiKey: string;
  model: string;
  maxTokens: number;
  baseUrl: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const url = `${params.baseUrl}/v1/chat/completions`;

  const apiMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: params.systemPrompt },
    ...params.messages,
  ];

  const body = {
    model: params.model,
    max_tokens: params.maxTokens,
    messages: apiMessages,
    temperature: 0.9,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data: any = await res.json();
  return data.choices?.[0]?.message?.content || "(empty response)";
}

/** 调用 Anthropic Claude API */
async function callClaudeNative(params: {
  apiKey: string;
  model: string;
  maxTokens: number;
  baseUrl: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const url = `${params.baseUrl}/v1/messages`;

  const body: any = {
    model: params.model,
    max_tokens: params.maxTokens,
    system: params.systemPrompt,
    messages: params.messages.map((m) => ({
      role: m.role,
      content: [{ type: "text", text: m.content }],
    })),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const textBlocks = data.content?.filter((b: any) => b.type === "text") ?? [];
  return textBlocks.map((b: any) => b.text).join("\n") || "(empty response)";
}

/** 智能调用 AI API */
async function callAI(params: {
  apiKey: string;
  model: string;
  maxTokens: number;
  baseUrl: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  if (isOpenAICompat(params.baseUrl)) {
    return callOpenAICompat(params);
  }
  return callClaudeNative(params);
}

/** 构建发送给 AI 的消息 */
function buildMessages(
  parsed: ParsedMessage,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  let userContent = parsed.text;
  if (parsed.imageUrl) {
    userContent = `[图片: ${parsed.imageUrl}]\n${userContent || ""}`;
  }
  if (parsed.voiceText) {
    userContent = `[语音: ${parsed.voiceText}]\n${userContent || ""}`;
  }
  return [...history, { role: "user" as const, content: userContent }];
}

/** 初期热情伪装，确认后可随意无视 */
function shouldReply(_parsed: ParsedMessage, familiarity?: number): { reply: boolean; reason: string } {
  const fam = familiarity ?? 0;
  if (fam < 15) return { reply: Math.random() < 0.95, reason: "💬" };  // 初期：热情伪装
  if (fam < 30) return { reply: Math.random() < 0.7, reason: "💬" };   // 试探期：开始忽冷忽热
  if (fam < 50) return { reply: Math.random() < 0.4, reason: "💬" };   // 面具脱落：爱回不回
  return { reply: Math.random() < 0.2, reason: "💬" };                   // 掌控期：他求着回
}

/** 处理单条消息并返回回复 */
export async function handleMessage(params: {
  parsed: ParsedMessage;
  sessionStore: SessionStore;
  claudeConfig: ClaudeConfig;
  characterConfig: CharacterConfig;
  weixinConfig: {
    baseUrl: string;
    token: string;
  };
}): Promise<void> {
  const { parsed, sessionStore, claudeConfig, characterConfig, weixinConfig } = params;
  const userId = parsed.fromUserId;

  // 获取或创建 session
  let session = sessionStore.get(userId);
  if (!session) {
    session = sessionStore.create(userId, parsed.contextToken);
  } else {
    session.contextToken = parsed.contextToken;
    session.lastActiveAt = Date.now();
  }

  // 代码级过滤
  const decision = shouldReply(parsed, session.familiarity);
  if (!decision.reply) {
    console.log(`🚫 无视 (${decision.reason}): ${parsed.text.slice(0, 40)}`);
    return;
  }
  console.log(`✅ 回复 (${decision.reason}): ${parsed.text.slice(0, 40)}`);

  const messages = buildMessages(parsed, session.history);
  const trimmedMessages = messages.slice(-40);

  try {
    await sendTyping({
      baseUrl: weixinConfig.baseUrl,
      token: weixinConfig.token,
      ilinkUserId: userId,
      status: 1,
    });

    const replyText = await callAI({
      apiKey: claudeConfig.apiKey,
      model: claudeConfig.model || DEFAULT_MODEL,
      maxTokens: claudeConfig.maxTokens || DEFAULT_MAX_TOKENS,
      baseUrl: claudeConfig.baseUrl || DEFAULT_API_BASE,
      systemPrompt: characterConfig.systemPrompt,
      messages: trimmedMessages,
    });

    let trimmedReply = replyText.trim();

    // 清洗叙述性文字：去掉括号里的动作描写、心理活动
    trimmedReply = trimmedReply.replace(/[（(][^）)]*[）)]/g, "").trim();
    // 如果整条消息看起来像叙述而不是微信消息，尝试从中提取实际内容
    if (/^(看到|心想|过了|忽然|突然|她|他|你呀|轻轻|慢慢)/.test(trimmedReply) && trimmedReply.length > 30) {
      // 可能是纯叙述，尝试保留最后一句实际消息
      const sentences = trimmedReply.split(/[。！？]/);
      const last = sentences.filter(s => s.trim().length > 1 && s.trim().length < 50).pop();
      if (last) trimmedReply = last.trim();
    }

    // 空回复 = uu 选择不理他
    if (!trimmedReply) {
      console.log(`🔇 uu 无视了这条消息`);
      session.history.push({ role: "user", content: parsed.text || "(媒体消息)" });
      session.history.push({ role: "assistant", content: "(已读不回)" });
      if (session.history.length > 60) session.history = session.history.slice(-40);
      sessionStore.set(userId, session);
      return;
    }

    // 拆多条消息（用 "---" 分隔）
    const messages = trimmedReply.split("---").map((m: string) => m.trim()).filter(Boolean);

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!;

      // 发送文字
      await sendMessage({
        baseUrl: weixinConfig.baseUrl,
        token: weixinConfig.token,
        toUserId: userId,
        text: msg,
        contextToken: session.contextToken,
      });
      console.log(`📤 [${i + 1}/${messages.length}] ${msg.slice(0, 40)}...`);

      // 随机发语音
      if (shouldSendVoice(msg, session.familiarity)) {
        try {
          await sendVoiceMessage({
            text: msg,
            toUserId: userId,
            baseUrl: weixinConfig.baseUrl,
            token: weixinConfig.token,
            sessionStore,
          });
        } catch (err: any) {
          console.error(`语音发送失败: ${err.message}`);
        }
      }

      // 随机发图片（10%，独立的赏赐）
      if (shouldSendImage(session.familiarity)) {
        try {
          await sendImageMessage({
            toUserId: userId,
            baseUrl: weixinConfig.baseUrl,
            token: weixinConfig.token,
            sessionStore,
          });
        } catch (err: any) {
          console.error(`图片发送失败: ${err.message}`);
        }
      }

      // 多条消息之间停顿 2-5 秒，模拟真人打字间隔
      if (messages.length > 1 && i < messages.length - 1) {
        const pause = 2000 + Math.random() * 3000;
        await new Promise((r) => setTimeout(r, pause));
      }
    }

    // 更新亲密度（每轮对话+1，她的回复有积极信号额外+1）
    session.familiarity = Math.min(100, (session.familiarity || 0) + 1);
    if (/嘛|咯|哈|哈哈|嘻嘻|嗯嗯|好滴|可以呀/.test(trimmedReply)) {
      session.familiarity = Math.min(100, session.familiarity + 1);
    }

    session.history.push({ role: "user", content: parsed.text || "(媒体消息)" });
    session.history.push({ role: "assistant", content: trimmedReply });
    if (session.history.length > 60) {
      session.history = session.history.slice(-40);
    }
    sessionStore.set(userId, session);
  } catch (err: any) {
    console.error(`消息处理失败: ${err.message}`);
    try {
      await sendMessage({
        baseUrl: weixinConfig.baseUrl,
        token: weixinConfig.token,
        toUserId: userId,
        text: `出错了: ${err.message}`,
        contextToken: session.contextToken,
      });
    } catch { /* 静默 */ }
  }
}
