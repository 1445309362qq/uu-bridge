/** 会话管理模块 — 持久化对话历史和 contextToken */
import fs from "node:fs";
import path from "node:path";

export interface Session {
  userId: string;
  contextToken: string;
  lastActiveAt: number;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  createdAt: number;
  /** 亲密度 0-100，影响主动消息频率 */
  familiarity: number;
}

export interface SessionStore {
  get(userId: string): Session | undefined;
  set(userId: string, session: Session): void;
  create(userId: string, contextToken: string): Session;
  list(): Session[];
  save(): void;
  cleanup(maxAgeMs?: number): void;
}

/** 创建基于文件的会话存储 */
export function createFileSessionStore(dataDir: string): SessionStore {
  const sessionsFile = path.join(dataDir, "sessions.json");

  // 确保目录存在
  fs.mkdirSync(dataDir, { recursive: true });

  // 加载已有会话
  let sessions = new Map<string, Session>();
  try {
    if (fs.existsSync(sessionsFile)) {
      const raw = JSON.parse(fs.readFileSync(sessionsFile, "utf-8"));
      for (const [k, v] of Object.entries(raw)) {
        sessions.set(k, v as Session);
      }
    }
  } catch {
    console.warn("读取会话文件失败，使用空会话");
  }

  const save = () => {
    try {
      const obj: Record<string, Session> = {};
      for (const [k, v] of sessions) {
        obj[k] = v;
      }
      fs.writeFileSync(sessionsFile, JSON.stringify(obj, null, 2), "utf-8");
    } catch {
      console.warn("保存会话文件失败");
    }
  };

  // 定期保存
  const saveInterval = setInterval(save, 60_000);
  // 进程退出时保存
  process.on("SIGINT", () => { save(); clearInterval(saveInterval); });
  process.on("SIGTERM", () => { save(); clearInterval(saveInterval); });

  return {
    get(userId: string): Session | undefined {
      return sessions.get(userId);
    },

    set(userId: string, session: Session): void {
      sessions.set(userId, session);
    },

    create(userId: string, contextToken: string): Session {
      const session: Session = {
        userId,
        contextToken,
        lastActiveAt: Date.now(),
        history: [],
        createdAt: Date.now(),
        familiarity: 0,
      };
      sessions.set(userId, session);
      return session;
    },

    list(): Session[] {
      return [...sessions.values()];
    },

    save,

    cleanup(maxAgeMs: number = 7 * 24 * 3600_000): void {
      const now = Date.now();
      for (const [userId, session] of sessions) {
        if (now - session.lastActiveAt > maxAgeMs) {
          sessions.delete(userId);
        }
      }
      save();
    },
  };
}

/** 创建内存会话存储（用于测试或不需要持久化） */
export function createMemorySessionStore(): SessionStore {
  const sessions = new Map<string, Session>();

  return {
    get(userId: string): Session | undefined {
      return sessions.get(userId);
    },
    set(userId: string, session: Session): void {
      sessions.set(userId, session);
    },
    create(userId: string, contextToken: string): Session {
      return {
        userId,
        contextToken,
        lastActiveAt: Date.now(),
        history: [],
        createdAt: Date.now(),
        familiarity: 0,
      };
    },
    list(): Session[] {
      return [...sessions.values()];
    },
    save() {},
    cleanup(_maxAgeMs?: number) {},
  };
}
