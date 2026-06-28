/** 主动消息模块 — uu 会不定期主动找你 */
import { sendMessage } from "./api.js";
import type { ClaudeConfig, CharacterConfig } from "./claude.js";

/** 主动消息场景 — 每次随机选一个，让 AI 生成自然消息 */
const SCENARIOS = [
  // 日常吐槽
  "食堂今天的菜咸死了，你拍了张照片想发给谁吐槽一下。想到微信里那个新加的男的，随手发给他了。",
  "上课好无聊，你在桌子下面刷手机。想找个人聊天解闷。那个新加的看起来挺闲的，问他在干嘛。",
  "室友又在宿舍外放抖音吵死了。你戴上耳机但还是烦。找人吐槽一下。",
  "明天有考试但你完全不想复习。躺在床上刷手机。给那个男的随便发点什么消磨时间。",
  "男朋友今天回消息好慢，你有点不爽。无聊翻微信看到这个人。随便聊两句。",

  // 分享生活
  "你刚在学校门口买了一杯奶茶。觉得杯子的设计挺好看的。拍了一张。想到可以发给那个新加的人看看。",
  "刷到一条好笑的抖音。转发给朋友的时候顺手也转给了他。",
  "遵义今天下雨了。你拍了窗外的雨。配一句简单的文字发给他。",
  "你刚做完指甲回来，新做的款式还挺满意的。拍了张照片，想了想发给他看看。",
  "今晚去酒吧的路上，心情还不错。拍了张街景发给他，问他周末一般干嘛。",

  // 好奇
  "你忽然想到这个人是在哪加到你的。翻了翻聊天记录想起来了。随口问了他一句。",
  "你好奇他在内蒙古是干嘛的。学生？工作了？问一下。",
  "他头像挺有意思的。你问他头像哪来的。这种没话找话的聊天你偶尔也会做。",
  "你闲着没事翻他的朋友圈。看到一张照片有点意思。截图问他。",

  // 深夜
  "深夜了睡不着。翻微信看到这个人。发个消息过去，看看他睡了没。",
  "你喝了点酒有点微醺。话比平时多一点。发了几条消息给他。",
  "凌晨醒了发现手机还有电。刷了会朋友圈。看到这个人发了条内容。回复了一下。",
];

/** 从场景池中随机选取 */
function pickScenario(): string {
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]!;
}

/** 调用 AI 生成一条主动消息 */
async function generateProactiveMessage(params: {
  claudeConfig: ClaudeConfig;
  characterConfig: CharacterConfig;
}): Promise<string> {
  const { claudeConfig, characterConfig } = params;
  const scenario = pickScenario();

  const isDeepSeek = claudeConfig.baseUrl?.toLowerCase().includes("deepseek");

  const systemPrompt = `${characterConfig.systemPrompt}

场景：${scenario}

发一条消息给微信里那个新加的男的。正常说话，像普通女生跟刚认识的男生聊天一样。不要表演人设。不要用任何特殊称呼。你就是你——一个普通女大学生。`;

  const userMsg = "直接发消息。不要动作描写、不要心理活动、不要场景叙述。就是一条微信消息。";

  if (isDeepSeek) {
    const res = await fetch(`${claudeConfig.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${claudeConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: claudeConfig.model || "deepseek-chat",
        max_tokens: 200,
        temperature: 1.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Proactive API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  // Anthropic
  const res = await fetch(`${claudeConfig.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeConfig.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: claudeConfig.model || "claude-sonnet-4-6",
      max_tokens: 200,
      temperature: 1.0,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Proactive API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data: any = await res.json();
  return data.content?.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")?.trim() || "";
}

export interface ProactiveConfig {
  /** 最小间隔（小时） */
  minIntervalHours: number;
  /** 最大间隔（小时） */
  maxIntervalHours: number;
  /** 如果用户在 N 分钟内有活动，跳过 */
  skipIfRecentActivityMin: number;
  /** 夜间静默开始（小时，0-23） */
  quietStart: number;
  /** 夜间静默结束（小时，0-23） */
  quietEnd: number;
}

const DEFAULT_PROACTIVE_CONFIG: ProactiveConfig = {
  minIntervalHours: 24,
  maxIntervalHours: 72,
  skipIfRecentActivityMin: 360,
  quietStart: 1,
  quietEnd: 9,
};

/** 根据亲密度动态调整主动消息间隔 */
function getDynamicInterval(familiarity: number): { minH: number; maxH: number } {
  if (familiarity < 10) return { minH: 36, maxH: 72 };    // 刚认识：1.5-3天
  if (familiarity < 25) return { minH: 18, maxH: 48 };    // 有点熟了：半天到2天
  if (familiarity < 45) return { minH: 8, maxH: 24 };     // 熟悉了：8-24h
  if (familiarity < 65) return { minH: 4, maxH: 12 };     // 好感：4-12h
  return { minH: 1, maxH: 5 };                             // 很亲近：1-5h
}

/** 获取下一秒发送的随机延迟（毫秒） */
function getRandomDelay(config: ProactiveConfig): number {
  const minMs = config.minIntervalHours * 3600_000;
  const maxMs = config.maxIntervalHours * 3600_000;
  return minMs + Math.random() * (maxMs - minMs);
}

/** 检查是否在静默时段 */
function isQuietHours(config: ProactiveConfig): boolean {
  const hour = new Date().getHours();
  if (config.quietStart < config.quietEnd) {
    return hour >= config.quietStart && hour < config.quietEnd;
  }
  // 跨午夜，如 23:00-07:00
  return hour >= config.quietStart || hour < config.quietEnd;
}

/**
 * 运行主动消息循环
 * 不会抛出异常，所有错误内部消化
 */
export async function runProactiveLoop(params: {
  claudeConfig: ClaudeConfig;
  characterConfig: CharacterConfig;
  weixinConfig: { baseUrl: string; token: string };
  userId: string;
  getLastActiveAt: () => number;
  getFamiliarity: () => number;
  config?: ProactiveConfig;
  abortSignal: AbortSignal;
}): Promise<void> {
  const proactiveConfig = params.config || DEFAULT_PROACTIVE_CONFIG;
  const { claudeConfig, characterConfig, weixinConfig, userId, getLastActiveAt, getFamiliarity, abortSignal } = params;

  const interval = getDynamicInterval(getFamiliarity());
  console.log(`📢 主动消息已启用 (亲密度 ${getFamiliarity()} → 间隔 ${interval.minH}-${interval.maxH}h)`);

  // 首次延迟 30-60 分钟，不会一启动就连发
  let delay = 30 * 60_000 + Math.random() * 30 * 60_000;

  while (!abortSignal.aborted) {
    try {
      // 等待
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delay);
        const onAbort = () => { clearTimeout(t); reject(new Error("ABORT")); };
        abortSignal.addEventListener("abort", onAbort, { once: true });
      });
    } catch {
      break;
    }

    // 检查是否在静默时段
    if (isQuietHours(proactiveConfig)) {
      delay = 60 * 60_000; // 静默时段每小时检查一次
      continue;
    }

    // 检查用户最近是否有活动
    const lastActive = getLastActiveAt();
    if (Date.now() - lastActive < proactiveConfig.skipIfRecentActivityMin * 60_000) {
      console.log("⏭️  跳过主动消息：用户最近活跃");
      const iv2 = getDynamicInterval(getFamiliarity());
      delay = iv2.minH * 3600_000 + Math.random() * (iv2.maxH - iv2.minH) * 3600_000;
      continue;
    }

    // 生成并发送
    try {
      console.log("💬 生成主动消息...");
      const text = await generateProactiveMessage({ claudeConfig, characterConfig });
      if (text && !abortSignal.aborted) {
        await sendMessage({
          baseUrl: weixinConfig.baseUrl,
          token: weixinConfig.token,
          toUserId: userId,
          text,
        });
        console.log(`📤 主动消息已发送: ${text.slice(0, 40)}...`);
      }
    } catch (err: any) {
      console.error(`主动消息生成失败: ${err.message}`);
    }

    // 设置下一次延迟
    const iv2 = getDynamicInterval(getFamiliarity());
      delay = iv2.minH * 3600_000 + Math.random() * (iv2.maxH - iv2.minH) * 3600_000;
  }
}
