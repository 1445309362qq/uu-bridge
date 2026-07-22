/** 语音模块：TTS → 保存桌面 → 微信通知 */
import { synthesizeSpeech } from "./tts.js";
import type { SessionStore } from "./session.js";

/** 语音保存到桌面，微信通知用户去听 */
export async function sendVoiceMessage(params: {
  text: string;
  toUserId: string;
  baseUrl: string;
  token: string;
  sessionStore: SessionStore;
}): Promise<void> {
  const { text, toUserId, baseUrl, token, sessionStore } = params;

  // 1. TTS 合成语音
  const { filePath, durationMs } = await synthesizeSpeech(text);

  // 2. 复制到桌面
  const desktopDir = "C:/Users/pass/Desktop/uu-语音";
  const fs2 = await import("node:fs/promises");
  await fs2.mkdir(desktopDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const destPath = `${desktopDir}/uu-${timestamp}.mp3`;
  await fs2.copyFile(filePath, destPath);

  // 3. 微信通知
  const { sendMessage } = await import("./api.js");
  await sendMessage({
    baseUrl, token, toUserId,
    text: `🎤 给你发了条语音，在桌面 uu-语音 文件夹里`,
    contextToken: sessionStore.get(toUserId)?.contextToken,
  });

  console.log(`🎤 语音已保存: ${destPath} (${durationMs}ms)`);

  // 清理临时文件
  try { await fs2.unlink(filePath); } catch {}
}

/** 语音频率随亲密度动态变化 */
export function shouldSendVoice(text: string, familiarity: number = 0): boolean {
  return false; // 语音功能已关闭
}
