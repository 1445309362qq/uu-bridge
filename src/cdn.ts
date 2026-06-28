/** CDN 上传模块 — AES-128-ECB 加密 + 上传到微信 CDN */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { getUploadUrl } from "./api.js";

function aesEcbPaddedSize(plainSize: number): number {
  return Math.ceil(plainSize / 16) * 16;
}

function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const paddedSize = aesEcbPaddedSize(plaintext.length);
  const padded = Buffer.alloc(paddedSize);
  plaintext.copy(padded);
  // PKCS7 padding
  const padLen = paddedSize - plaintext.length;
  padded.fill(padLen, plaintext.length);

  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]);
}

export interface UploadedMedia {
  filekey: string;
  downloadEncryptedQueryParam: string;
  aeskey: string; // hex
  fileSize: number;
  fileSizeCiphertext: number;
}

/** 上传媒体文件到微信 CDN */
export async function uploadMedia(params: {
  filePath: string;
  toUserId: string;
  baseUrl: string;
  token: string;
  mediaType: number; // 1=image 2=video 3=file 4=voice
}): Promise<UploadedMedia> {
  const { filePath, toUserId, baseUrl, token, mediaType } = params;

  const plaintext = await fs.readFile(filePath);
  const rawsize = plaintext.length;
  const rawfilemd5 = crypto.createHash("md5").update(plaintext).digest("hex");
  const filesize = aesEcbPaddedSize(rawsize);
  const filekey = crypto.randomBytes(16).toString("hex");
  const aeskey = crypto.randomBytes(16);

  // 1. 获取上传 URL
  const uploadResp = await getUploadUrl({
    baseUrl,
    token,
    filekey,
    media_type: mediaType,
    to_user_id: toUserId,
    rawsize,
    rawfilemd5,
    filesize,
    no_need_thumb: true,
    aeskey: aeskey.toString("hex"),
  });

  // 2. 加密
  const ciphertext = encryptAesEcb(plaintext, aeskey);

  // 3. 构造 CDN 上传 URL（对标原始包 buildCdnUploadUrl）
  let cdnUrl: string;
  const trimmedFull = uploadResp.upload_full_url?.trim();
  if (trimmedFull) {
    cdnUrl = trimmedFull;
  } else if (uploadResp.upload_param) {
    const cdnBase = "https://snsna.weixin.qq.com";
    cdnUrl = `${cdnBase}/upload?encrypted_query_param=${encodeURIComponent(uploadResp.upload_param)}&filekey=${encodeURIComponent(filekey)}`;
  } else {
    throw new Error(`上传 URL 获取失败: ${JSON.stringify(uploadResp)}`);
  }

  const res = await fetch(cdnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Uint8Array(ciphertext),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CDN 上传失败 ${res.status}: ${err}`);
  }

  const downloadParam = res.headers.get("x-encrypted-param") || "";

  return {
    filekey,
    downloadEncryptedQueryParam: downloadParam,
    aeskey: aeskey.toString("hex"),
    fileSize: rawsize,
    fileSizeCiphertext: filesize,
  };
}
