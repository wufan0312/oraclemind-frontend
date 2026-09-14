// ============================================================================
// 玄镜 OracleMind · 前端数据上云同步层（缺陷报告 P1-8）
//
// 目标：把原先只落在 localStorage 的「核心业务数据」同步到后端 user_stash，
// 使清缓存 / 换设备 / 换浏览器 / 隐私模式下都能恢复；localStorage 退化为离线缓存。
//
// 策略：
//   - 读取：本地优先（同步、离线可用）；
//   - 写入：先落本地（乐观），再异步推送云端；
//   - 推送失败：记入 pending，下次 syncCloud 自动补偿重试；
//   - 启动/登录：pull 云端 → 云端为准覆盖本地 → 本地独有则补推（首次上云）。
// ============================================================================

import { storage } from '@/lib/storage';
import { getOrCreateVisitorId } from '@/lib/visitor';
import { requestStashDelete, requestStashList, requestStashPut } from './api';

/**
 * 匿名态上云必须带 visitorId，否则后端 require_identity 会 400。
 * 各业务调用方大多只写 setCloudItem(key, value) 不传第三参，这里兜底补全，
 * 避免匿名用户每次上云 PUT 都失败（数据无法跨设备恢复 + 一堆 400）。
 * 已登录态后端按 Cookie 鉴权并优先 user:{id}，多带一个 visitorId 无害。
 */
function resolveVid(vid?: string): string | undefined {
  return vid || getOrCreateVisitorId();
}

/**
 * 需要上云的核心业务数据 key。
 * 判定标准：丢了用户会心疼、且换设备也希望还在的业务数据。
 */
export const CLOUD_KEYS: readonly string[] = [
  // 排盘 / 占卜结果缓存
  // 注：om_reqcache_v2（requestCache）**故意不上云** —— 它是带 TTL 的性能缓存，
  // cloudStore 无 TTL 语义，上云会让过期条目在换设备后复活、读到旧结果。
  'om_report_cache',
  'oraclemind_report_cache_v2',
  'om_fengshui_bazi_result',
  'om_cross_readings',
  'oraclemind_cross_readings',
  // 对话 / 聊天历史
  'om_home_chat',
  'oraclemind_home_chat_v1',
  'oraclemind_chat_sessions_v1',
  // 日记 / 修行存档
  'oraclemind_dream_diary_v1',
  'om_dream_diary',
  'om_dream_chat_sessions',
  'om_lucid_dream',
  'om_healing',
  // 各模块历史
  'om_tarot_history',
  'om_tarot_current',
  'om_tarot_custom_spreads',
  'om_tarot_daily',
  'om_tarot_diary',
  'om_numerology_history',
  'om_ming_history',
  'om_ming_favs',
  // 全站用户体系（成长 / 通知 / 付费权益）
  'om_growth',
  'om_notifications',
  'om_premium_unlocks',
];

/**
 * 明确**不上云**的 key 前缀：
 * - 出生信息（om_user_birth* / om_visitor_birth*）：已由 /user/profile 加密存储（P0-4），
 *   再走 stash 上云等于把明文出生信息塞回数据库，与本轮加密目标冲突；
 * - om_pref / om_ui_ ：设备级偏好与 UI 状态，本就属地化；
 * - om_visitor_id / om_track_events：设备标识与埋点，无需上云。
 */
const LOCAL_ONLY_PREFIXES = [
  'om_user_birth',
  'om_visitor_birth',
  'om_pref',
  'om_ui_',
  'om_visitor_id',
  'om_track_events',
];

/** 推送失败待补偿的 key 集合（localStorage 存储） */
const PENDING_KEY = 'om_cloud_pending';

/** 该 key 是否需要上云 */
export function isCloudKey(key: string): boolean {
  if (LOCAL_ONLY_PREFIXES.some((p) => key.startsWith(p))) return false;
  return CLOUD_KEYS.includes(key);
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
  } catch { /* 配额/隐私模式：忽略，云端仍有副本 */ }
}

function readPending(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = storage.getItem(PENDING_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr.filter((x) => typeof x === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

function writePending(keys: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (keys.length === 0) storage.removeItem(PENDING_KEY);
    else storage.setItem(PENDING_KEY, JSON.stringify(keys));
  } catch { /* ignore */ }
}

function markPending(key: string): void {
  const set = new Set(readPending());
  set.add(key);
  writePending([...set]);
}

function unmarkPending(key: string): void {
  const set = new Set(readPending());
  set.delete(key);
  writePending([...set]);
}

/** 静默推送：失败只记 pending，绝不抛出去打断调用方 */
async function pushQuiet(key: string, value: string, visitorId?: string): Promise<void> {
  try {
    await requestStashPut(key, value, resolveVid(visitorId));
    unmarkPending(key);
  } catch {
    markPending(key);
  }
}

/**
 * 写一条核心业务数据：本地乐观更新 + 异步上云（失败自动进 pending 待补偿）。
 * 非核心 key 只写本地。
 */
export function setCloudItem(key: string, value: string, visitorId?: string): void {
  safeSet(key, value);
  if (!isCloudKey(key)) return;
  void pushQuiet(key, value, visitorId);
}

/** 删除一条核心业务数据：本地 + 云端 */
export function removeCloudItem(key: string, visitorId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    storage.removeItem(key);
  } catch { /* ignore */ }
  if (!isCloudKey(key)) return;
  unmarkPending(key);
  void requestStashDelete(key, resolveVid(visitorId)).catch(() => { /* 云端删除失败可忽略 */ });
}

/**
 * 与云端对账同步（建议在应用启动 / 登录成功后调用一次）：
 *  1. 拉云端全量 → 云端为准写入本地（换设备/清缓存后恢复数据）
 *  2. 本地有但云端无的核心 key → 补推（首次上云）
 *  3. 重推上次失败的 pending（补偿）
 *
 * 后端不可达时直接返回，保持本地可用，不影响页面渲染。
 */
export async function syncCloud(visitorId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const vid = resolveVid(visitorId);
  let remote: Record<string, string> = {};
  try {
    remote = await requestStashList(vid);
  } catch {
    await flushPending(vid).catch(() => undefined);
    return; // 后端不可达：本地继续用
  }

  // 1) 云端为准 → 覆盖本地
  for (const [k, v] of Object.entries(remote)) {
    if (isCloudKey(k)) safeSet(k, v);
  }

  // 2) 本地独有 → 首次上云补推
  for (const k of CLOUD_KEYS) {
    if (k in remote) continue;
    const local = safeGet(k);
    if (local != null) await pushQuiet(k, local, vid);
  }

  // 3) 补偿此前失败的推送
  await flushPending(vid);
}

/** 重推所有 pending 的 key（成功即摘除，失败保留下次再试） */
export async function flushPending(visitorId?: string): Promise<void> {
  for (const key of readPending()) {
    const value = safeGet(key);
    if (value == null) {
      unmarkPending(key); // 本地都没了，无需再推
      continue;
    }
    try {
      await requestStashPut(key, value, visitorId);
      unmarkPending(key);
    } catch {
      // 仍失败：保留 pending，下次再试
    }
  }
}
