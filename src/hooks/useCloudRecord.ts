'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchReport,
  fetchReports,
  saveReport,
  type ReportDetail,
  type SaveReportInput,
} from '@/lib/api';

export interface UseCloudRecordConfig {
  /** 模块标识，仅用于兜底 title */
  module: string;
  visitorId: string;
  /** 挂载时自动拉取最近一条报告并回填（默认 true） */
  autoRestore?: boolean;
  /** 回填回调：拿到报告详情后交给页面 hydrate */
  onRestore?: (detail: ReportDetail) => void;
}

/**
 * 统一「云端报告记录」的存取（此前 bugua/numerology/ming.shared/report/tarot
 * 各自重写「挂载 → fetchReports → 取最近 → fetchReport → 回填」）。
 *
 * 返回最近一条报告、恢复状态、以及 save/restore 方法；页面只需在
 * onRestore 里把 detail.results 写回本地 state 即可。
 */
export function useCloudRecord({
  module,
  visitorId,
  autoRestore = true,
  onRestore,
}: UseCloudRecordConfig) {
  const [latest, setLatest] = useState<ReportDetail | null>(null);
  const [restoredId, setRestoredId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const restore = useCallback(async () => {
    if (!visitorId) return;
    setLoading(true);
    try {
      const list = await fetchReports(visitorId, 1);
      const item = list[0];
      if (item) {
        const detail = await fetchReport(item.id, visitorId);
        setLatest(detail);
        setRestoredId(detail.id);
        onRestore?.(detail);
      }
    } catch {
      // 云端恢复失败不阻断主流程（本地 state 仍为初始值）
    } finally {
      setLoading(false);
    }
  }, [visitorId, onRestore]);

  const save = useCallback(
    async (input: Omit<SaveReportInput, 'visitorId'>) => {
      const detail = await saveReport({ ...input, visitorId });
      setLatest(detail);
      setRestoredId(detail.id);
      return detail;
    },
    [visitorId]
  );

  useEffect(() => {
    if (autoRestore) void restore();
    // 仅在挂载时恢复一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { latest, restoredId, loading, restore, save, module };
}
