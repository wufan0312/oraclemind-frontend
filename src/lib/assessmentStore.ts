'use client';

/**
 * 复原力测评记录 · 本地存储（2026-09-18）
 * ----------------------------------------------------------------------------
 * PIPL 闭环：测评收集的是敏感个人信息（心理状态自评）。用户在个人中心应能
 * 「查看 / 删除」自己的测评记录；删除即擦除本机敏感数据。
 *
 * 记录仅存浏览器 localStorage（与项目 visitor-local 策略一致，不另行上云）：
 * 访客模式本机保存；登录用户仍为同源本地，便于跨页 / 跨会话回看与擦除。
 */

export const ASSESSMENT_RECORDS_KEY = 'om_assessment_records';

export interface AssessmentRecord {
  /** 记录唯一 id */
  id: string;
  /** 生成时间 ISO */
  createdAt: string;
  /** 用户作答（题 key → 文本） */
  answers: Record<string, string>;
  /** AI 生成的复原力报告（markdown 原文） */
  reportMarkdown: string;
  /** 报告尾部免责声明 */
  disclaimer?: string;
}

/** 读取全部测评记录（最新在前） */
export function loadAssessmentRecords(): AssessmentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ASSESSMENT_RECORDS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AssessmentRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 保存一条测评记录（自动补 id / 时间，最新置顶） */
export function saveAssessmentRecord(
  rec: Pick<AssessmentRecord, 'answers' | 'reportMarkdown'> & Partial<Pick<AssessmentRecord, 'disclaimer'>>
): AssessmentRecord {
  const full: AssessmentRecord = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    answers: rec.answers,
    reportMarkdown: rec.reportMarkdown,
    disclaimer: rec.disclaimer,
  };
  try {
    const list = loadAssessmentRecords();
    list.unshift(full);
    window.localStorage.setItem(ASSESSMENT_RECORDS_KEY, JSON.stringify(list));
  } catch {
    /* 存储不可用：本次报告仍在内存态可见，不阻塞出报告 */
  }
  return full;
}

/** 删除单条记录（PIPL 擦除权） */
export function deleteAssessmentRecord(id: string): void {
  try {
    const list = loadAssessmentRecords().filter((r) => r.id !== id);
    window.localStorage.setItem(ASSESSMENT_RECORDS_KEY, JSON.stringify(list));
  } catch {
    /* 忽略 */
  }
}

/**
 * 清空全部测评记录，并一并撤销测评单独同意（PIPL 擦除权闭环）：
 * 数据已删，残留的「曾同意」记录也无意义，连带清除避免误导。
 */
export function clearAssessmentRecords(): void {
  try {
    window.localStorage.removeItem(ASSESSMENT_RECORDS_KEY);
  } catch {
    /* 忽略 */
  }
  // 延迟引入避免循环依赖（piplConsent 不依赖本模块）
  import('./piplConsent')
    .then((m) => m.clearAssessmentConsent())
    .catch(() => {});
}
