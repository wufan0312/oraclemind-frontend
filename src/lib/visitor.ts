import { storage } from './storage';

// ============================================================================
// 玄镜 OracleMind · 访客会话模块
// 散客（未登录）进入系统即分配唯一访客 ID，记录出生信息并跨页面共享：
//   - localStorage 持久化（刷新/换页不丢失）
//   - 同一浏览器所有页面共享同一份出生信息
//   - 自定义事件 + storage 事件：同页实时通知、跨标签页同步
// ============================================================================

const VISITOR_ID_KEY = 'om_visitor_id';
const VISITOR_ID_CREATED_KEY = 'om_visitor_id_created';
const VISITOR_BIRTH_KEY = 'om_visitor_birth';
/** 自定义事件名：出生信息变更时广播（同页实时） */
const VISITOR_CHANGE_EVENT = 'om:visitor-change';

/** 出生信息（跨页面共享的唯一数据模型，统一存公历日期 + 时辰名 + 性别 + 出生地。
 *  生日采用「农历录入、阳历推算、两者同存」策略：用户填农历，系统换算阳历并两份都持久化。 */
export interface VisitorBirth {
  /** 公历（阳历）出生日期 YYYY-MM-DD，由农历推算得出，供排盘使用 */
  date: string;
  /** 农历出生年（如 1987） */
  lunarYear?: number;
  /** 农历出生月（1-12，闰月用负数，如 -8 表示闰八月） */
  lunarMonth?: number;
  /** 农历出生日（1-30） */
  lunarDay?: number;
  /** 时辰名：子时~亥时 / 不详（不含括号时段） */
  time: string;
  /** 性别：男 / 女（可选，兼容旧存档） */
  gender?: string;
  /** 出生省份（如"上海市"） */
  province?: string;
  /** 出生城市（如"黄浦区"） */
  city?: string;
  /** 纬度 */
  lat?: number;
  /** 经度 */
  lng?: number;
  /** 生命灵数 / 数字命理口径：'solar'=按公历年+月+日，'lunar'=按农历年+月+日。
   *  默认 'solar'（毕达哥拉斯标准口径）。全站数字命理（数字命理页 / 报告页命主 / 合盘）以它为单一数据源，保证三处永远一致。 */
  calendarMode?: 'solar' | 'lunar';
  /** 更新时间戳（ms） */
  updatedAt?: number;
}

export interface VisitorInfo {
  id: string;
  createdAt: number;
  birth: VisitorBirth | null;
}

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    storage.setItem(key, value);
  } catch {
    /* 隐私模式等场景静默忽略 */
  }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** 生成访客 ID（优先 UUID v4，不支持时降级随机串） */
function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fallthrough */
  }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** 获取或创建访客 ID（幂等，首次调用生成并持久化） */
export function getOrCreateVisitorId(): string {
  const existing = safeGet(VISITOR_ID_KEY);
  if (existing) return existing;
  const id = generateId();
  safeSet(VISITOR_ID_KEY, id);
  safeSet(VISITOR_ID_CREATED_KEY, String(Date.now()));
  return id;
}

/** 只读获取访客 ID（不创建；从未访问过返回 null） */
export function getVisitorId(): string | null {
  return safeGet(VISITOR_ID_KEY);
}

/** 读取已保存的出生信息（无则 null） */
export function getVisitorBirth(): VisitorBirth | null {
  const raw = safeGet(VISITOR_BIRTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VisitorBirth;
    if (typeof parsed.date !== 'string' || !parsed.date) return null;
    return {
      ...parsed,
      time: typeof parsed.time === 'string' ? parsed.time : '不详',
      lunarYear: typeof parsed.lunarYear === 'number' ? parsed.lunarYear : undefined,
      lunarMonth: typeof parsed.lunarMonth === 'number' ? parsed.lunarMonth : undefined,
      lunarDay: typeof parsed.lunarDay === 'number' ? parsed.lunarDay : undefined,
      gender: typeof parsed.gender === 'string' ? parsed.gender : undefined,
      province: typeof parsed.province === 'string' ? parsed.province : undefined,
      city: typeof parsed.city === 'string' ? parsed.city : undefined,
      lat: typeof parsed.lat === 'number' ? parsed.lat : undefined,
      lng: typeof parsed.lng === 'number' ? parsed.lng : undefined,
      calendarMode: parsed.calendarMode === 'lunar' ? 'lunar' : 'solar',
    };
  } catch {
    return null;
  }
}

/**
 * 保存出生信息并广播变更。
 * 任何页面调用后，所有已打开的页面（含其他标签页）都会实时收到最新值。
 */
export function saveVisitorBirth(birth: VisitorBirth): void {
  const next: VisitorBirth = { ...birth, updatedAt: Date.now() };
  safeSet(VISITOR_BIRTH_KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<VisitorBirth | null>(VISITOR_CHANGE_EVENT, { detail: next }));
  }
}

/** 清除出生信息（不删除访客 ID） */
export function clearVisitorBirth(): void {
  safeRemove(VISITOR_BIRTH_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<VisitorBirth | null>(VISITOR_CHANGE_EVENT, { detail: null }));
  }
}

/** 汇总访客档案（ID + 创建时间 + 出生信息） */
export function getVisitorInfo(): VisitorInfo {
  const id = getOrCreateVisitorId();
  const createdAt = Number(safeGet(VISITOR_ID_CREATED_KEY) || 0);
  return { id, createdAt, birth: getVisitorBirth() };
}

/**
 * 订阅出生信息变更（同页自定义事件 + 跨标签页 storage 事件）。
 * 返回取消订阅函数。
 */
export function subscribeVisitorBirth(cb: (birth: VisitorBirth | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onCustom = (e: Event) => cb(((e as CustomEvent<VisitorBirth | null>).detail ?? null));
  const onStorage = (e: StorageEvent) => {
    if (e.key === VISITOR_BIRTH_KEY) cb(getVisitorBirth());
  };
  window.addEventListener(VISITOR_CHANGE_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(VISITOR_CHANGE_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
