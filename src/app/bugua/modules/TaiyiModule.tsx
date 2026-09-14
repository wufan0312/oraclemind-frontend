'use client';

import type { TaiyiAPIResult } from '@/lib/api';
import SectionIcon from '@/components/ui/SectionIcon';
import { ModuleProps, ApiBadge } from '../shared';

/** 模块：太乙神数（三式之一）—— 积年 / 行宫 / 文昌始击 / 主客算 / 十六宫 */
export function TaiyiModule({ data, status }: ModuleProps<TaiyiAPIResult>) {
  if (!data) {
    return (
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 太乙神数 · 排局 <ApiBadge status={status} />
        </div>
        <p style={{ color: 'var(--text-muted)' }}>排局数据生成中…</p>
      </div>
    );
  }

  const gongCell = (label: string, g: TaiyiAPIResult['taiYiGong']) => (
    <div className="taiyi-gj-cell">
      <div className="taiyi-gj-label">{label}</div>
      <div className="taiyi-gj-val">
        {g.gong}宫 {g.gua}
      </div>
      <div className="taiyi-gj-meta">{g.fang} · {g.pos}位{g.shen ? ` · ${g.shen}` : ''}</div>
    </div>
  );

  return (
    <>
      {/* ===== 卡片1：排局概览 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 太乙神数 · 年计排局 <ApiBadge status={status} />
        </div>

        <div className="taiyi-meta">
          <span>{data.ganZhi}年</span>
          <span>积年 <strong className="tc-secondary">{data.jiNian}</strong></span>
          <span>七十二局第 <strong className="tc-secondary">{data.ju}</strong> 局</span>
          <span>小周第 <strong className="tc-secondary">{data.xiaoZhou}</strong> 年</span>
          <span className={`taiyi-dun ${data.yangDun ? 'yang' : 'yin'}`}>{data.dun}</span>
        </div>

        <div className="taiyi-dun-desc">{data.dunDesc}</div>
      </div>

      {/* ===== 卡片2：太乙居宫 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 太乙居宫 · 主客大将
        </div>
        <div className="taiyi-gj-grid">
          {gongCell('太乙', data.taiYiGong)}
          {gongCell('主大将', data.zhuDaJiang)}
          {gongCell('主参将', data.zhuCanJiang)}
          {gongCell('客大将', data.keDaJiang)}
          {gongCell('客参将', data.keCanJiang)}
        </div>
      </div>

      {/* ===== 卡片3：文昌 / 始击 / 主客算 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 文昌 · 始击 · 主客算
        </div>
        <div className="taiyi-mk-grid">
          <div className="taiyi-mk-cell">
            <div className="taiyi-mk-label">文昌（主目）</div>
            <div className="taiyi-mk-val">{data.wenChang.pos}位 · {data.wenChang.shen}</div>
            <div className="taiyi-mk-desc">{data.wenChang.desc}</div>
          </div>
          <div className="taiyi-mk-cell">
            <div className="taiyi-mk-label">始击（客目）</div>
            <div className="taiyi-mk-val">{data.shiJi.pos}位 · {data.shiJi.shen}</div>
            <div className="taiyi-mk-desc">{data.shiJi.desc}</div>
          </div>
          <div className="taiyi-mk-cell">
            <div className="taiyi-mk-label">计神 / 合神</div>
            <div className="taiyi-mk-val">{data.jiShen.pos} / {data.heShen.pos}</div>
            <div className="taiyi-mk-desc">计神主筹算，合神主相合</div>
          </div>
          <div className="taiyi-mk-cell">
            <div className="taiyi-mk-label">主算 / 客算</div>
            <div className="taiyi-mk-val">
              <span style={{ color: 'var(--accent-green)' }}>{data.zhuSuan}</span>
              {' / '}
              <span style={{ color: '#ff8e53' }}>{data.keSuan}</span>
            </div>
            <div className="taiyi-mk-desc">{data.verdict}</div>
          </div>
        </div>
      </div>

      {/* ===== 卡片4：十六宫神位 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 十六宫神位
        </div>
        <div className="taiyi-16-grid">
          {data.shiLiuGong.map((g) => (
            <div key={g.pos} className={`taiyi-16-cell${g.isTaiYi ? ' is-taiyi' : ''}`}>
              <div className="taiyi-16-pos">{g.pos}</div>
              <div className="taiyi-16-shen">{g.shen}</div>
              {g.stars.length > 0 && (
                <div className="taiyi-16-stars">{g.stars.join('、')}</div>
              )}
              {g.isTaiYi && <div className="taiyi-16-badge">太乙</div>}
            </div>
          ))}
        </div>
        <div className="taiyi-legend">高亮为太乙本位；其余标注为该宫所落之星神</div>
      </div>

      {/* ===== 卡片5：断要与流派声明 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 太乙断要
        </div>
        <div className="qimen-guide">
          {data.guide.map((g) => (
            <p key={g.title}>
              <span>{g.icon}</span>{' '}
              <strong style={{ color: g.color }}>{g.title}</strong> → {g.note}
            </p>
          ))}
        </div>
        <div className="taiyi-analysis">{data.analysis}</div>
        {data.provenance && (
          <div className="taiyi-provenance">⚠️ {data.provenance}</div>
        )}
      </div>
    </>
  );
}
