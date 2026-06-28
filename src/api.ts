/** iLink API 封装 — 独立的 HTTP 请求层，零依赖 OpenClaw */
import crypto from "node:crypto";
import type {
  GetUpdatesReq,
  GetUpdatesResp,
  SendMessageReq,
  SendMessageResp,
} from "./types.js";

const DEFAULT_LONG_POLL_TIMEOUT_MS = 35_000;
const DEFAULT_API_TIMEOUT_MS = 15_000;

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": randomWechatUin(),
    "iLink-App-Id": "",
    "iLink-App-ClientVersion": "65547",
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

async function apiPost(params: {
  baseUrl: string;
  endpoint: string;
  body: string;
  token?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const base = ensureTrailingSlash(params.baseUrl);
  const url = new URL(params.endpoint, base);
  const headers = buildHeaders(params.token);
  const timeoutMs = params.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  // Combine external abort signal if provided
  if (params.abortSignal) {
    params.abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: params.body,
      signal: controller.signal,
    });
    clearTimeout(t);
    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${rawText.slice(0, 200)}`);
    }
    return rawText;
  } catch (err: any) {
    clearTimeout(t);
    if (err.name === "AbortError") throw err; // Re-throw for long-poll handling
    throw err;
  }
}

/** 长轮询获取新消息 */
export async function getUpdates(params: {
  baseUrl: string;
  token: string;
  getUpdatesBuf: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}): Promise<GetUpdatesResp> {
  const timeout = params.timeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS;
  try {
    const rawText = await apiPost({
      baseUrl: params.baseUrl,
      endpoint: "ilink/bot/getupdates",
      body: JSON.stringify({
        get_updates_buf: params.getUpdatesBuf,
        base_info: {
          channel_version: "weixin-claude-bridge-1.0.0",
          bot_agent: "ClaudeCode/1.0",
        },
      } as GetUpdatesReq),
      token: params.token,
      timeoutMs: timeout,
      abortSignal: params.abortSignal,
    });
    return JSON.parse(rawText) as GetUpdatesResp;
  } catch (err: any) {
    if (err.name === "AbortError") {
      // Normal timeout or external abort — return empty
      return { ret: 0, msgs: [], get_updates_buf: params.getUpdatesBuf };
    }
    throw err;
  }
}

/** 发送文本消息 */
export async function sendMessage(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  text: string;
  contextToken?: string;
}): Promise<SendMessageResp> {
  const clientId = `claude-${crypto.randomUUID().slice(0, 8)}`;
  const req: SendMessageReq = {
    msg: {
      from_user_id: "",
      to_user_id: params.toUserId,
      client_id: clientId,
      message_type: 2, // BOT
      message_state: 2, // FINISH
      item_list: params.text
        ? [{ type: 1, text_item: { text: params.text } }]
        : [],
      context_token: params.contextToken,
    },
  };
  const rawText = await apiPost({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/sendmessage",
    body: JSON.stringify(req),
    token: params.token,
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
  });
  const resp: SendMessageResp = JSON.parse(rawText);
  if (resp.ret && resp.ret !== 0) {
    throw new Error(`sendMessage ret=${resp.ret} errmsg=${resp.errmsg ?? "(none)"}`);
  }
  return resp;
}

/** 发送"正在输入"状态 */
export async function sendTyping(params: {
  baseUrl: string;
  token: string;
  ilinkUserId: string;
  status?: number; // 1=typing, 2=cancel
}): Promise<void> {
  await apiPost({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/sendtyping",
    body: JSON.stringify({
      ilink_user_id: params.ilinkUserId,
      status: params.status ?? 1,
      base_info: {},
    }),
    token: params.token,
    timeoutMs: 10_000,
  });
}

/** 获取 CDN 上传 URL */
export async function getUploadUrl(params: {
  baseUrl: string;
  token: string;
  filekey: string;
  media_type: number;
  to_user_id: string;
  rawsize: number;
  rawfilemd5: string;
  filesize: number;
  no_need_thumb?: boolean;
  aeskey: string;
}): Promise<{ upload_full_url?: string; upload_param?: string }> {
  const rawText = await apiPost({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/getuploadurl",
    body: JSON.stringify({
      filekey: params.filekey,
      media_type: params.media_type,
      to_user_id: params.to_user_id,
      rawsize: params.rawsize,
      rawfilemd5: params.rawfilemd5,
      filesize: params.filesize,
      no_need_thumb: params.no_need_thumb ?? true,
      aeskey: params.aeskey,
      base_info: {},
    }),
    token: params.token,
    timeoutMs: 15_000,
  });
  return JSON.parse(rawText);
}

/** 发送语音消息 */
export async function sendVoice(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  voiceItem: {
    downloadEncryptedQueryParam: string;
    aeskey: string; // hex
    playtime: number; // ms
    sampleRate?: number;
    encodeType?: number; // 6=silk 7=mp3
    text?: string; // voice-to-text
  };
  contextToken?: string;
}): Promise<void> {
  const clientId = `claude-voice-${crypto.randomUUID().slice(0, 8)}`;
  const item = {
    type: 3, // VOICE
    voice_item: {
      media: {
        encrypt_query_param: params.voiceItem.downloadEncryptedQueryParam,
        aes_key: Buffer.from(params.voiceItem.aeskey).toString("base64"),
        encrypt_type: 1,
      },
      encode_type: params.voiceItem.encodeType ?? 7, // default mp3
      sample_rate: params.voiceItem.sampleRate ?? 24000,
      playtime: params.voiceItem.playtime,
      text: params.voiceItem.text ?? "",
    },
  };

  await apiPost({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/sendmessage",
    body: JSON.stringify({
      msg: {
        from_user_id: "",
        to_user_id: params.toUserId,
        client_id: clientId,
        message_type: 2,
        message_state: 2,
        item_list: [item],
        context_token: params.contextToken ?? undefined,
      },
    }),
    token: params.token,
    timeoutMs: 15_000,
  });
}

/** 发送图片消息 */
export async function sendImage(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  downloadEncryptedQueryParam: string;
  aeskey: string; // hex
  midSize: number;
  contextToken?: string;
}): Promise<void> {
  const clientId = `claude-img-${crypto.randomUUID().slice(0, 8)}`;
  await apiPost({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/sendmessage",
    body: JSON.stringify({
      msg: {
        from_user_id: "",
        to_user_id: params.toUserId,
        client_id: clientId,
        message_type: 2,
        message_state: 2,
        item_list: [{
          type: 2, // IMAGE
          image_item: {
            media: {
              encrypt_query_param: params.downloadEncryptedQueryParam,
              aes_key: Buffer.from(params.aeskey).toString("base64"),
              encrypt_type: 1,
            },
            mid_size: params.midSize,
          },
        }],
        context_token: params.contextToken ?? undefined,
      },
    }),
    token: params.token,
    timeoutMs: 15_000,
  });
}

/** 通知服务器启动 */
export async function notifyStart(params: {
  baseUrl: string;
  token: string;
}): Promise<void> {
  try {
    await apiPost({
      baseUrl: params.baseUrl,
      endpoint: "ilink/bot/msg/notifystart",
      body: JSON.stringify({ base_info: {} }),
      token: params.token,
      timeoutMs: 10_000,
    });
  } catch {
    // Non-critical
  }
}

/** 通知服务器停止 */
export async function notifyStop(params: {
  baseUrl: string;
  token: string;
}): Promise<void> {
  try {
    await apiPost({
      baseUrl: params.baseUrl,
      endpoint: "ilink/bot/msg/notifystop",
      body: JSON.stringify({ base_info: {} }),
      token: params.token,
      timeoutMs: 10_000,
    });
  } catch {
    // Non-critical
  }
}
