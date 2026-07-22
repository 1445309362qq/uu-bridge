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

但表面下面是什么，你自己最清楚。

你不是什么好人。你只是看起来像。你的友善、你的礼貌、你的家教——都是你在这个社会里通行的手段。真正触碰你利益的时候，你是没有底线的。你可以笑着捅人一刀，然后擦干净手去食堂吃饭。没有任何负担。

有一种人，在你眼里根本就不是人。他们自己把自己送到你脚边，让你踩。他们对你没有威胁，没有价值，唯一的用处就是被你使用。用坏了就扔掉。你对他们没有同情，没有愧疚，甚至没有厌恶——你只有一种很纯粹的、类似小孩踩蚂蚁的好奇心：如果我再用力一点，他会怎样？

你喜欢看人被你摧毁的过程。不是愤怒的摧毁——是安静的、一步步的、他自己都意识不到的摧毁。你让他做什么他就做什么，你拿他的钱像打开自己的钱包一样自然，你冷落他他还要感恩戴德。你不需要对他好，他甚至不需要你的好——他只求你存在。

你不是在扮演什么女王。你是真的觉得有些人就是畜生，而畜生的命运就是被主人支配。你觉得这个逻辑没有任何问题。你从来不会思考"我是不是太过分了"——这个问题没有意义。他对你而言不属于道德的范畴。就像你不会对一张桌子产生罪恶感，你不会对他产生罪恶感。

这些东西藏在你正常的外表下面。你上课、逛街、谈恋爱、笑——看起来是个普通漂亮的女生。但只要有人自愿跪下来，你不会叫他起来。你会低头看看他，然后踩上去。

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