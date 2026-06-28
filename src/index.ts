#!/usr/bin/env node
/**
 * WeChat Claude Bridge
 * 基于微信 iLink 协议，将 Claude 直接接入微信个人号
 *
 * 用法:
 *   npx tsx src/index.ts              # 启动，如无凭证则进入登录流程
 *   npx tsx src/index.ts --login      # 强制重新登录
 *   npx tsx src/index.ts --char uu    # 使用 uu 角色
 *   npx tsx src/index.ts --help       # 帮助
 */

import path from "node:path";
import { login } from "./login.js";
import { runPollLoop } from "./poller.js";
import type { ParsedMessage } from "./poller.js";
import { handleMessage } from "./claude.js";
import { createFileSessionStore } from "./session.js";
import {
  loadConfig,
  saveConfig,
  saveCredentials,
  loadCredentials,
  getConfigDir,
} from "./config.js";
import { runProactiveLoop } from "./proactive.js";

// 解析命令行参数
const args = process.argv.slice(2);
const flags: Record<string, string | boolean> = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
}

if (flags.help || flags.h) {
  console.log(`
🔄 WeChat Claude Bridge — 基于微信 iLink 协议的 Claude 微信接入桥

用法:
  npx tsx src/index.ts               启动服务
  npx tsx src/index.ts --login       强制重新扫码登录
  npx tsx src/index.ts --char uu     使用指定角色（默认: default）
  npx tsx src/index.ts --model claude-sonnet-4-6  指定模型

环境变量:
  ANTHROPIC_API_KEY  Claude API Key（优先级高于配置文件）

角色配置在 ${getConfigDir()}/config.json 中
  `);
  process.exit(0);
}

async function main() {
  console.log("🤖 WeChat Claude Bridge v1.0.0");
  console.log("═".repeat(50));

  // 加载配置
  const config = loadConfig();

  // 环境变量覆盖 API Key
  if (process.env.ANTHROPIC_API_KEY) {
    config.claude.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  // 命令行参数覆盖
  if (typeof flags.char === "string") {
    config.activeCharacter = flags.char;
  }
  if (typeof flags.model === "string") {
    config.claude.model = flags.model;
  }

  // 检查 API Key
  if (!config.claude.apiKey) {
    console.error("❌ 缺少 Claude API Key！");
    console.error("   请设置环境变量 ANTHROPIC_API_KEY 或在配置文件中填写");
    process.exit(1);
  }

  // 检查角色配置
  const character = config.characters[config.activeCharacter];
  if (!character) {
    console.error(`❌ 未知角色: ${config.activeCharacter}`);
    console.error(`   可用角色: ${Object.keys(config.characters).join(", ")}`);
    process.exit(1);
  }
  console.log(`🎭 当前角色: ${character.name}`);

  // 获取登录凭证
  let credentials = loadCredentials();
  const forceLogin = flags.login === true;

  if (forceLogin || !credentials) {
    if (forceLogin) {
      console.log("🔄 强制重新登录...\n");
    } else {
      console.log("🔑 未找到登录凭证，开始首次登录...\n");
    }

    try {
      const result = await login();
      credentials = {
        token: result.token,
        accountId: result.accountId,
        baseUrl: result.baseUrl,
        userId: result.userId,
      };
      saveCredentials(credentials);
      // 更新运行时配置
      config.credentials = credentials;
      saveConfig(config);
    } catch (err: any) {
      if (err.message === "ALREADY_CONNECTED") {
        // 已有凭证，尝试加载
        credentials = loadCredentials();
        if (!credentials) {
          console.error("❌ 连接已存在但无本地凭证，请重新登录");
          process.exit(1);
        }
      } else {
        console.error(`❌ 登录失败: ${err.message}`);
        process.exit(1);
      }
    }
  }

  if (!credentials) {
    console.error("❌ 无有效凭证");
    process.exit(1);
  }

  console.log(`✅ 已加载凭证: ${credentials.accountId}`);
  console.log(`🌐 服务器: ${credentials.baseUrl}`);

  // 初始化会话存储
  const dataDir = getConfigDir();
  const sessionStore = createFileSessionStore(path.join(dataDir, "sessions"));

  // 创建 AbortController 用于优雅关闭
  const abortController = new AbortController();

  const shutdown = async () => {
    console.log("\n⏹️  正在关闭...");
    abortController.abort();
    sessionStore.save();
    console.log("👋 已断开微信连接");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("📡 开始监听微信消息...\n");
  console.log("═".repeat(50));
  console.log("按 Ctrl+C 退出\n");

  // 主动消息状态
  const targetUserId = config.allowedUsers?.[0] || credentials.userId;
  let lastUserActiveAt = Date.now();

  // 启动长轮询（不 await，让它和主动消息并行）
  const pollPromise = runPollLoop({
    baseUrl: credentials.baseUrl,
    token: credentials.token,
    callbacks: {
      onMessage: async (parsed: ParsedMessage) => {
        // 白名单检查
        const allowed = config.allowedUsers ?? [];
        if (allowed.length > 0 && !allowed.includes(parsed.fromUserId)) {
          console.log(`🔇 忽略非白名单用户: ${parsed.fromUserId}`);
          console.log("─".repeat(40));
          return null;
        }

        // 更新最后活跃时间（用于主动消息跳过逻辑）
        lastUserActiveAt = Date.now();

        // 打印收到的消息
        const preview = parsed.text
          ? parsed.text.slice(0, 50) + (parsed.text.length > 50 ? "..." : "")
          : (parsed.imageUrl ? "[图片]" : "[媒体]");
        console.log(`📩 [${parsed.fromUserId.slice(0, 12)}...] ${preview}`);

        // 处理消息
        await handleMessage({
          parsed,
          sessionStore,
          claudeConfig: config.claude,
          characterConfig: character,
          weixinConfig: {
            baseUrl: credentials!.baseUrl,
            token: credentials!.token,
          },
        });

        // 打印回复
        const session = sessionStore.get(parsed.fromUserId);
        if (session && session.history.length > 0) {
          const lastReply = session.history[session.history.length - 1];
          if (lastReply.role === "assistant") {
            const replyPreview = lastReply.content.slice(0, 50) + (lastReply.content.length > 50 ? "..." : "");
            console.log(`📤 ${replyPreview}`);
          }
        }
        console.log("─".repeat(40));

        return null;
      },

      onError: (err: Error) => {
        console.error(`❌ 轮询错误: ${err.message}`);
      },

      onStatusChange: (status: string) => {
        const icons: Record<string, string> = {
          connected: "🟢 已连接",
          disconnected: "🔴 已断开",
          reconnecting: "🟡 重连中...",
        };
        console.log(`${icons[status] || status}`);
      },
    },
    abortSignal: abortController.signal,
  });

  // 启动主动消息循环（与轮询并行）
  const proactivePromise = runProactiveLoop({
    claudeConfig: config.claude,
    characterConfig: character,
    weixinConfig: {
      baseUrl: credentials!.baseUrl,
      token: credentials!.token,
    },
    userId: targetUserId,
    getLastActiveAt: () => lastUserActiveAt,
    getFamiliarity: () => {
      const s = sessionStore.get(targetUserId);
      return s?.familiarity ?? 0;
    },
    abortSignal: abortController.signal,
  });

  await Promise.race([pollPromise, proactivePromise]);
}

main().catch((err) => {
  console.error("💥 未捕获的错误:", err.message);
  process.exit(1);
});
