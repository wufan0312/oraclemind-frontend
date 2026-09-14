// ============================================================================
// 玄镜 OracleMind · 用户资料同步模块
// 已登录用户的出生信息以**后端为唯一真源**，localStorage 仅作离线兜底。
//
// P1-9 双写一致性：后端写入失败时记录「待同步」标记，下次 loadUserBirth 自动对账
// 并补偿重试，杜绝「后端失败 / 本地成功」后两边长期不一致且无补救手段。
//
// P1-4 修订：不再接收 token 参数。所有请求通过 fetch 的 credentials:'include'
// 自动携带后端下发的 httpOnly Cookie 完成鉴权（见 lib/api.ts）。
// ============================================================================

import type { VisitorBirth } from './visitor';
import {
  requestUserProfile,
  requestUpdateProfile,
  requestMigrateVisitor,
  requestClearProfileBirth,
  type ProfileBirthInfo,
  type UserProfileResponse,
} from './api';
import { storage } from '@/lib/storage';

/** 本地缓存 key（后端为真源，本地仅作离线兜底） */
const USER_BIRTH_CACHE_KEY = 'om_user_birth_cache';

/**
 * 待同步标记 key（缺陷报告 P1-9「双写一致性」）
 * 后端写入失败时把待落库的 birth 记在这里，下次 loadUserBirth 会自动对账并补偿重试，
 * 避免「后端失败但本地成功」后两边长期不一致、且无任何补救手段。
 */
const USER_BIRTH_PENDING_KEY = 'om_user_birth_pending';

// ===== 本地读写（统一走 storage，配额/异常已在 storage 内兜底） =====

function writeLocalBirth(birth: ProfileBirthInfo): void {
  if (typeof window === 'undefined') return;
  try {
    storage.setItem(USER_BIRTH_CACHE_KEY, JSON.stringify(birth));
  } catch { /* ignore */ }
}

function readLocalBirth(): ProfileBirthInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = storage.getItem(USER_BIRTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileBirthInfo;
    return parsed?.date ? parsed : null;
  } catch {
    return null;
  }
}

function clearLocalBirth(): void {
  if (typeof window === 'undefined') return;
  try {
    storage.removeItem(USER_BIRTH_CACHE_KEY);
  } catch { /* ignore */ }
}

/** 记录「已写本地、未写后端」的待同步数据 */
function writePending(birth: ProfileBirthInfo): void {
  if (typeof window === 'undefined') return;
  try {
    storage.setItem(
      USER_BIRTH_PENDING_KEY,
      JSON.stringify({ birth, savedAt: Date.now() })
    );
  } catch { /* ignore */ }
}

function readPending(): ProfileBirthInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = storage.getItem(USER_BIRTH_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { birth?: ProfileBirthInfo };
    return parsed?.birth?.date ? parsed.birth : null;
  } catch {
    return null;
  }
}

function clearPending(): void {
  if (typeof window === 'undefined') return;
  try {
    storage.removeItem(USER_BIRTH_PENDING_KEY);
  } catch { /* ignore */ }
}

/** 把 VisitorBirth 转为后端 ProfileBirthInfo */
export function birthToProfile(birth: VisitorBirth): ProfileBirthInfo {
  return {
    date: birth.date ?? null,
    time: birth.time ?? null,
    gender: birth.gender ?? null,
    lunarYear: birth.lunarYear ?? null,
    lunarMonth: birth.lunarMonth ?? null,
    lunarDay: birth.lunarDay ?? null,
    province: birth.province ?? null,
    city: birth.city ?? null,
    lat: birth.lat ?? null,
    lng: birth.lng ?? null,
  };
}

/** 把后端 ProfileBirthInfo 转为 VisitorBirth */
export function profileToBirth(profile: ProfileBirthInfo): VisitorBirth | null {
  if (!profile?.date) return null;
  return {
    date: profile.date,
    time: profile.time ?? '不详',
    gender: profile.gender ?? undefined,
    lunarYear: profile.lunarYear ?? undefined,
    lunarMonth: profile.lunarMonth ?? undefined,
    lunarDay: profile.lunarDay ?? undefined,
    province: profile.province ?? undefined,
    city: profile.city ?? undefined,
    lat: profile.lat ?? undefined,
    lng: profile.lng ?? undefined,
  };
}

/**
 * 从后端加载用户出生信息（后端为唯一真源，本地仅兜底 + 待同步补偿）
 *
 * P1-9 一致性策略：
 *  1. 后端有数据 → 以后端为准，刷新本地缓存并清除待同步标记；
 *  2. 后端无数据但有「待同步」记录 → 说明上次保存后端失败，此处自动补偿重试，
 *     成功即转正，失败仍返回本地数据（绝不让用户填过的资料凭空消失）；
 *  3. 后端明确为空且无待同步 → 以真源为准返回 null，并清掉可能过期的本地缓存；
 *  4. 后端不可达 → 回退本地缓存。
 */
export async function loadUserBirth(): Promise<VisitorBirth | null> {
  let remoteOk = false;
  let remote: ProfileBirthInfo | null = null;
  try {
    const resp = await requestUserProfile();
    remoteOk = true;
    remote = resp.birth?.date ? resp.birth : null;
  } catch {
    remoteOk = false; // 后端不可达
  }

  if (remoteOk && remote?.date) {
    writeLocalBirth(remote);
    clearPending();
    return profileToBirth(remote);
  }

  // 后端没有出生信息：先做待同步补偿，避免上次保存失败的资料被静默丢弃
  const pending = readPending();
  if (pending?.date) {
    try {
      await requestUpdateProfile({ birth: pending });
      clearPending();
      writeLocalBirth(pending);
      return profileToBirth(pending);
    } catch {
      // 补偿仍失败：保留 pending 供下次再试，同时先把本地数据返回给 UI
      return profileToBirth(pending);
    }
  }

  if (remoteOk) {
    // 后端明确无数据且无待同步 → 真源为准，清理过期本地缓存
    clearLocalBirth();
    return null;
  }
  // 后端不可达 → 本地兜底
  const local = readLocalBirth();
  return local ? profileToBirth(local) : null;
}

/** 保存用户出生信息到后端（后端为真源，失败则标记待同步以便后续补偿） */
export async function saveUserBirth(birth: VisitorBirth): Promise<void> {
  const profile = birthToProfile(birth);
  // 乐观更新本地（离线也可用）
  writeLocalBirth(profile);
  try {
    await requestUpdateProfile({ birth: profile });
    clearPending(); // 后端已确认落库，无需补偿
  } catch {
    // 后端失败：标记待同步，下次 loadUserBirth 自动补偿重试（P1-9）
    writePending(profile);
    throw new Error('出生信息已暂存本地，网络恢复后将自动同步');
  }
}

/** 迁移访客数据到用户（登录时调用） */
export async function migrateVisitorBirth(
  visitorBirth: VisitorBirth
): Promise<VisitorBirth | null> {
  const profile = birthToProfile(visitorBirth);
  try {
    const resp = await requestMigrateVisitor(profile);
    // 迁移成功：后端已落库，同步本地并清除待同步标记
    writeLocalBirth(resp.birth ?? profile);
    clearPending();
    return profileToBirth(resp.birth ?? profile);
  } catch {
    // 迁移失败：保留本地数据并标记待同步，后续 loadUserBirth 自动补偿
    writeLocalBirth(profile);
    writePending(profile);
    return visitorBirth;
  }
}

/** 清除用户出生信息（后端 + 本地缓存 + 待同步标记） */
export async function clearUserBirth(): Promise<void> {
  try {
    await requestClearProfileBirth();
  } catch { /* ignore */ }
  clearLocalBirth();
  clearPending();
}

/** 登出时清除用户缓存（不清除访客数据） */
export function clearUserBirthCache(): void {
  clearLocalBirth();
  clearPending();
}
