import type { ChatHistoryEntry, HomeAgentCta } from '@/lib/api';
import { storage, registerLegacy } from '@/lib/storage';
import { removeCloudItem, setCloudItem } from '@/lib/cloudStore';

/**
 * 首页对话持久化（单会话，localStorage，7 天过期）
 * ----------------------------------------------------------------
 * 后端 /api/v1/agent/home/stream 是无状态的，多轮上下文完全靠前端每次请求
 * 带上 history。首页原本把 messages 放在 useState 里，App Router 路由跳转会
 * 卸载组件 → 从别的模块页回到首页时对话全部丢失，多轮上下文也接不上。
 *
 * 本模块负责把对话快照落到 localStorage，回首页时恢复。
 */

const KEY = 'om_home_chat';
// P2-1/A 收口：旧键惰性迁移，用户已存对话零丢失
registerLegacy('oraclemind_home_chat_v1', KEY);
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 最多保存 20 轮（40 条），防止 7 天内无限堆积 */
const MAX_STORED = 40;
/** 请求时最多带 10 轮（20 条），避免 history 过长导致 token 膨胀 */
const MAX_SENT = 20;

export interface HomeChatSnapshot {
  messages: ChatHistoryEntry[];
  cta: HomeAgentCta | null;
  updatedAt: number;
}

function isEntry(v: unknown): v is ChatHistoryEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    (e.role === 'user' || e.role === 'assistant') &&
    typeof e.content === 'string'
  );
}

/** 从尾部裁剪，并保证首条是 user（history 以 assistant 开头会让部分模型困惑） */
function trimTail(messages: ChatHistoryEntry[], max: number): ChatHistoryEntry[] {
  let out = messages.length > max ? messages.slice(-max) : messages;
  if (out.length && out[0].role !== 'user') out = out.slice(1);
  return out;
}

/** 读取快照；无数据 / 已过期 / 数据损坏均返回 null（并顺手清掉脏数据） */
export function loadHomeChat(): HomeChatSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    if (!Array.isArray(d.messages)) return null;

    // 过期：清掉再返回 null，避免下轮重复解析
    const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : 0;
    if (!updatedAt || Date.now() - updatedAt > TTL_MS) {
      // P1-8：过期必须连云端一起清，否则下次 pull 会把过期对话「复活」回本地
      removeCloudItem(KEY);
      return null;
    }

    const messages = d.messages.filter(isEntry);
    if (messages.length === 0) return null;

    // 中断态修正：上次流式未结束就离开页面时，尾条 assistant 是空串
    const last = messages[messages.length - 1];
    if (last.role === 'assistant' && last.content.trim() === '') {
      messages[messages.length - 1] = {
        role: 'assistant',
        content: '⚠️ 上次的回答被中断了，有需要可以直接再问我～',
      };
    }

    return {
      messages,
      cta: (d.cta as HomeAgentCta | null) ?? null,
      updatedAt,
    };
  } catch {
    // 解析失败（脏数据/隐私模式）→ 当作没有历史
    try {
      removeCloudItem(KEY);
    } catch { /* 存储不可用则忽略 */ }
    return null;
  }
}

/** 写入快照（自动裁剪） */
export function saveHomeChat(messages: ChatHistoryEntry[], cta: HomeAgentCta | null): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = trimTail(messages, MAX_STORED);
    // 空快照：直接跳过，**不删已有存档**。
    // 原因：清空对话有 clearHomeChat() 显式负责；而首页挂载初期 messages 可能
    // 还是初始值（hydrate 的 setState 尚未生效），若此时因空数组 removeItem，
    // 会把用户还没恢复的存档删掉 —— 表现为「跳走再回首页，对话没了」。
    if (trimmed.length === 0) return;
    const payload = JSON.stringify({ messages: trimmed, cta, updatedAt: Date.now() });
    // 关键：必须走 setCloudItem（本地 + 异步上云），而不是 storage.setItem 只写本地。
    // 否则本地最新对话不会同步到云端，下次刷新时 syncCloud 以「云端为准」把那份
    // 旧的对话拉回来覆盖本地 —— 表现为「清空/重聊后刷新，旧聊天记录复活」。
    setCloudItem(KEY, payload);
  } catch { /* 配额满 / 隐私模式：静默降级，不影响对话 */ }
}

/** 清空（本地 + 云端一并清除，避免刷新被 syncCloud 拉回旧对话） */
export function clearHomeChat(): void {
  if (typeof window === 'undefined') return;
  try {
    removeCloudItem(KEY);
    // 兜底清掉迁移前的 legacy 键，否则 getItem(KEY) 缺失时会回退到它并复活旧对话
    removeCloudItem('oraclemind_home_chat_v1');
  } catch { /* ignore */ }
}

/** 构造请求用的 history（限制轮数） */
export function toRequestHistory(messages: ChatHistoryEntry[]): ChatHistoryEntry[] {
  return trimTail(messages, MAX_SENT);
}
