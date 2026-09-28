'use client';

/**
 * 心理量表 · 列表页（/scales）—— 右轨 MVP（2026-09-19）
 * ----------------------------------------------------------------------------
 * 自我觉察 / 成长导向的结构化自评量表目录：
 * - 数据源：GET /api/v1/scales（后端量表目录，题目与计分以服务端为准）；
 * - 点击卡片 → /scales/[slug] 进入「介绍 → 作答 → 计分结果」闭环；
 * - 合规：非诊断、非病理，不替代专业帮助（免责声明随详情/结果下发）。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { fetchScales, type ScaleListItem } from '@/lib/api';
import { track } from '@/lib/track';
import '@/styles/scales.scss';

export default function ScalesPage() {
  const [scales, setScales] = useState<ScaleListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setScales(null);
    setErr(null);
    fetchScales()
      .then((list) => setScales(list))
      .catch((e) => setErr(e instanceof Error ? e.message : '获取量表列表失败'));
  };

  useEffect(load, []);

  return (
    <div className="scales-page">
      <div className="sc-page-head">
        <h1 className="sc-page-title">心理自评量表</h1>
        <div className="sc-page-subtitle">自我觉察 · 成长导向 · 非诊断</div>
      </div>

      <p className="sc-page-intro">
        基于公共领域的经典心理学量表，帮助你从多个角度看见自己相对稳定的倾向。
        作答约几分钟，结果即时生成，仅用于自我觉察与成长参考。
      </p>

      {err !== null && <ErrorState title="量表列表加载失败" hint={err} onRetry={load} />}

      {err === null && scales === null && <LoadingState label="正在加载量表目录…" />}

      {err === null && scales !== null && scales.length === 0 && (
        <EmptyState icon="📋" title="暂无可用量表" hint="量表目录正在扩充中，敬请期待" />
      )}

      {err === null && scales !== null && scales.length > 0 && (
        <div className="sc-list">
          {scales.map((s) => (
            <Link
              key={s.slug}
              href={`/scales/${s.slug}`}
              className="sc-card result-card"
              onClick={() => track('scales', 'card.click', { slug: s.slug })}
            >
              <div className="sc-card-head">
                <h3 className="sc-card-title">{s.title}</h3>
                {s.tagline && <p className="sc-card-tagline">{s.tagline}</p>}
              </div>
              {s.description && <p className="sc-card-desc">{s.description}</p>}
              <div className="sc-card-meta">
                <span>{s.questionCount} 题</span>
                <span className="sc-meta-dot">·</span>
                <span>约 {s.estimatedMinutes} 分钟</span>
              </div>
              <div className="sc-card-action">
                <Button variant="primary" type="button" tabIndex={-1}>
                  开始测评 →
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="sc-page-footnote">
        本页量表为自我觉察工具，不构成任何医学或心理诊断；若你正处于强烈情绪困扰中，请联系专业帮助。
      </p>
    </div>
  );
}
