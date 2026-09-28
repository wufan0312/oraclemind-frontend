'use client';

/**
 * 复原力测评页（/assessment）—— 合规付费新方向（2026-09-18）
 * ----------------------------------------------------------------------------
 * 「成年人角色压力 & 复原力」自评测评：
 * - 完全脱离生日 / 生辰 / 命盘，只基于用户此刻的自评文本；
 * - PIPL：收集前必须取得敏感个人信息（心理状态）的单独同意（AssessmentConsentModal）；
 * - 付费：报告生成前需解锁 `resilience_assess`（唯一在售新方向商品，不在 PAUSED_ITEMS）；
 * - 报告：AI SSE 流式（/api/v1/agent/assessment/stream），mdToHtml 渲染，不给诊断不算吉凶。
 *
 * 问卷与 prompt 镜像：oraclemind-ai-py/src/agent/assessment_agent.py（双端同源）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import OmLoading from '@/components/ui/OmLoading';
import SectionTitle from '@/components/ui/SectionTitle';
import PaywallModal from '@/components/premium/PaywallModal';
import AssessmentConsentModal from '@/components/pipl/AssessmentConsentModal';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { sanitizeAiText, mdToHtml } from '@/lib/markdown';
import { requestAssessmentStream, trackFunnelEvent } from '@/lib/api';
import {
  RESILIENCE_QUESTIONS,
  type ResilienceQuestion,
} from '@/lib/prompts/resilienceAssessment';
import { isUnlocked } from '@/lib/premium';
import { hasAssessmentConsent } from '@/lib/piplConsent';
import { saveAssessmentRecord } from '@/lib/assessmentStore';
import { track } from '@/lib/track';
import '@/styles/assessment.scss';

const DIMENSIONS = ['事业', '关系', '家庭', '自我'] as const;
const DIM_ICONS: Record<(typeof DIMENSIONS)[number], string> = {
  事业: '💼',
  关系: '🤝',
  家庭: '🏠',
  自我: '🌱',
};

type Phase = 'form' | 'streaming' | 'done' | 'error';

export default function AssessmentPage() {
  const router = useRouter();
  const { visitorId } = useVisitor();

  // PIPL 单独同意：挂载后读本地记录（避免 SSR 与客户端水合不一致）
  const [consented, setConsented] = useState<boolean | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>('form');
  const [displayText, setDisplayText] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallHint, setPaywallHint] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const pendingStartRef = useRef(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ok = hasAssessmentConsent();
    setConsented(ok);
  }, []);

  // 卸载时中断进行中的流
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const filledCount = useMemo(
    () => RESILIENCE_QUESTIONS.filter((q) => (answers[q.key] || '').trim().length > 0).length,
    [answers]
  );

  const startStream = useCallback(async () => {
    if (phase === 'streaming') return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setPhase('streaming');
    setDisplayText('');
    setErr(null);
    setDisclaimer('');

    const t0 = performance.now();
    try {
      const { text, disclaimer: d } = await requestAssessmentStream(answers, {
        signal: ctrl.signal,
        onDelta: (chunk, full) => setDisplayText(full),
        onMeta: (meta) => setDisclaimer(meta.disclaimer),
      });
      setDisplayText(text);
      setDisclaimer(d);
      setPhase('done');
      // PIPL 闭环：报告落本地，供个人中心「查看 / 删除」
      saveAssessmentRecord({ answers, reportMarkdown: text, disclaimer: d });
      track('assessment', 'report.done', {
        ok: true,
        filled: filledCount,
        latencyMs: Math.round(performance.now() - t0),
      });
      // P0 漏斗归因：从占卜/塔罗入口（?from=bugua|tarot）进来并完成付费报告，记一次付费转化
      const fromSrc =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('from')
          : null;
      if (fromSrc) trackFunnelEvent('assessment_paid', fromSrc, visitorId);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setErr(e instanceof Error ? e.message : '报告生成失败，请稍后重试');
      setPhase('error');
      track('assessment', 'report.done', { ok: false, reason: e instanceof Error ? e.message : 'unknown' });
    }
  }, [answers, phase, filledCount]);

  /** 点「生成报告」的统一闸门：单独同意 → 付费解锁 → 开始 */
  const onGenerateClick = () => {
    if (filledCount < 3) return;
    if (consented === null) return; // 水合中，忽略点击

    if (!consented) {
      pendingStartRef.current = false;
      setConsentOpen(true);
      return;
    }

    if (!isUnlocked('resilience_assess')) {
      setPaywallHint(null);
      pendingStartRef.current = true;
      setPaywallOpen(true);
      return;
    }
    void startStream();
  };

  return (
    <div className="page active" id="page-assessment">
      <div className="page-title">🌱 复原力测评</div>
      <div className="page-subtitle">角色压力与复原力自评 · 自我觉察报告（非算命、不给诊断）</div>

      {/* ============ 说明卡 ============ */}
      <div className="result-card">
        <SectionTitle icon="sparkles">这不是算命，也不给你贴标签</SectionTitle>
        <p>
          这是一份关于<strong className="tc-text-primary">成年人角色压力与复原力</strong>的自评测评：
          回答事业 / 关系 / 家庭 / 自我四个维度的几道开放题，AI 会为你生成一份
          <strong className="tc-text-primary">自我觉察报告</strong>——看清你此刻的压力结构、
          你已经在用的资源，以及本周可以轻装起步的一小步。
        </p>
        <ul className="asmt-principles">
          <li>与生辰、命盘<strong>完全无关</strong>——你填的是此刻的自评，不是命盘；</li>
          <li>不给诊断、不算吉凶，不替代专业帮助；</li>
          <li>自评内容属敏感个人信息，收集前会先取得你的<strong>单独同意</strong>，可随时删除。</li>
        </ul>
      </div>

      {/* ============ 问卷 ============ */}
      {DIMENSIONS.map((dim) => (
        <div className="result-card" key={`dim-${dim}`}>
          <SectionTitle icon="compass">
            {DIM_ICONS[dim]} {dim}
          </SectionTitle>
          {RESILIENCE_QUESTIONS.filter((q: ResilienceQuestion) => q.dimension === dim).map((q) => (
            <div className="asmt-question" key={q.key}>
              <label className="asmt-question-label" htmlFor={`asmt-${q.key}`}>{q.label}</label>
              <textarea
                id={`asmt-${q.key}`}
                className="asmt-textarea"
                placeholder={q.placeholder}
                rows={3}
                maxLength={500}
                value={answers[q.key] || ''}
                disabled={phase === 'streaming'}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      ))}

      <div className="asmt-action">
        <Button
          variant="primary"
          disabled={filledCount < 3 || phase === 'streaming' || consented === null}
          onClick={onGenerateClick}
        >
          {filledCount < 3
            ? `至少填写 3 题（已填 ${filledCount}/9）`
            : phase === 'streaming'
              ? '正在生成报告…'
              : '生成我的复原力报告 →'}
        </Button>
        <p className="asmt-action-note">
          付费说明：报告为<strong>单份付费</strong>（¥9.9， resilience_assess）；点「生成」后若未解锁会先弹出解锁引导。
          玄镜全部基础功能依旧永久免费。
        </p>
      </div>

      {/* ============ 报告 ============ */}
      {(phase === 'streaming' || phase === 'done' || phase === 'error') && (
        <div className="result-card" ref={resultRef}>
          <SectionTitle icon="flower">你的复原力快照</SectionTitle>
          {phase === 'streaming' && <OmLoading label="正在对照你的自评生成觉察报告…" mode="inline" />}
          {displayText && (
            <div
              className="asmt-report"
              dangerouslySetInnerHTML={{
                __html: mdToHtml(sanitizeAiText(displayText)) + (phase === 'streaming' ? '<span class="asmt-cursor">▌</span>' : ''),
              }}
            />
          )}
          {phase === 'error' && err && (
            <p className="asmt-err">报告生成失败：{err}</p>
          )}
          {phase === 'done' && (
            <>
              <p className="asmt-disclaimer">{disclaimer || '本报告仅供自我觉察参考，不构成医学诊断或治疗建议。'}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="ghost" onClick={() => router.push('/healing')}>去疗愈·心斋歇一歇 →</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ PIPL 单独同意弹层 ============ */}
      <AssessmentConsentModal
        open={consentOpen}
        onAccepted={() => {
          setConsented(true);
          setConsentOpen(false);
          // 同意后回到付费闸门（若报告已填写）
          if (filledCount >= 3) onGenerateClick();
        }}
      />

      {/* ============ 付费墙（resilience_assess） ============ */}
      <PaywallModal
        open={paywallOpen}
        item="resilience_assess"
        onClose={() => setPaywallOpen(false)}
        onUnlocked={() => {
          if (isUnlocked('resilience_assess')) {
            setPaywallOpen(false);
            if (pendingStartRef.current) {
              pendingStartRef.current = false;
              void startStream();
            }
          } else {
            setPaywallHint('已解锁其他权益；生成复原力报告需选择「复原力测评报告」套餐。');
          }
        }}
      />
      {paywallHint && <p className="asmt-hint-fixed">{paywallHint}</p>}

      {/* visitorId 引用：保证访客身份已初始化（订单归属用） */}
      <span hidden>{visitorId}</span>
    </div>
  );
}
