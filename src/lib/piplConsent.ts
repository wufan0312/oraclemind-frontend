'use client';

/**
 * PIPL 敏感个人信息 · 单独同意（2026-09-18）
 * ----------------------------------------------------------------------------
 * 《个人信息保护法》第 29 条：处理敏感个人信息应当取得个人的**单独同意**。
 * 复原力测评收集的自评内容涉及心理状态、工作与家庭处境，属敏感个人信息，
 * 必须在收集前弹出**独立于隐私政策的单独同意**，不允许打包在通用条款里默认勾选。
 *
 * 设计要点：
 * - 默认不勾选；未同意前不发送任何问卷数据；
 * - 同意记录落 localStorage（版本化），再次进入无需重复弹窗；
 * - 拒绝 = 不使用测评，不记任何数据；同意后也可随时删除记录。
 */

export const ASSESSMENT_CONSENT_KEY = 'om_pipl_assessment_consent_v1';
const ASSESSMENT_CONSENT_VERSION = 1;

export interface ConsentRecord {
  /** 同意版本（文案/范围变更后 bump，老记录自动失效重新弹窗） */
  v: number;
  /** 同意时间 ISO */
  at: string;
}

/** 是否已存在有效版本的单独同意记录 */
export function hasAssessmentConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(ASSESSMENT_CONSENT_KEY);
    if (!raw) return false;
    const rec = JSON.parse(raw) as ConsentRecord;
    return rec?.v === ASSESSMENT_CONSENT_VERSION && !!rec.at;
  } catch {
    return false;
  }
}

/** 写入单独同意记录（用户明确点「同意」时调用） */
export function recordAssessmentConsent(): void {
  try {
    const rec: ConsentRecord = { v: ASSESSMENT_CONSENT_VERSION, at: new Date().toISOString() };
    window.localStorage.setItem(ASSESSMENT_CONSENT_KEY, JSON.stringify(rec));
  } catch {
    /* 存储不可用：本次会话内仍视为已同意（内存态由调用方持有） */
  }
}

/** 删除单独同意记录（个人中心「删除我的数据」等场景可复用） */
export function clearAssessmentConsent(): void {
  try {
    window.localStorage.removeItem(ASSESSMENT_CONSENT_KEY);
  } catch {
    /* 忽略 */
  }
}
