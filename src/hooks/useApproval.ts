'use client';

/**
 * useApproval —— Human-in-the-loop 助手（P1 Harness 化）。
 *
 * 用法：
 *   const { modal, withApproval } = useApproval();
 *   // 在 JSX 末尾渲染：{modal}
 *   // 高风险操作处：
 *   const o = await withApproval({
 *     actionType: 'donation',
 *     summary: '确认向玄镜随喜供养 ¥19.90',
 *     doAction: (approvalId) => createDonation({ tier, visitorId, approvalId }),
 *   });
 *
 * 内部时序：
 *   1. 调 createApproval 创建 pending 审批 → 拿到 approvalId；
 *   2. 弹出 ApprovalModal 展示 summary；
 *   3. 用户点确认 → approveApproval → 调 doAction(approvalId) → 把结果 resolve 给调用方；
 *   4. 用户点取消 → rejectApproval('用户取消') → reject，调用方 await 拿到异常/undefined。
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import ApprovalModal from '@/components/ui/ApprovalModal';
import { approveApproval, createApproval, rejectApproval } from '@/lib/api';

interface PendingApproval {
  approvalId: number;
  summary: string;
  icon: string;
  doAction: (approvalId: number) => Promise<unknown> | unknown;
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

export interface WithApprovalParams {
  actionType: string;
  summary: string;
  /** 确认按钮图标 */
  icon?: string;
  /** 确认按钮文案 */
  confirmText?: string;
  /** 业务执行函数，接收已通过的 approvalId */
  doAction: (approvalId: number) => Promise<unknown> | unknown;
  /** 附带的业务上下文快照（脱敏），随审批记录落库 */
  payload?: Record<string, unknown>;
  /** 关联 Observability traceId */
  traceId?: string;
}

export interface UseApprovalResult {
  /** 把此节点渲染到组件树某处（如 JSX 末尾） */
  modal: ReactNode;
  /** 包裹高风险操作：自动走「创建审批 → 弹确认 → 确认后执行」流程 */
  withApproval: <T>(params: WithApprovalParams) => Promise<T>;
}

export function useApproval(): UseApprovalResult {
  const [pending, setPending] = useState<{
    approvalId: number;
    summary: string;
    icon: string;
    confirmText: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  // 用 ref 持有当前 pending 的 resolver，避免闭包陷阱
  const pendingRef = useRef<PendingApproval | null>(null);

  const cleanup = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
    setLoading(false);
  }, []);

  const confirm = useCallback(async () => {
    const cur = pendingRef.current;
    if (!cur) return;
    setLoading(true);
    try {
      await approveApproval(cur.approvalId);
      const result = await cur.doAction(cur.approvalId);
      cur.resolve(result);
    } catch (e: any) {
      cur.reject(e instanceof Error ? e : new Error(String(e?.message || e)));
    } finally {
      cleanup();
    }
  }, [cleanup]);

  const cancel = useCallback(async () => {
    const cur = pendingRef.current;
    if (!cur) return;
    setLoading(true);
    try {
      await rejectApproval(cur.approvalId, '用户取消').catch(() => {});
    } catch {
      /* 取消失败不影响前端关闭弹窗 */
    } finally {
      cur.reject(new Error('用户取消了操作'));
      cleanup();
    }
  }, [cleanup]);

  const withApproval = useCallback(
    <T,>(params: WithApprovalParams): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        createApproval({
          actionType: params.actionType,
          summary: params.summary,
          payload: params.payload,
          traceId: params.traceId,
        })
          .then((appr) => {
            pendingRef.current = {
              approvalId: appr.id,
              summary: params.summary,
              icon: params.icon ?? '⚠️',
              doAction: params.doAction,
              resolve: resolve as (v: unknown) => void,
              reject,
            };
            setPending({
              approvalId: appr.id,
              summary: params.summary,
              icon: params.icon ?? '⚠️',
              confirmText: params.confirmText ?? '确认执行',
            });
          })
          .catch((e) => reject(e)),
      }),
    [],
  );

  const modal: ReactNode = pending ? (
    <ApprovalModal
      open
      summary={pending.summary}
      icon={pending.icon}
      loading={loading}
      confirmText={pending.confirmText}
      onConfirm={confirm}
      onCancel={cancel}
    />
  ) : null;

  return { modal, withApproval };
}
