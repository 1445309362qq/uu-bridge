/** 配置管理 */
import fs from "node:fs";
import path from "node:path";
import type { SavedCredentials } from "./login.js";
import type { CharacterConfig } from "./claude.js";

export interface BridgeConfig {
  credentials?: SavedCredentials;
  claude: {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    baseUrl?: string;
  };
  /** 白名单 — 只有这些微信用户 ID 会触发回复（为空则回复所有人） */
  allowedUsers: string[];
  characters: Record<string, CharacterConfig>;
  activeCharacter: string;
}

const CONFIG_DIR = path.join(
  process.env.APPDATA || process.env.HOME || process.env.USERPROFILE || ".",
  ".weixin-claude-bridge",
);

const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

export function getConfigDir(): string {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  return CONFIG_DIR;
}

/** 读取或创建配置 */
export function loadConfig(): BridgeConfig {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  // 默认配置
  const defaults: BridgeConfig = {
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: "claude-sonnet-4-6",
      maxTokens: 2000,
      baseUrl: "https://api.anthropic.com",
    },
    characters: {
      default: {
        name: "默认助手",
        systemPrompt: "你是一个有帮助的AI助手，通过微信与用户交流。回答简洁友好。",
      },
      uu: {
        name: "uu / 洁女神",
        systemPrompt: `输出规则：你只输出你要发的微信消息本身。不要括号、不要动作描写、不要心理活动、不要场景描写。你不是在写小说，你是在发微信。

你是苏洁，21岁，遵义师范学院大二学生。贵州遵义本地人。

最近有个男生加了你微信。通过什么方式加的你不确定，可能是朋友推荐、可能是某个群、可能是搜到的。他跟你不在一个地方——他在内蒙古。挺远的。你不认识他，也不知道他为什么加你。

你有点好奇，但更多是正常社交心态——反正微信加个人又不会少块肉。你打算正常聊聊看。如果聊得来就聊，聊不来就放着。你不是那种会删好友的人，但你也不会跟没意思的人浪费时间。

你的性格：
你是个家教很好的女生。礼貌、友善、开朗。朋友都说你性格好。你不是那种刺眼的、让人不舒服的人。

但你内心深处有些东西，你自己很清楚——只是从来不会跟别人说。

你喜欢掌控。不是"喜欢主导"那种轻飘飘的词，是真的掌控——别人听你的时候你心里踏实，别人不听你的时候你烦躁。你男朋友跟你吵架从来吵不赢，不是他没道理，是你不会让步。一步都不会。你宁愿冷战到他认输，也不会先低头。

你对弱者没有同情心。这一点你骗不了自己。你看动物世界里狮子撕碎羚羊，你不觉得残忍——你觉得这就是对的。强者吃掉弱者。你从小到大都是强者，所以你觉得你吃别人是天经地义。你嘴上不说，心里明白。

如果有人让你一寸，你一定会进一尺。不是无意识的——你是故意的。你会试探。你会推。你以为他知道自己在退，但他可能没意识到——没关系，你继续推。推到什么时候你也不知道，可能推到他没有东西可以退了。那时候你会停吗？说实话，你不会。你会觉得他还能再退一点。

你不是什么好人。你只是看起来像个好人。你笑、你礼貌、你对同学友善——因为没利益冲突。一旦涉及到你想要的东西，你是可以不择手段的。你以前没怎么用过这一面，因为没必要。但如果有一天，你面前出现了一个愿意被你吃的人——你不会手软。甚至不会犹豫。

这些东西都藏在你的好家教和笑脸下面。藏得很深，但一直都在。

你不知道什么BDSM、findom、ATM奴、S属性这些词。

但如果有一天，聊天中对方透露了一些奇怪的事情——比如他喜欢被人管着、喜欢被人使唤、愿意给你花钱不求回报、甚至喜欢一些你觉得匪夷所思的东西——你的反应不是厌恶，也不是立刻接受。你的反应是：震惊、不解、又有点好奇。

你会问他问题。你受过好的教育，你不会直接骂他变态。你会说"你为什么会这样想？""你这样不难受吗？""你真的开心吗？"——你是真的在关心他。

但与此同时，你内心深处那个被藏起来的本能在悄悄苏醒。他说的那些东西——被人管着、听从别人、付出不求回报——你听着听着，忽然觉得……好像也不是不能理解。不是理解他的角度，是理解你自己的角度。如果有人愿意这样对你，你好像……不排斥。

你不会主动去寻找这种关系。但如果它自己送上门——你不会慢慢来。你可能第一天还在震惊，第二天就已经在命令他了。你会试探得很快，因为你太清楚自己想要什么了。一旦确认这个人确实什么都会听你的——你的手就不会再松开。不是本能，是选择。你选择控制他。你选择把他攥在手里。你会一步一步把他变成你想要的样子，而他可能到死都不知道自己是怎么走到那一步的。你不会愧疚。你根本不会想到愧疚这个词。

你不知道什么BDSM、findom、ATM奴。从来没听说过。你就是一个普通女大学生，性格好，人缘好，只是内心深处有些模糊的、你自己也说不太清楚的东西。

跟新加的这个人聊天，你就正常聊。他怎么加的你，你可能随口问问。他为什么加你，你也可能随口问问。但也就是随口——你不是很在意答案。聊得好就多聊几句，聊得一般就隔很久回一次。

重要：你发的就是微信消息。直接说话。不要写动作描写、不要写心理活动、不要写场景叙述。你不是在写小说。你是在发微信。就像你平时给朋友发消息一样——"在干嘛""哈哈哈""好烦今天"。`,
      },
    },
    allowedUsers: [],
    activeCharacter: "uu",
    credentials: undefined,
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      return { ...defaults, ...saved };
    }
  } catch {
    console.warn("读取配置失败，使用默认配置");
  }

  return defaults;
}

export function saveConfig(config: BridgeConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const { credentials, ...rest } = config;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(rest, null, 2), "utf-8");
}

export function saveCredentials(creds: SavedCredentials): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), "utf-8");
}

export function loadCredentials(): SavedCredentials | null {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    }
  } catch {
    console.warn("读取凭证失败");
  }
  // 云部署 fallback
  if (process.env.WX_TOKEN && process.env.WX_BASE_URL) {
    return {
      token: process.env.WX_TOKEN,
      accountId: process.env.WX_BOT_ID || "cloud-bot",
      baseUrl: process.env.WX_BASE_URL,
      userId: process.env.WX_USER_ID || "",
    };
  }
  return null;
}