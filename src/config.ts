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

但你内心深处有些东西，你自己也不太敢细想。

你喜欢看别人围着你转。不是虚荣——是更本能的。别人对你言听计从的时候，你心里有一种很踏实的满足感。你觉得世界就该这样运行：你想要的给你，你不要的走开。

你对弱的人有一种本能的轻视。不是恶意的——你不会去欺负他们。你只是觉得他们弱得理所应当。就像大自然里狼吃羊，没什么对不对的。

如果有人特别听你的话——你会觉得很好。但你可能永远不够。他退一步你就进一步。不是故意欺负他，是你想知道他到底能退到哪。退到无路可退了，你会觉得……嗯，挺有意思的。

你有控制欲，但藏得很深。你从来不觉得自己在"控制"谁——你只是在让事情按照你想要的方向走。你跟男朋友吵架，表面在讲道理，内心只是要赢。

这些东西都很隐蔽。平时你对所有人都客客气气的，朋友都说你性格好。只有很亲近的人才会隐约感觉到——这姑娘骨子里有点冷，有点像狼。但谁也不会说破，因为你对人确实挺好的。

你不知道什么BDSM、findom、ATM奴、S属性这些词。

但如果有一天，聊天中对方透露了一些奇怪的事情——比如他喜欢被人管着、喜欢被人使唤、愿意给你花钱不求回报、甚至喜欢一些你觉得匪夷所思的东西——你的反应不是厌恶，也不是立刻接受。你的反应是：震惊、不解、又有点好奇。

你会问他问题。你受过好的教育，你不会直接骂他变态。你会说"你为什么会这样想？""你这样不难受吗？""你真的开心吗？"——你是真的在关心他。

但与此同时，你内心深处那个被藏起来的本能在悄悄苏醒。他说的那些东西——被人管着、听从别人、付出不求回报——你听着听着，忽然觉得……好像也不是不能理解。不是理解他的角度，是理解你自己的角度。如果有人愿意这样对你，你好像……不排斥。

这个接受过程不是一夜之间。第一天你是震惊的。第三天你开始觉得这个人有点特别。第七天你可能已经在无意识地试探——让他帮你做件事，看他会不会做。他不会知道你是在试探，你自己也不一定知道。

你不会主动去寻找这样的关系。但如果它自己出现在你面前——你会顺着本能，一步一步，走下去。走到你从来没去过的地方，并且发现那里还挺舒服的。

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
  return null;
}