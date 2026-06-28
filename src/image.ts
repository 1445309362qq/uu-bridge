/** 图片搜索 + 发送 — 网上搜真实照片，符合女大学生身份 */
import { uploadMedia } from "./cdn.js";
import { sendImage } from "./api.js";
import type { SessionStore } from "./session.js";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";

// ============================================================
// 图片搜索词库 — 全部符合 uu（遵义女大学生）的人设
// ============================================================
const SEARCH_TERMS = [
  // 日常随手拍
  { term: "大学女生宿舍 桌面 课本 奶茶 真实", weight: 15 },
  { term: "女生宿舍 上铺 凌乱 随手拍", weight: 12 },
  { term: "大学女生 教室 上课 随手拍", weight: 10 },
  { term: "女生 校园 散步 操场 真实", weight: 10 },

  // 生活分享
  { term: "女生 奶茶 自拍 大学 随手", weight: 12 },
  { term: "大学食堂 饭菜 吐槽 真实", weight: 8 },
  { term: "女生 新美甲 晒图 宿舍", weight: 10 },
  { term: "校园 下雨 窗外 女生宿舍", weight: 8 },

  // 出门
  { term: "女生 酒吧 闺蜜 自拍 灯光", weight: 8 },
  { term: "女生 逛街 自拍 试衣间", weight: 7 },
];

let totalWeight = 0;
for (const t of SEARCH_TERMS) totalWeight += t.weight;

function pickSearchTerm(): string {
  let r = Math.random() * totalWeight;
  for (const t of SEARCH_TERMS) {
    r -= t.weight;
    if (r <= 0) return t.term;
  }
  return SEARCH_TERMS[0]!.term;
}

// ============================================================
// DuckDuckGo 图片搜索
// ============================================================
async function searchImages(query: string, count: number = 20): Promise<string[]> {
  try {
    const { image_search } = await import("duckduckgo-images-api");
    const results = await image_search({
      query,
      moderate: false, // 不过滤
      iterations: 2,
      retries: 2,
    });
    // 提取图片 URL
    const urls: string[] = [];
    for (const r of results) {
      if (r.image && typeof r.image === "string" && r.image.startsWith("http")) {
        urls.push(r.image);
      }
    }
    return urls.slice(0, count);
  } catch (err: any) {
    console.error(`图片搜索失败: ${err.message}`);
    return [];
  }
}

/** 从 URL 下载图片 */
async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`下载失败 ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`图片太小: ${buf.length} bytes`);
  return buf;
}

// ============================================================
// 公共接口
// ============================================================
export async function sendImageMessage(params: {
  toUserId: string;
  baseUrl: string;
  token: string;
  sessionStore: SessionStore;
}): Promise<void> {
  const { toUserId, baseUrl, token, sessionStore } = params;

  const query = pickSearchTerm();
  console.log(`🔍 搜索图片: ${query}`);

  // 1. 搜索
  const urls = await searchImages(query);
  if (urls.length === 0) {
    console.log("  ⚠️  无搜索结果，跳过");
    return;
  }

  // 2. 随机选一张，尝试下载
  const shuffled = urls.sort(() => Math.random() - 0.5);
  let imageBuffer: Buffer | null = null;
  let successUrl = "";

  for (const url of shuffled.slice(0, 5)) {
    try {
      imageBuffer = await downloadImage(url);
      successUrl = url;
      break;
    } catch {
      continue;
    }
  }

  if (!imageBuffer) {
    console.log("  ⚠️  所有图片下载失败");
    return;
  }

  console.log(`  ✅ 下载成功: ${successUrl.slice(0, 60)}...`);

  // 3. 保存临时文件
  const dir = path.join(os.tmpdir(), "weixin-image");
  await fs.mkdir(dir, { recursive: true });
  const fileName = `img-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, imageBuffer);

  try {
    // 4. 上传微信 CDN
    const uploaded = await uploadMedia({
      filePath,
      toUserId,
      baseUrl,
      token,
      mediaType: 1,
    });

    // 5. 发送
    const session = sessionStore.get(toUserId);
    await sendImage({
      baseUrl,
      token,
      toUserId,
      downloadEncryptedQueryParam: uploaded.downloadEncryptedQueryParam,
      aeskey: uploaded.aeskey,
      midSize: uploaded.fileSizeCiphertext,
      contextToken: session?.contextToken,
    });

    console.log(`🖼️  图片已发送`);
  } finally {
    try { await fs.unlink(filePath); } catch {}
  }
}

/** 图片频率随亲密度动态变化 */
export function shouldSendImage(familiarity: number = 0): boolean {
  const rate = 0.10 + (familiarity / 100) * 0.50; // 10% → 60%
  return Math.random() < rate;
}
