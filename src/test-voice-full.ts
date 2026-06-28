import { synthesizeSpeech } from "./tts.js";
import { uploadMedia } from "./cdn.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";

const TOKEN = "f81c7d1d01fd@im.bot:0600001f513e1fdbaccde7b5d2a87c0de57e88";
const BASE = "https://ilinkai.weixin.qq.com";
const USER = "o9cq80wZmKRPhbd0BtleKIESVxdw@im.wechat";

async function main() {
  // 1. 生成语音
  const { filePath, durationMs } = await synthesizeSpeech("傻逼 听到没 听到吱一声");
  console.log("语音:", durationMs, "ms");

  // 2. 上传 CDN (FILE type)
  const uploaded = await uploadMedia({ filePath, toUserId: USER, baseUrl: BASE, token: TOKEN, mediaType: 3 });

  // 3. 发送文件
  const clientId = "claude-file-" + Math.random().toString(36).slice(2, 10);
  const item = {
    type: 4,
    file_item: {
      media: { encrypt_query_param: uploaded.downloadEncryptedQueryParam, aes_key: Buffer.from(uploaded.aeskey).toString("base64"), encrypt_type: 1 },
      file_name: "语音消息.mp3",
      len: String(uploaded.fileSize),
    },
  };

  const headers = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": Buffer.from(String(crypto.randomBytes(4).readUInt32BE(0)), "utf-8").toString("base64"),
    "iLink-App-Id": "", "iLink-App-ClientVersion": "65547",
    Authorization: "Bearer " + TOKEN,
  };

  const res = await fetch(BASE + "/ilink/bot/sendmessage", {
    method: "POST", headers,
    body: JSON.stringify({ msg: { to_user_id: USER, client_id: clientId, message_type: 2, message_state: 2, item_list: [item] } }),
  });
  console.log("HTTP", res.status, await res.text());
  console.log("✅ 文件已发！微信下载 mp3 播放");
  await fs.unlink(filePath);
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
