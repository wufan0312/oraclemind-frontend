'use client';

/**
 * PIPL 单独同意弹层（敏感个人信息：心理状态自评）
 * ----------------------------------------------------------------------------
 * 用于 /assessment 测评页：收集问卷前必须取得单独同意（PIPL 第 29 条）。
 * - 默认不勾选，未勾选时「同意并继续」不可点；
 * - 「暂不使用」= 拒绝，直接返回上一页，不记录任何数据；
 * - 同意后写入版本化记录（lib/piplConsent），同版本内不再重复弹窗。
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import { recordAssessmentConsent } from '@/lib/piplConsent';

export default function AssessmentConsentModal({
  open,
  onAccepted,
}: {
  open: boolean;
  onAccepted: () => void;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const decline = () => {
    // 拒绝即返回：不写任何记录、不收集任何数据
    router.back();
  };

  const accept = () => {
    if (!checked) return;
    recordAssessmentConsent();
    setChecked(false);
    onAccepted();
  };

  return (
    <Modal
      open={open}
      title="🔒 单独同意 · 敏感个人信息处理告知"
      icon="🛡️"
      closeOnOverlay={false}
      closeOnEsc={false}
      footer={
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" className="paywall-btn ghost" onClick={decline}>
            暂不使用
          </button>
          <button
            type="button"
            className="paywall-btn primary"
            disabled={!checked}
            style={{ opacity: checked ? 1 : 0.5 }}
            onClick={accept}
          >
            同意并继续
          </button>
        </div>
      }
    >
      <div style={{ textAlign: 'left', fontSize: 13.5, lineHeight: 1.75 }}>
        <p>
          在使用<strong>复原力测评</strong>前，请了解我们如何处理你的信息：
        </p>
        <p>
          <strong>1. 处理的信息：</strong>你在问卷中自评填写的文字内容。其中可能包含你的
          <strong className="tc-text-primary">心理状态、工作与家庭处境</strong>等，按法律属于
          <strong>敏感个人信息</strong>。
        </p>
        <p>
          <strong>2. 处理目的与方式：</strong>仅用于由 AI 生成你的<strong>自我觉察报告</strong>。
          不用于用户画像、广告营销，不会提供给任何第三方；测评与生辰、命盘完全无关。
        </p>
        <p>
          <strong>3. 存储与删除：</strong>测评内容保存在你的设备本地并同步至你的账号云存储；
          你可以随时在「个人中心」删除，删除后不可恢复。
        </p>
        <p>
          <strong>4. 自愿性：</strong>不同意本告知<strong>不影响</strong>你使用玄镜其他功能，
          但测评需要收集上述信息才能生成报告，因此未同意前我们不会开始测评。
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
          本报告由 AI 生成，仅供自我觉察参考，不构成医学诊断或心理治疗；若你正处于强烈痛苦中，
          请联系专业帮助（如公立医院心理科、心理援助热线）。
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginTop: 10 }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>
            我已阅读并理解上述告知，<strong>单独同意</strong>玄镜为生成本人测评报告而处理上述敏感个人信息。
          </span>
        </label>
      </div>
    </Modal>
  );
}
