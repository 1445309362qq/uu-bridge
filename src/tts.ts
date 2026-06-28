/** TTS 语音合成 — Python edge-tts 子进程（免费，已验证可用） */
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const PYTHON = "C:/Users/pass/AppData/Local/Programs/Python/Python312/python.exe";
const EDGE_TTS_SCRIPT = "C:/Users/pass/AppData/Local/Programs/Python/Python312/Scripts/edge-tts.exe";

/** Edge TTS 女声 */
const VOICES = {
  xiaoxiao: "zh-CN-XiaoxiaoNeural",  // 晓晓 — Warm（日常 / bratty 公主）
  xiaoyi: "zh-CN-XiaoyiNeural",      // 晓伊 — Lively（活泼 / 玩弄他时）
};

function pickVoice(text: string): string {
  // 短句：晓晓 warm 但带冷意
  // 长句：晓伊 lively 但有压迫感
  return text.length < 20 ? VOICES.xiaoxiao : VOICES.xiaoyi;
}

export async function synthesizeSpeech(text: string): Promise<{
  filePath: string;
  durationMs: number;
}> {
  const voice = pickVoice(text);
  const dir = path.join(os.tmpdir(), "weixin-voice");
  await fs.mkdir(dir, { recursive: true });
  const fileName = `uu-${crypto.randomUUID().slice(0, 8)}.mp3`;
  const filePath = path.join(dir, fileName);

  // 调用 Python edge-tts
  const escapedText = text.replace(/"/g, "'").replace(/`/g, "'").replace(/\$/g, "");
  const cmd = `"${EDGE_TTS_SCRIPT}" --voice "${voice}" --text "${escapedText}" --write-media "${filePath}"`;

  try {
    execSync(cmd, {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 15_000,
    });
  } catch (err: any) {
    throw new Error(`edge-tts 合成失败: ${err.message}`);
  }

  const stat = await fs.stat(filePath);
  if (stat.size < 100) throw new Error(`音频太小: ${stat.size} bytes`);

  // 估算时长
  const durationMs = Math.round((stat.size / 6000) * 1000);
  return { filePath, durationMs };
}
