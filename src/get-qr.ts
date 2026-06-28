/** 快速获取微信登录二维码，不轮询 */
import crypto from "node:crypto";

const FIXED_BASE_URL = "https://ilinkai.weixin.qq.com";

function randomWechatUin(): string {
  const u32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(u32), "utf-8").toString("base64");
}

async function main() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": randomWechatUin(),
    "iLink-App-Id": "",
    "iLink-App-ClientVersion": "65547",
  };

  console.error("正在请求微信服务器...");

  try {
    const res = await fetch(
      `${FIXED_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=3`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ local_token_list: [] }),
      },
    );

    const data: any = await res.json();
    console.error(`HTTP ${res.status}`);

    if (data.qrcode_img_content) {
      console.log(data.qrcode_img_content);
      console.error("✅ 二维码链接已获取，请用浏览器打开上面的链接扫码");
    } else {
      console.error("❌ 响应内容:", JSON.stringify(data, null, 2));
    }
  } catch (err: any) {
    console.error("❌ 请求失败:", err.message);
  }
}

main();
