/** iLink 协议类型 — 镜像自 @tencent-weixin/openclaw-weixin */

export interface BaseInfo {
  channel_version?: string;
  bot_agent?: string;
}

export interface GetUpdatesReq {
  get_updates_buf?: string;
}

export interface GetUpdatesResp {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

export interface WeixinMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  client_id?: string;
  create_time_ms?: number;
  update_time_ms?: number;
  session_id?: string;
  message_type?: number;
  message_state?: number;
  item_list?: MessageItem[];
  context_token?: string;
  run_id?: string;
}

export interface MessageItem {
  type?: number;
  create_time_ms?: number;
  update_time_ms?: number;
  is_completed?: boolean;
  msg_id?: string;
  text_item?: TextItem;
  image_item?: ImageItem;
  voice_item?: VoiceItem;
  file_item?: FileItem;
  video_item?: VideoItem;
}

export interface TextItem {
  text?: string;
}

export interface ImageItem {
  media?: CDNMedia;
  thumb_media?: CDNMedia;
  aeskey?: string;
  url?: string;
  mid_size?: number;
  thumb_size?: number;
}

export interface VoiceItem {
  media?: CDNMedia;
  encode_type?: number;
  text?: string;
}

export interface FileItem {
  media?: CDNMedia;
  file_name?: string;
  len?: string;
}

export interface VideoItem {
  media?: CDNMedia;
  thumb_media?: CDNMedia;
  video_size?: number;
}

export interface CDNMedia {
  encrypt_query_param?: string;
  aes_key?: string;
  encrypt_type?: number;
  full_url?: string;
}

export interface SendMessageReq {
  msg?: {
    from_user_id?: string;
    to_user_id?: string;
    client_id?: string;
    message_type?: number;
    message_state?: number;
    item_list?: MessageItem[];
    context_token?: string;
    run_id?: string;
  };
}

export interface SendMessageResp {
  ret?: number;
  errmsg?: string;
}

export const MessageType = { NONE: 0, USER: 1, BOT: 2 } as const;
export const MessageItemType = { NONE: 0, TEXT: 1, IMAGE: 2, VOICE: 3, FILE: 4, VIDEO: 5 } as const;
export const MessageState = { NEW: 0, GENERATING: 1, FINISH: 2 } as const;

export interface BotConfig {
  token: string;
  baseUrl: string;
  userId?: string;
  name?: string;
}

export interface SessionData {
  contextToken: string;
  lastActiveAt: number;
  userId: string;
}
