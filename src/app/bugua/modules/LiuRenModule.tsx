'use client';

import type { LiuRenAPIResult } from '@/lib/api';
import SectionIcon from '@/components/ui/SectionIcon';
import { ModuleProps, ApiBadge } from '../shared';

/** 模块：大六壬（三式之一）—— 天地盘 / 四课 / 三传 / 十二天将 */
export function LiuRenModule({ data, status }: ModuleProps<LiuRenAPIResult>) {
  if (!data) {
    return (
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 大六壬 · 起课 <ApiBadge status={status} />
        </div>
        <p style={{ color: 'var(--text-muted)' }}>起课数据生成中…</p>
      </div>
    );
  }

  const jxColor = (jx?: string) => {
    if (!jx) return 'var(--text-muted)';
    if (jx === '吉') return 'var(--accent-green)';
    if (jx === '凶') return '#ff6b6b';
    return 'var(--text-muted)';
  };

  return (
    <>
      {/* ===== 卡片1：课式概览 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 大六壬 · 课式概览 <ApiBadge status={status} />
        </div>

        <div className="liuren-meta">
          <span>节气：<strong className="tc-secondary">{data.jieqi}</strong></span>
          <span>月将：<strong className="tc-secondary">{data.yueJiang}（{data.yueJiangName}）</strong></span>
          <span>占时：<strong className="tc-secondary">{data.zhanShi}时</strong></span>
          <span>日辰：<strong className="tc-secondary">{data.riGanZhi}</strong></span>
          <span>日干寄宫：<strong className="tc-secondary">{data.riGan}寄{data.jiGong}</strong></span>
          <span>贵人：<strong className="tc-secondary">{data.guiRen.zhi}（{data.guiRen.dayNight}）</strong></span>
          {data.fuYin && <span className="liuren-flag">伏吟</span>}
          {data.fanYin && <span className="liuren-flag">反吟</span>}
        </div>

        {data.yueJiangDesc && (
          <div className="liuren-yuejiang">{data.yueJiang}将 · {data.yueJiangDesc}</div>
        )}
      </div>

      {/* ===== 卡片2：天地盘 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 天地盘（月将加占时）
        </div>
        <div className="liuren-pan">
          {data.tianPan.map((p) => (
            <div key={p.zhi} className={`liuren-pan-cell${p.kongWang ? ' is-kong' : ''}`}>
              <div className="liuren-pan-di">{p.zhi}</div>
              <div className="liuren-pan-shen">
                <span className="liuren-pan-gan">{p.gan || '空'}</span>
                {p.shen}
              </div>
              <div className="liuren-pan-jiang">{p.jiang}</div>
              <div className="liuren-pan-lq">{p.liuqin}</div>
            </div>
          ))}
        </div>
        <div className="liuren-legend">
          上为天盘神（含旬遁干）· 下为地盘本位 · 末行为所临天将
          {data.kongWang.length > 0 && `　空亡：${data.kongWang.join('、')}`}
        </div>
      </div>

      {/* ===== 卡片3：四课三传 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 四课 · 三传
        </div>

        <div className="liuren-sike">
          {data.siKe.map((k) => (
            <div key={k.label} className={`liuren-ke${k.relation ? ' has-rel' : ''}`}>
              <div className="liuren-ke-label">{k.label}</div>
              <div className="liuren-ke-body">
                <span className="liuren-ke-upper">{k.upper}</span>
                <span className="liuren-ke-wx">{k.upperWuxing}</span>
              </div>
              <div className="liuren-ke-lower">
                {k.lower}
                <span className="liuren-ke-wx">{k.lowerWuxing}</span>
              </div>
              <div className={`liuren-ke-rel rel-${k.relation || 'none'}`}>{k.relationText}</div>
            </div>
          ))}
        </div>

        <div className="liuren-chuan">
          <div className="liuren-chuan-method">
            {data.sanChuan.method} · <strong style={{ color: 'var(--accent-gold)' }}>{data.sanChuan.keTi}</strong>
            <span className="liuren-chuan-from">（{data.sanChuan.fromKe}发用）</span>
          </div>
          <div className="liuren-chuan-flow">
            {data.sanChuan.items.map((it, i) => (
              <div key={it.label} className="liuren-chuan-item">
                {i > 0 && <span className="liuren-arrow">→</span>}
                <div className="liuren-chuan-box">
                  <div className="liuren-chuan-label">{it.label}</div>
                  <div className={`liuren-chuan-zhi${it.kongWang ? ' is-kong' : ''}`}>
                    {it.gan}{it.zhi}
                  </div>
                  <div className="liuren-chuan-meta">{it.jiang} · {it.liuqin}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="liuren-chuan-desc">{data.sanChuan.desc}</div>
        </div>
      </div>

      {/* ===== 卡片4：十二天将 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 十二天将
        </div>
        <div className="liuren-jiang-grid">
          {data.tianJiang.map((t) => (
            <div key={t.jiang} className="liuren-jiang-cell" title={t.desc}>
              <span className="liuren-jiang-zhi">{t.zhi}</span>
              <span className="liuren-jiang-name" style={{ color: jxColor(t.jiXiong) }}>{t.jiang}</span>
            </div>
          ))}
        </div>
        <div className="liuren-jiang-desc">
          {data.tianJiang.find((t) => t.zhi === data.sanChuan.items[0]?.zhi)?.desc
            ? `初传所临：${data.tianJiang.find((t) => t.zhi === data.sanChuan.items[0].zhi)?.jiang} —— ${data.tianJiang.find((t) => t.zhi === data.sanChuan.items[0].zhi)?.desc}`
            : ''}
        </div>
      </div>

      {/* ===== 卡片5：行动指南 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="compass" /> 六壬断要
        </div>
        <div className="qimen-guide">
          {data.guide.map((g) => (
            <p key={g.title}>
              <span>{g.icon}</span>{' '}
              <strong style={{ color: g.color }}>{g.title}</strong> → {g.note}
            </p>
          ))}
        </div>
        <div className="liuren-analysis">{data.analysis}</div>
      </div>
    </>
  );
}
