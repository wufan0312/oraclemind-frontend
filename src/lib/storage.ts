// src/lib/storage.ts
// 统一前端 localStorage 访问层（P2-1 / P2-2）
//
// 原则：
//  1. 单一出口：所有 localStorage 读写经本模块（grep `localStorage.` 应只剩本文件）。
//  2. 零破坏：registerLegacy(旧键, 新键) 注册后，读取新键若缺失会自动回退旧键、
//     把数据复制到新键并删除旧键（惰性迁移），绝不丢失用户已存数据。
//  3. 命名规范：统一 om_<owner>_<scope>_<entity>[:vN]（owner 缺省 anon）。
//  4. SSR / 隐私模式 / 配额满：全部 try/catch 兜底，绝不抛错阻断主流程。
//  5. 配额守卫（§4.5）：单键 ≤200KB、总配额 ≤4MB、超限按最旧优先 LRU 砍半。

const APP = 'om';

// ===== 配额守卫（§4.5：单键 ≤200KB / 总配额 ≤4MB / 超限 LRU 砍半）=====
const META_KEY = 'om:_meta_quota'; // 配额元数据：{ 键 → 最近写入时间戳 }，自身不计入配额
const MAX_KEY_BYTES = 200 * 1024; // 单键上限 200KB
const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 总配额 4MB
// 受保护前缀：身份/偏好/离线副本类键不参与 LRU 淘汰（用户数据不可丢）
const PROTECTED_PREFIXES = [
  'om_auth',
  'om_home_chat',
  'om_ui_',
  'om_pref',
  'om_user_birth',
  'om_visitor',
  'om_cross_readings',
  'om_healing',
];

type QuotaMeta = Record<string, number>;

/** UTF-8 字节长度（用于配额统计）。 */
function _byteLength(s: string): number {
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    // 极老旧环境无 TextEncoder：退化为字符数近似
    return s.length;
  }
}

/** 直接写原生 localStorage（绕过配额守卫，专供写 META_KEY 自身，避免递归）。 */
function _rawSet(key: string, value: string): void {
  window.localStorage.setItem(key, value);
}

function _readMeta(): QuotaMeta {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as QuotaMeta) : {};
  } catch {
    return {};
  }
}

function _writeMeta(meta: QuotaMeta): void {
  try {
    _rawSet(META_KEY, JSON.stringify(meta));
  } catch {
    /* 隐私模式 / 配额满：元数据时序不重要，忽略 */
  }
}

/** 是否受保护（不参与 LRU 淘汰）。 */
function _isProtected(key: string): boolean {
  return PROTECTED_PREFIXES.some((p) => key === p || key.startsWith(p));
}

/** 超限时按最旧优先淘汰非保护键，直到回到总配额以内。 */
function _enforceTotalQuota(): void {
  if (!hasWindow()) return;
  const meta = _readMeta();
  let total = 0;
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || k === META_KEY) continue;
      keys.push(k);
      try {
        const v = window.localStorage.getItem(k);
        if (v) total += _byteLength(v);
      } catch {
        /* ignore */
      }
    }
  } catch {
    return;
  }

  if (total <= MAX_TOTAL_BYTES) return;

  // 最旧优先（无时间戳的视为最早）
  const candidates = keys
    .filter((k) => !_isProtected(k))
    .sort((a, b) => (meta[a] ?? 0) - (meta[b] ?? 0));

  for (const k of candidates) {
    if (total <= MAX_TOTAL_BYTES) break;
    try {
      const v = window.localStorage.getItem(k);
      if (v) total -= _byteLength(v);
      window.localStorage.removeItem(k);
      delete meta[k];
    } catch {
      /* ignore */
    }
  }
  _writeMeta(meta);
}

/** 配额用量快照（调试 / 运维用）。 */
export function getQuotaStats(): { totalBytes: number; maxBytes: number; keyCount: number } {
  if (!hasWindow()) return { totalBytes: 0, maxBytes: MAX_TOTAL_BYTES, keyCount: 0 };
  let total = 0;
  let count = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || k === META_KEY) continue;
      const v = window.localStorage.getItem(k);
      if (v) {
        total += _byteLength(v);
        count++;
      }
    }
  } catch {
    /* ignore */
  }
  return { totalBytes: total, maxBytes: MAX_TOTAL_BYTES, keyCount: count };
}

export function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** 规范键构造器：om_<owner>_<scope>_<entity>[:vN] */
export function buildKey(owner: string | undefined, scope: string, entity: string, version?: number): string {
  const o = owner && owner !== 'anon' ? owner : 'anon';
  const base = [APP, o, scope, entity].join('_');
  return version ? `${base}:v${version}` : base;
}

// 新键 → 旧键 映射表（惰性迁移用）
const CANON_TO_LEGACY: Record<string, string> = {};

/** 注册旧键到新键的迁移关系；读取新键时若缺失则尝试旧键并迁移。 */
export function registerLegacy(legacy: string, canonical: string): void {
  if (legacy && canonical && legacy !== canonical) {
    CANON_TO_LEGACY[canonical] = legacy;
  }
}

/** 读取字符串；带惰性迁移。返回 null 表示无值或环境不可用。 */
export function getItem(key: string): string | null {
  if (!hasWindow()) return null;
  try {
    const hit = window.localStorage.getItem(key);
    if (hit != null) return hit;
    const legacy = CANON_TO_LEGACY[key];
    if (legacy) {
      const lh = window.localStorage.getItem(legacy);
      if (lh != null) {
        // 走 setItem 纳入配额记账与守卫
        setItem(key, lh);
        removeItem(legacy);
        return lh;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** 读取并 JSON.parse；解析失败返回 null。 */
export function getJSON<T = unknown>(key: string): T | null {
  const raw = getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 写入字符串（JSON 请自行 stringify，或用 setJSON）。 */
export function setItem(key: string, value: string): void {
  if (!hasWindow()) return;
  const len = _byteLength(value);
  if (len > MAX_KEY_BYTES) {
    console.warn(`[storage] 单键「${key}」大小 ${len}B 超过 200KB 上限，已拒绝写入`);
    return;
  }
  try {
    window.localStorage.setItem(key, value);
    const meta = _readMeta();
    meta[key] = Date.now();
    _writeMeta(meta);
    _enforceTotalQuota();
  } catch {
    /* 配额满 / 隐私模式：静默跳过，不影响主流程 */
  }
}

/** 写入对象（自动 JSON.stringify）。 */
export function setJSON(key: string, value: unknown): void {
  if (!hasWindow()) return;
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return;
  }
  setItem(key, serialized);
}

/** 删除键（同步清理配额元数据）。 */
export function removeItem(key: string): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(key);
    const meta = _readMeta();
    if (key in meta) {
      delete meta[key];
      _writeMeta(meta);
    }
  } catch {
    /* ignore */
  }
}

/** 是否存在（任何值）。 */
export function has(key: string): boolean {
  return getItem(key) != null;
}

/** 列举全部键（仅浏览器环境）。 */
export function allKeys(): string[] {
  if (!hasWindow()) return [];
  const out: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) out.push(k);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** 按前缀清理（返回清理条数），预留的手动维护入口。 */
export function clearByPrefix(prefix: string): number {
  const toDel = allKeys().filter((k) => k.startsWith(prefix));
  toDel.forEach(removeItem);
  return toDel.length;
}

export const storage = {
  hasWindow,
  buildKey,
  registerLegacy,
  getItem,
  getJSON,
  setItem,
  setJSON,
  removeItem,
  has,
  allKeys,
  clearByPrefix,
  getQuotaStats,
};

export default storage;
