'use client';

import { storage, registerLegacy } from './storage';
import { removeCloudItem, setCloudItem } from './cloudStore';

// 跨页占卜共享池：数字命理 / 塔罗 / 星座 在各自独立页面生成，
// 综合运势（卜卦页 · 模块7）读取此池，将近期测算结果一并融合解读。
const CROSS_KEY = 'om_cross_readings';
// P2-1/A 收口：旧键惰性迁移，用户已存数据零丢失
registerLegacy('oraclemind_cross_readings', CROSS_KEY);

export type CrossReadingType = 'numerology' | 'tarot' | 'horoscope' | 'report';

export interface CrossReading {
  type: CrossReadingType;
  label: string;
  summary: string;
  ts: number;
}

export function getCrossReadings(): CrossReading[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = storage.getItem(CROSS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as CrossReading[]) : [];
  } catch {
    return [];
  }
}

/** 清空共享池（报告页「清空记录」按钮：旧结论会污染新的综合判断） */
export function clearCrossReadings(): void {
  if (typeof window === 'undefined') return;
  try {
    removeCloudItem(CROSS_KEY); // P1-8：本地 + 云端一并清除
  } catch {
    /* 存储不可用则跳过 */
  }
}

/** 写入/更新某类占卜结论（按 type 去重，保留最新一条） */
export function pushCrossReading(r: Omit<CrossReading, 'ts'>): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getCrossReadings().filter((x) => x.type !== r.type);
    list.push({ ...r, ts: Date.now() });
    setCloudItem(CROSS_KEY, JSON.stringify(list)); // P1-8：本地乐观 + 异步上云
  } catch {
    /* 存储不可用（隐私模式等）则跳过 */
  }
}
