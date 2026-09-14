'use client';

import type { QimenAPIResult } from '@/lib/api';
import SectionIcon from '@/components/ui/SectionIcon';
import { ModuleProps, ApiBadge, QIMEN_PALACES, QIMEN_QI } from '../shared';

/** 模块6：奇门遁甲 */
export function QimenModule({ data, status }: ModuleProps<QimenAPIResult>) {
  const palaces = (data?.palaces ?? QIMEN_PALACES) as (QimenAPIResult['palaces'][number] & { combColor?: string })[];
  const qi = data?.qi ?? QIMEN_QI;
  const guide = data?.guide;

  // 吉凶颜色
  const jixiongColor = (jx?: string) => {
    if (!jx) return 'var(--text-muted)';
    if (jx.includes('吉')) return 'var(--accent-green)';
    if (jx.includes('凶')) return '#ff6b6b';
    return 'var(--text-muted)';
  };
  // 格局/旺衰等级颜色
  const levelColor = (lv?: string) => {
    if (!lv) return 'var(--text-muted)';
    if (lv.includes('吉')) return 'var(--accent-green)';
    if (lv.includes('凶')) return '#ff6b6b';
    if (lv === '旺' || lv === '相') return 'var(--accent-green)';
    if (lv === '死' || lv === '囚') return '#ff6b6b';
    return 'var(--text-muted)';
  };

  return (
    <>
      {/* ===== 卡片1：盘面概览 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 奇门遁甲 · {data?.type || ''} <ApiBadge status={status} />
        </div>

        {/* 盘面核心信息 */}
        <div className="qimen-intro">
          {data ? (
            <>
              盘面类型：<strong className="tc-secondary">{data.type}</strong> | 值符：<strong className="tc-secondary">{data.valueFu}</strong>
              {' '}| 值使：<strong className="tc-secondary">{data.valueShi}</strong> | 节气：<strong className="tc-secondary">{data.jieqi}</strong>
            </>
          ) : null}
        </div>

        {/* 干支信息 */}
        {data && (
          <div className="qimen-ganzi-bar">
            <div className="qimen-ganzi-cell">
              <div className="qimen-ganzi-label">时干</div>
              <div className="qimen-ganzi-val">{data.shiGan}</div>
            </div>
            <div className="qimen-ganzi-cell">
              <div className="qimen-ganzi-label">时干支</div>
              <div className="qimen-ganzi-val">{data.shiGanZhi}</div>
            </div>
            <div className="qimen-ganzi-cell">
              <div className="qimen-ganzi-label">日干支</div>
              <div className="qimen-ganzi-val">{data.riGanZhi}</div>
            </div>
          </div>
        )}

        {/* 九宫盘面 */}
        <div className="qimen-grid">
          {palaces.map((p) => (
            <div key={p.dir} className="qimen-palace" style={{
              borderColor: p.border || undefined,
              background: p.bg || undefined
            }}>
              <div className="qimen-palace-dir">{p.dir}</div>
              <div className="qimen-palace-star" style={{ color: p.starColor }}>{p.star}</div>
              <div className="qimen-palace-door" style={{ color: p.doorColor }}>{p.door}</div>
              <div className="qimen-palace-god">{p.god}</div>
              {/* 天盘地盘 */}
              <div className="qimen-palace-pan">
                {p.tianpan && (
                  <div className="qimen-pan-row">
                    <span className="qimen-pan-label">天</span>
                    <span className="qimen-pan-val tian">{p.tianpan}</span>
                  </div>
                )}
                {p.dipan && (
                  <div className="qimen-pan-row">
                    <span className="qimen-pan-label">地</span>
                    <span className="qimen-pan-val di">{p.dipan}</span>
                  </div>
                )}
              </div>
              {/* 组合 */}
              <div className="qimen-palace-comb" style={{ color: p.combColor || 'var(--text-muted)' }}>{p.comb}</div>
              {/* 吉凶标记 */}
              {p.jixiong && (
                <div className="qimen-palace-jixiong" style={{ color: jixiongColor(p.jixiong) }}>
                  {p.jixiong}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== 卡片2：三奇方位 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 奇门断语 · 三奇方位
        </div>
        <div className="qimen-qi-grid">
          {qi.map((q) => (
            <div key={q.title} className="qimen-qi-card" style={{ ['--qi-bg' as string]: q.bg, ['--qi-bd' as string]: q.border }}>
              <div className="qimen-qi-title" style={{ color: q.color }}>{q.title}</div>
              <div className="qimen-qi-text">{q.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== 卡片3：行动指南 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 奇门行动指南
        </div>
        <div className="qimen-guide">
          {guide ? guide.map((g) => (
            <p key={g.title}><span>{g.icon}</span> <strong style={{ color: g.color }}>{g.title}</strong> → {g.note}</p>
          )) : (
            <p style={{ color: 'var(--text-muted)' }}>排盘数据生成中…行动指南将在排盘完成后展示。</p>
          )}
        </div>
      </div>

      {/* ===== 卡片4：用神体系 Q1 ===== */}
      {data?.yongShen && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="compass" /> 用神立极 · {data.yongShen.category}
          </div>
          <div className="qimen-yongshen-list">
            {data.yongShen.items.map((it, i) => (
              <div key={`${it.name}-${i}`} className="qimen-yongshen-item">
                <div className="qimen-ys-head">
                  <span className="qimen-ys-name">{it.name}</span>
                  <span className="qimen-ys-gong">落 {it.gongName}（{it.wuxing}）</span>
                  <span className="qimen-ys-tag" style={{ color: jixiongColor(it.jixiong) }}>{it.jixiong}</span>
                </div>
                <div className="qimen-ys-meta">
                  关系：{it.relation}　|　旺衰：<span style={{ color: levelColor(it.wang) }}>{it.wang}</span>
                  {it.star && `　|　星：${it.star}`}{it.door && `　门：${it.door}`}{it.god && `　神：${it.god}`}
                </div>
                <div className="qimen-ys-note">{it.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 卡片5：奇仪格局 Q2/Q7 ===== */}
      {data?.patterns && data.patterns.length > 0 && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="compass" /> 奇仪格局 · {data.patterns.length} 处
          </div>
          <div className="qimen-pattern-list">
            {data.patterns.map((p, i) => (
              <div key={`${p.gong}-${i}`} className="qimen-pattern-item">
                <div className="qimen-pt-head">
                  <span className="qimen-pt-gong">{p.gongName}</span>
                  <span className="qimen-pt-comb">天 {p.tianpan} / 地 {p.dipan}</span>
                  <span className="qimen-pt-level" style={{ color: levelColor(p.level) }}>{p.level}</span>
                </div>
                <div className="qimen-pt-name">{p.name}</div>
                <div className="qimen-pt-desc">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 卡片6：空亡与马星 Q3/Q4 ===== */}
      {(data?.kongWang || data?.maStar) && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="compass" /> 空亡 · 马星
          </div>
          <div className="qimen-km-grid">
            {data?.kongWang && (
              <div className="qimen-km-cell">
                <div className="qimen-km-label">空亡</div>
                <div className="qimen-km-desc">{data.kongWang.desc}</div>
              </div>
            )}
            {data?.maStar && (
              <div className="qimen-km-cell">
                <div className="qimen-km-label">驿马星</div>
                <div className="qimen-km-desc">{data.maStar.desc}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 卡片7：旺衰生克 Q6 ===== */}
      {data?.wangShuai && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="compass" /> 月令旺衰 · 生克
          </div>
          <div className="qimen-ws-desc">{data.wangShuai.desc}</div>
          <div className="qimen-ws-list">
            {data.wangShuai.yong.map((y, i) => (
              <div key={`${y.name}-${i}`} className="qimen-ws-item">
                <span className="qimen-ws-name">{y.name}</span>
                <span className="qimen-ws-wx">{y.wx}</span>
                <span className="qimen-ws-state" style={{ color: levelColor(y.state) }}>{y.state}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 卡片8：应期推断 Q5 ===== */}
      {data?.yingqi && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="compass" /> 应期推断
          </div>
          <div className="qimen-yq-summary">{data.yingqi.summary}</div>
          <ul className="qimen-yq-points">
            {data.yingqi.points.map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
