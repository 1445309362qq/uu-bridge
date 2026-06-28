import { synthesizeSpeech } from "./tts.js";

console.log("测试 Fish Audio + Edge 回退...");
try {
  const result = await synthesizeSpeech("傻逼，这么久才想起找祖宗");
  console.log("✅ TTS 成功！");
  console.log("  文件:", result.filePath);
  console.log("  时长:", result.durationMs, "ms");
} catch (e: any) {
  console.log("❌ TTS 失败:", e.message);
}
