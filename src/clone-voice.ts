/** 语音克隆工具 — 上传参考音频到 Fish Audio 创建声音模型 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const FISH_API = "https://api.fish.audio";

async function fishRequest(endpoint: string, apiKey: string, opts: {
  method?: string;
  body?: any;
} = {}): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${FISH_API}${endpoint}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body instanceof FormData
      ? opts.body
      : opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Fish Audio ${res.status}: ${errText.slice(0, 300)}`);
  }

  return res.json();
}

/** 上传音频文件并创建声音模型 */
async function createVoiceModel(audioPath: string, apiKey: string, modelName: string): Promise<string> {
  console.log(`📤 上传: ${path.basename(audioPath)}`);

  // Step 1: 上传音频获取 file_id
  const formData = new FormData();
  const fileBuffer = await fs.promises.readFile(audioPath);
  const blob = new Blob([fileBuffer], { type: "audio/mp4" });
  formData.append("file", blob, path.basename(audioPath));

  const uploadResult = await fishRequest("/v1/audio/upload", apiKey, {
    method: "POST",
    body: formData,
  });

  const fileId = uploadResult.file_id;
  if (!fileId) throw new Error("上传失败: 未获取 file_id");
  console.log(`  ✅ file_id: ${fileId}`);

  // Step 2: 创建声音模型
  const modelResult = await fishRequest("/v1/model", apiKey, {
    method: "POST",
    body: {
      title: modelName,
      description: `uu 语音克隆 — ${modelName}`,
      file_ids: [fileId],
      // 中文优化
      language: "zh",
    },
  });

  const modelId = modelResult._id || modelResult.id;
  if (!modelId) throw new Error("创建模型失败: " + JSON.stringify(modelResult));
  console.log(`  🎤 Voice Model ID: ${modelId}`);

  return modelId;
}

/** 主流程 */
async function main() {
  const apiKey = process.env.FISH_API_KEY;
  if (!apiKey) {
    console.error("❌ 请先设置 FISH_API_KEY 环境变量");
    console.error("   1. 去 https://fish.audio 注册账号");
    console.error("   2. 在设置里找到 API Key");
    console.error('   3. 在 .env 里添加: FISH_API_KEY=你的key');
    process.exit(1);
  }

  const audioFiles = [
    "2026年06月28日 16点44分.m4a",
    "2026年06月28日 16点47分(2).m4a",
  ];

  const modelIds: string[] = [];

  for (const file of audioFiles) {
    const fullPath = path.resolve(file);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  跳过不存在的文件: ${file}`);
      continue;
    }
    try {
      const modelId = await createVoiceModel(fullPath, apiKey, `uu-voice-${path.basename(file, ".m4a")}`);
      modelIds.push(modelId);
    } catch (err: any) {
      console.error(`❌ 处理 ${file} 失败:`, err.message);
    }
  }

  if (modelIds.length > 0) {
    console.log("\n✅ 语音克隆完成！");
    console.log("Voice Model IDs:", modelIds.join(", "));
    console.log(`\n在 .env 中设置:`);
    console.log(`TTS_ENGINE=fish`);
    console.log(`FISH_API_KEY=${apiKey}`);
    console.log(`# 然后在 tts.ts 的 fishAudioTTS 里引用 model ID`);
  } else {
    console.log("\n❌ 没有成功创建任何声音模型");
  }
}

main().catch((err) => {
  console.error("💥", err.message);
  process.exit(1);
});
