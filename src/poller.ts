/** 消息长轮询模块 */
import { getUpdates, notifyStart, notifyStop } from "./api.js";
import type { WeixinMessage, MessageItem } from "./types.js";
import { MessageItemType } from "./types.js";

export interface ParsedMessage {
  fromUserId: string;
  toUserId: string;
  messageId: number | undefined;
  text: string;
  contextToken: string;
  imageUrl?: string;
  voiceText?: string;
  isMedia: boolean;
  raw: WeixinMessage;
}

/** 从消息中提取文本 */
function extractText(msg: WeixinMessage): string {
  if (!msg.item_list) return "";
  return msg.item_list
    .filter((item) => item.type === MessageItemType.TEXT)
    .map((item) => item.text_item?.text ?? "")
    .join("\n");
}

/** 从消息中提取图片信息 */
function extractImage(msg: WeixinMessage): string | undefined {
  if (!msg.item_list) return undefined;
  const img = msg.item_list.find((item) => item.type === MessageItemType.IMAGE);
  if (img?.image_item) {
    // 优先使用 full_url
    return img.image_item.media?.full_url || img.image_item.url;
  }
  return undefined;
}

/** 从消息中提取语音转文字 */
function extractVoiceText(msg: WeixinMessage): string | undefined {
  if (!msg.item_list) return undefined;
  const voice = msg.item_list.find((item) => item.type === MessageItemType.VOICE);
  return voice?.voice_item?.text;
}

/** 解析原始消息为结构化格式 */
export function parseMessage(msg: WeixinMessage): ParsedMessage | null {
  const text = extractText(msg);
  const imageUrl = extractImage(msg);
  const voiceText = extractVoiceText(msg);

  // 跳过空消息和 bot 自己的消息
  if (!text && !imageUrl && !voiceText) return null;
  if (msg.message_type === 2) return null; // BOT message

  return {
    fromUserId: msg.from_user_id ?? "",
    toUserId: msg.to_user_id ?? "",
    messageId: msg.message_id,
    text,
    contextToken: msg.context_token ?? "",
    imageUrl,
    voiceText,
    isMedia: !!(imageUrl || voiceText),
    raw: msg,
  };
}

export interface PollerCallbacks {
  onMessage: (msg: ParsedMessage) => Promise<string | null>;
  onError: (err: Error) => void;
  onStatusChange: (status: "connected" | "disconnected" | "reconnecting") => void;
}

/** 长轮询循环 */
export async function runPollLoop(params: {
  baseUrl: string;
  token: string;
  callbacks: PollerCallbacks;
  abortSignal: AbortSignal;
}): Promise<void> {
  const { baseUrl, token, callbacks, abortSignal } = params;

  // 通知服务器启动
  await notifyStart({ baseUrl, token });
  callbacks.onStatusChange("connected");

  let updatesBuf = "";
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;

  while (!abortSignal.aborted) {
    try {
      const resp = await getUpdates({
        baseUrl,
        token,
        getUpdatesBuf: updatesBuf,
        abortSignal,
      });

      // 检查错误码
      if (resp.errcode && resp.errcode !== 0) {
        if (resp.errcode === -14) {
          // Session timeout — 清空 buf 重试
          console.warn("⚠️  Session timeout, resetting buffer");
          updatesBuf = "";
        }
        throw new Error(`getUpdates errcode=${resp.errcode} errmsg=${resp.errmsg ?? ""}`);
      }

      consecutiveErrors = 0;
      updatesBuf = resp.get_updates_buf ?? "";

      // 处理消息
      const msgs = resp.msgs ?? [];
      for (const rawMsg of msgs) {
        const parsed = parseMessage(rawMsg);
        if (!parsed) continue;

        try {
          const replyText = await callbacks.onMessage(parsed);
          // 如果回调返回了文本，说明需要回复（但 sendMessage 在 claude.ts 里处理）
          // 这里只是触发回调，回复逻辑由上层处理
        } catch (err: any) {
          console.error(`处理消息失败: ${err.message}`);
        }
      }
    } catch (err: any) {
      if (abortSignal.aborted) break;

      if (err.name === "AbortError") {
        // 正常超时，继续循环
        continue;
      }

      consecutiveErrors++;
      console.error(`轮询错误 (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err.message}`);

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        callbacks.onError(new Error(`连续 ${MAX_CONSECUTIVE_ERRORS} 次错误，停止轮询`));
        callbacks.onStatusChange("disconnected");
        return;
      }

      callbacks.onStatusChange("reconnecting");
      // 退避重试
      await new Promise((r) => setTimeout(r, Math.min(consecutiveErrors * 2000, 30_000)));
    }
  }

  // 清理
  await notifyStop({ baseUrl, token });
  callbacks.onStatusChange("disconnected");
}
