'use client';

/**
 * 心理量表 · 测评流程页（/scales/[slug]）—— 右轨 MVP（2026-09-19）
 * ----------------------------------------------------------------------------
 * 单页闭环：介绍页 → 逐题作答（Likert 五点，自动前进 + 可回退）→ 提交计分 → 结果页。
 * - 题目与选项来自 GET /api/v1/scales/{slug}（服务端权威，前端不落任何题库镜像）；
 * - 计分走 POST /api/v1/scales/{slug}/score，客户端只上送 {题目ID: 1-5}，无法篡改计分；
 * - 计分结果落 scale_attempts（作答持久化），为 AI 报告 / 个人中心留存提供真源；
 * - AI 心理报告走 /api/v1/agent/scale-report/stream（SSE），仅基于计分结果扩展，非诊断；
 * - 合规：非诊断、非病理、去命理；付费闸门复用 resilience_assess（与 /assessment 同源）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import OmLoading from '@/components/ui/OmLoading';
import { ErrorState, LoadingState } from '@/components/ui/states';
import PaywallModal from '@/components/premium/PaywallModal';
import {
  fetchScaleDetail,
  submitScaleScore,
  requestScaleReportStream,
  type ScaleDetail,
  type ScaleScoreResult,
} from '@/lib/api';
import { isUnlocked } from '@/lib/premium';
import { sanitizeAiText, mdToHtml } from '@/lib/markdown';
import { track } from '@/lib/track';
import '@/styles/scales.scss';

/** AI 报告生成阶段（仅结果页相关） */
type ReportPhase = 'idle' | 'streaming' | 'done' | 'error';

type Phase = 'loading' | 'intro' | 'quiz' | 'submitting' | 'result' | 'error';

/** 自动前进延时（选中选项后短暂停留，让用户看到选中态） */
const AUTO_NEXT_DELAY = 220;

/** 服务端 band → 中文标签（原始值兜底展示，避免契约变化时开天窗） */
const BAND_LABELS: Record<string, string> = { high: '偏高', mid: '居中', low: '偏低' };
const bandLabel = (band: string) => BAND_LABELS[band] ?? band;

export default function ScaleFlowPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  const [detail, setDetail] = useState<ScaleDetail | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  /** 作答：题目ID → 选项值（1-5） */
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<ScaleScoreResult | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  /** AI 心理报告（结果页）：SSE 流 + 付费闸门 */
  const [reportPhase, setReportPhase] = useState<ReportPhase>('idle');
  const [reportText, setReportText] = useState('');
  const [reportDisclaimer, setReportDisclaimer] = useState('');
  const [reportErr, setReportErr] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingReportRef = useRef(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    if (!slug) return;
    setPhase('loading');
    setErrMsg(null);
    fetchScaleDetail(slug)
      .then((d) => {
        setDetail(d);
        setPhase('intro');
      })
      .catch((e) => {
        setErrMsg(e instanceof Error ? e.message : '获取量表详情失败');
        setPhase('error');
      });
  }, [slug]);

  useEffect(load, [load]);

  // 卸载清理自动前进定时器 + 进行中的报告流
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const questions = detail?.questions ?? [];
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] != null).length,
    [questions, answers]
  );
  const isLast = current >= questions.length - 1;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  /** 全部答完且停留在最后一题（或越界）时展示提交按钮 */
  const canSubmit = allAnswered && current >= questions.length - 1;

  const startQuiz = () => {
    setAnswers({});
    setCurrent(0);
    setPhase('quiz');
    track('scales', 'quiz.start', { slug });
    window.scrollTo({ top: 0 });
  };

  const goQuestion = (idx: number) => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setCurrent(Math.max(0, Math.min(idx, questions.length - 1)));
  };

  /** 选中选项：记录作答；非末题自动前进；末题停住等提交 */
  const pickAnswer = (qid: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
    if (!isLast) {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        setCurrent((c) => Math.min(c + 1, questions.length - 1));
      }, AUTO_NEXT_DELAY);
    }
  };

  const submit = useCallback(async () => {
    if (phase === 'submitting' || !slug || !allAnswered) return;
    setPhase('submitting');
    const t0 = performance.now();
    try {
      const r = await submitScaleScore(slug, answers);
      setResult(r);
      setPhase('result');
      track('scales', 'score.done', {
        slug,
        latencyMs: Math.round(performance.now() - t0),
      });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : '量表计分失败，请稍后重试');
      setPhase('error');
      track('scales', 'score.done', { slug, ok: false, reason: e instanceof Error ? e.message : 'unknown' });
    }
  }, [phase, slug, allAnswered, answers]);

  /** 启动 AI 心理报告流式生成（仅当已解锁 resilience_assess） */
  const startReportStream = useCallback(async () => {
    if (reportPhase === 'streaming' || !result || !detail) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setReportPhase('streaming');
    setReportText('');
    setReportErr(null);
    setReportDisclaimer('');
    track('scales', 'report.start', { slug });

    const t0 = performance.now();
    try {
      const { text, disclaimer: d } = await requestScaleReportStream(
        {
          slug: result.slug,
          title: detail.title,
          dimensions: result.dimensions,
          summary: result.summary,
        },
        {
          signal: ctrl.signal,
          onDelta: (_chunk, full) => setReportText(full),
          onMeta: (meta) => setReportDisclaimer(meta.disclaimer),
        }
      );
      setReportText(text);
      setReportDisclaimer(d);
      setReportPhase('done');
      track('scales', 'report.done', { slug, ok: true, latencyMs: Math.round(performance.now() - t0) });
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setReportErr(e instanceof Error ? e.message : '报告生成失败，请稍后重试');
      setReportPhase('error');
      track('scales', 'report.done', { slug, ok: false, reason: e instanceof Error ? e.message : 'unknown' });
    }
  }, [reportPhase, result, detail, slug]);

  /** 「生成 AI 心理报告」统一闸门：付费解锁 → 开始 */
  const onGenerateReportClick = () => {
    if (reportPhase === 'streaming') return;
    if (!isUnlocked('resilience_assess')) {
      pendingReportRef.current = true;
      setPaywallOpen(true);
      return;
    }
    void startReportStream();
  };

  /* ------------------------------ 渲染 ------------------------------ */

  if (phase === 'loading') {
    return (
      <div className="scales-page">
        <LoadingState label="正在加载量表…" />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="scales-page">
        <ErrorState title="量表加载失败" hint={errMsg ?? undefined} onRetry={load} />
        <div className="sc-back-row">
          <Link href="/scales" className="sc-back-link">← 返回量表列表</Link>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  /* ---- 介绍页 ---- */
  if (phase === 'intro') {
    return (
      <div className="scales-page">
        <div className="result-card sc-intro-card">
          <h2 className="sc-title">{detail.title}</h2>
          {detail.tagline && <p className="sc-tagline">{detail.tagline}</p>}
          {detail.description && <p className="sc-desc">{detail.description}</p>}
          <div className="sc-card-meta sc-intro-meta">
            <span>{questions.length} 题</span>
            <span className="sc-meta-dot">·</span>
            <span>约 {detail.estimatedMinutes} 分钟</span>
            <span className="sc-meta-dot">·</span>
            <span>即时出结果</span>
          </div>
          <ul className="sc-principles">
            <li>请根据<strong>最近一段时间</strong>的真实状态作答，没有对错之分；</li>
            <li>凭第一反应选择即可，不必反复推敲；</li>
            <li>结果为<strong>自我觉察与成长参考</strong>，不构成任何医学或心理诊断。</li>
          </ul>
          {detail.disclaimer && <p className="sc-disclaimer">{detail.disclaimer}</p>}
          <div className="sc-btn-row">
            <Button variant="primary" large type="button" onClick={startQuiz}>
              开始作答
            </Button>
            <Link href="/scales" className="sc-back-link">← 返回列表</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---- 作答页 / 提交中 ---- */
  if (phase === 'quiz' || phase === 'submitting') {
    const q = questions[current];
    if (!q) return null;
    const progressPct = Math.round((answeredCount / questions.length) * 100);

    return (
      <div className="scales-page">
        <div className="sc-quiz-top">
          <span className="sc-quiz-count">
            第 <strong>{current + 1}</strong> / {questions.length} 题
          </span>
          <span className="sc-quiz-progress-num">{progressPct}%</span>
        </div>
        <div className="sc-progress-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="sc-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="result-card sc-question-card" key={q.id}>
          <p className="sc-question-text">{q.text}</p>
          <div className="sc-options">
            {q.options.map((opt) => {
              const picked = answers[q.id] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`sc-option${picked ? ' is-picked' : ''}`}
                  disabled={phase === 'submitting'}
                  onClick={() => pickAnswer(q.id, opt.value)}
                >
                  <span className="sc-option-label">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sc-quiz-nav">
          <Button
            variant="ghost"
            type="button"
            disabled={current === 0 || phase === 'submitting'}
            onClick={() => goQuestion(current - 1)}
          >
            ← 上一题
          </Button>
          {canSubmit ? (
            <Button variant="primary" large type="button" disabled={phase === 'submitting'} onClick={submit}>
              {phase === 'submitting' ? '正在生成结果…' : '提交并查看结果'}
            </Button>
          ) : (
            <Button
              variant="ghost"
              type="button"
              disabled={answers[q.id] == null || isLast || phase === 'submitting'}
              onClick={() => goQuestion(current + 1)}
            >
              下一题 →
            </Button>
          )}
        </div>

        {phase === 'submitting' && <LoadingState label="正在计算你的五维画像…" />}
      </div>
    );
  }

  /* ---- 结果页 ---- */
  if (phase === 'result' && result) {
    return (
      <div className="scales-page" ref={resultRef}>
        <div className="result-card sc-result-head">
          <p className="sc-result-kicker">测评完成</p>
          <h2 className="sc-title">{detail.title}</h2>
          <p className="sc-tagline">你的五维画像 · 分数为相对倾向（0–100），无好坏之分</p>
        </div>

        <div className="sc-dim-list">
          {result.dimensions.map((d) => (
            <div className="result-card sc-dim-card" key={d.key}>
              <div className="sc-dim-head">
                <span className="sc-dim-name">{d.name}</span>
                <span className="sc-dim-score">{d.score}</span>
              </div>
              <div className="sc-dim-bar-track">
                <div className="sc-dim-bar-fill" style={{ width: `${Math.max(0, Math.min(100, d.score))}%` }} />
              </div>
              <p className="sc-dim-band">{bandLabel(d.band)}</p>
              {d.interpretation && <p className="sc-dim-text">{d.interpretation}</p>}
            </div>
          ))}
        </div>

        {result.summary && (
          <div className="result-card sc-summary-card">
            <h3 className="sc-section-label">综合解读</h3>
            <p className="sc-summary-text">{result.summary}</p>
          </div>
        )}

        {/* ============ AI 心理报告（付费闸门：resilience_assess） ============ */}
        <div className="result-card sc-report-card" ref={reportRef}>
          <h3 className="sc-section-label">🤖 AI 心理报告</h3>
          <p className="sc-report-hint">
            基于你刚完成的计分结果，生成一份<strong>非诊断、成长导向</strong>的自我觉察解读；
            分数高低没有「好 / 坏」之分，报告只帮你看见倾向与可轻装起步的一小步。
          </p>

          {reportPhase === 'idle' && (
            <div className="sc-btn-row">
              <Button variant="primary" type="button" onClick={onGenerateReportClick}>
                生成 AI 心理报告 →
              </Button>
              <span className="sc-report-price">单份 ¥9.9（复用「复原力测评报告」权益）</span>
            </div>
          )}

          {reportPhase === 'streaming' && (
            <>
              <OmLoading label="正在对照你的计分生成觉察报告…" mode="inline" />
              {reportText && (
                <div
                  className="sc-report-md"
                  dangerouslySetInnerHTML={{
                    __html: mdToHtml(sanitizeAiText(reportText)) + '<span class="sc-report-cursor">▌</span>',
                  }}
                />
              )}
            </>
          )}

          {reportPhase === 'done' && reportText && (
            <>
              <div
                className="sc-report-md"
                dangerouslySetInnerHTML={{ __html: mdToHtml(sanitizeAiText(reportText)) }}
              />
              {reportDisclaimer && <p className="sc-disclaimer">{reportDisclaimer}</p>}
            </>
          )}

          {reportPhase === 'error' && (
            <>
              <p className="sc-report-err">报告生成失败：{reportErr}</p>
              <div className="sc-btn-row">
                <Button variant="ghost" type="button" onClick={onGenerateReportClick}>
                  重试生成
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="sc-disclaimer">{result.disclaimer || detail.disclaimer}</p>

        <div className="sc-btn-row">
          <Button variant="primary" type="button" onClick={startQuiz}>
            重新测一次
          </Button>
          <Link href="/scales" className="sc-back-link">← 返回量表列表</Link>
        </div>

        {/* 付费墙：AI 心理报告复用 resilience_assess 权益 */}
        <PaywallModal
          open={paywallOpen}
          item="resilience_assess"
          onClose={() => setPaywallOpen(false)}
          onUnlocked={() => {
            if (isUnlocked('resilience_assess')) {
              setPaywallOpen(false);
              if (pendingReportRef.current) {
                pendingReportRef.current = false;
                void startReportStream();
              }
            }
          }}
        />
      </div>
    );
  }

  return null;
}
