/** QR 码登录模块 */
import crypto from "node:crypto";
import readline from "node:readline";

const FIXED_BASE_URL = "https://ilinkai.weixin.qq.com";
const DEFAULT_BOT_TYPE = "3";
const QR_LONG_POLL_TIMEOUT_MS = 35_000;

interface QRCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface StatusResponse {
  status: "wait" | "scaned" | "confirmed" | "expired" | "scaned_but_redirect" | "need_verifycode" | "verify_code_blocked" | "binded_redirect";
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
  redirect_host?: string;
}

export interface LoginResult {
  token: string;
  accountId: string;
  baseUrl: string;
  userId: string;
}

function buildHeaders(): Record<string, string> {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": Buffer.from(String(uint32), "utf-8").toString("base64"),
    "iLink-App-Id": "",
    "iLink-App-ClientVersion": "65547",
  };
}

async function apiPost(endpoint: string, body: string): Promise<string> {
  const url = new URL(endpoint, FIXED_BASE_URL.endsWith("/") ? FIXED_BASE_URL : `${FIXED_BASE_URL}/`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: buildHeaders(),
    body,
  });
  return res.text();
}

async function apiGet(endpoint: string, timeoutMs: number): Promise<string> {
  const url = new URL(endpoint, FIXED_BASE_URL.endsWith("/") ? FIXED_BASE_URL : `${FIXED_BASE_URL}/`);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: buildHeaders(),
      signal: controller.signal,
    });
    clearTimeout(t);
    return res.text();
  } catch (err: any) {
    clearTimeout(t);
    if (err.name === "AbortError") return '{"status":"wait"}';
    return '{"status":"wait"}';
  }
}

/** 从 stdin 读取用户输入 */
async function readLine(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** 终端显示二维码 */
async function displayQRCode(qrcodeUrl: string): Promise<void> {
  try {
    // 动态 import qrcode-terminal (兼容 ESM)
    const qrterm = await import("qrcode-terminal");
    qrterm.default.generate(qrcodeUrl, { small: true });
    console.log(`\n📱 请用手机微信扫描终端中的二维码`);
  } catch {
    // 降级：直接打印链接
    console.log("\n(无法生成终端二维码，请使用下方链接)");
  }
  console.log(`\n🔗 备用链接（用浏览器打开扫码）：\n${qrcodeUrl}\n`);
}

/** 完整登录流程 */
export async function login(): Promise<LoginResult> {
  console.log("🚀 正在获取登录二维码...\n");

  // Step 1: 获取二维码
  const qrRaw = await apiPost(
    `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(DEFAULT_BOT_TYPE)}`,
    JSON.stringify({ local_token_list: [] }),
  );
  const qrResp: QRCodeResponse = JSON.parse(qrRaw);

  if (!qrResp.qrcode_img_content) {
    throw new Error("获取二维码失败：" + qrRaw);
  }

  let qrcode = qrResp.qrcode;
  let qrcodeUrl = qrResp.qrcode_img_content;

  console.log("📱 请用手机微信扫描以下二维码：\n");
  await displayQRCode(qrcodeUrl);

  // Step 2: 长轮询等待扫码确认
  let currentBaseUrl = FIXED_BASE_URL;
  let scannedPrinted = false;
  let pendingVerifyCode: string | undefined;
  let qrRefreshCount = 1;
  const MAX_QR_REFRESH = 3;
  const deadline = Date.now() + 480_000; // 8分钟超时

  console.log("⏳ 等待扫码...\n");

  while (Date.now() < deadline) {
    let endpoint = `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`;
    if (pendingVerifyCode) {
      endpoint += `&verify_code=${encodeURIComponent(pendingVerifyCode)}`;
    }

    const raw = await apiGet(endpoint, QR_LONG_POLL_TIMEOUT_MS);
    let statusResp: StatusResponse;
    try {
      statusResp = JSON.parse(raw);
    } catch {
      continue;
    }

    switch (statusResp.status) {
      case "wait":
        process.stdout.write(".");
        break;

      case "scaned":
        if (pendingVerifyCode) {
          pendingVerifyCode = undefined;
        }
        if (!scannedPrinted) {
          console.log("\n✅ 已扫码，正在确认...");
          scannedPrinted = true;
        }
        break;

      case "need_verifycode": {
        const prompt = pendingVerifyCode
          ? "❌ 数字不匹配，请重新输入："
          : "请输入手机微信上显示的数字：";
        pendingVerifyCode = await readLine(prompt);
        continue; // 立即重试
      }

      case "expired":
      case "verify_code_blocked": {
        qrRefreshCount++;
        if (qrRefreshCount > MAX_QR_REFRESH) {
          throw new Error("二维码多次失效，请重新运行程序。");
        }
        console.log(`\n🔄 二维码已过期，正在刷新 (${qrRefreshCount}/${MAX_QR_REFRESH})...`);
        const refreshRaw = await apiPost(
          `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(DEFAULT_BOT_TYPE)}`,
          JSON.stringify({ local_token_list: [] }),
        );
        const refreshResp: QRCodeResponse = JSON.parse(refreshRaw);
        // 重新赋值 qrcode 和 qrcodeUrl
        qrcode = refreshResp.qrcode;
        qrcodeUrl = refreshResp.qrcode_img_content;
        pendingVerifyCode = undefined;
        scannedPrinted = false;
        console.log("🔄 新二维码：\n");
        await displayQRCode(refreshResp.qrcode_img_content);
        break;
      }

      case "binded_redirect":
        console.log("\n✅ 已连接过此 Claude 实例，无需重复连接。");
        throw new Error("ALREADY_CONNECTED");

      case "scaned_but_redirect": {
        const host = statusResp.redirect_host;
        if (host) {
          currentBaseUrl = `https://${host}`;
          console.log(`\n🔀 重定向到 ${host}`);
        }
        break;
      }

      case "confirmed": {
        if (!statusResp.ilink_bot_id || !statusResp.bot_token) {
          throw new Error("登录确认但缺少必要信息。");
        }
        console.log("\n✅ 登录成功！\n");
        return {
          token: statusResp.bot_token,
          accountId: statusResp.ilink_bot_id,
          baseUrl: statusResp.baseurl || currentBaseUrl,
          userId: statusResp.ilink_user_id || "",
        };
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error("登录超时，请重新运行程序。");
}

/** 快速检查是否已有保存的凭证 */
export interface SavedCredentials {
  token: string;
  accountId: string;
  baseUrl: string;
  userId: string;
}
