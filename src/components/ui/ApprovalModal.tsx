'use client';

/**
 * ApprovalModal —— Human-in-the-loop 人工确认弹层（P1 Harness 化）。
 * 通用组件：展示「你即将执行的高风险操作摘要」，用户点「确认」后才放行。
 * 通常不直接用，而是配合 useApproval() 的 withApproval 助手自动挂载。
 */

import Modal from '@/components/ui/Modal';

export interface ApprovalModalProps {
  open: boolean;
  /** 展示给用户的操作摘要，如「确认向玄镜随喜供养 ¥19.90」 */
  summary: string;
  /** 操作类型对应的图标，默认 ⚠️ */
  icon?: string;
  /** 确认中（后端审批请求进行中） */
  loading?: boolean;
  /** 确认按钮文案 */
  confirmText?: string;
  /** 取消按钮文案 */
  cancelText?: string;
  /** 点击确认 */
  onConfirm: () => void;
  /** 点击取消 */
  onCancel: () => void;
}

export default function ApprovalModal({
  open,
  summary,
  icon = '⚠️',
  loading = false,
  confirmText = '确认执行',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ApprovalModalProps) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onCancel}
      icon={icon}
      title="请确认操作"
      closeOnOverlay={!loading}
      closeOnEsc={!loading}
      footer={
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            className="paywall-btn ghost"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="paywall-btn primary"
            disabled={loading}
            style={loading ? { opacity: 0.6 } : undefined}
            onClick={onConfirm}
          >
            {loading ? '确认中…' : confirmText}
          </button>
        </div>
      }
    >
      <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.7 }}>
        <p style={{ margin: '0 0 8px' }}>你即将执行以下操作，请确认无误：</p>
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '10px 12px',
            fontWeight: 600,
          }}
        >
          {summary}
        </div>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: 12.5,
            margin: '10px 0 0',
          }}
        >
          该操作将被记录为人工确认（审批留痕），确认后才会真正执行。
        </p>
      </div>
    </Modal>
  );
}
