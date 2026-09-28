'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  RetrieveResult,
  BaziAPIResult,
  BaziDayun,
} from '@/lib/api';
import { requestRetrieve } from '@/lib/api';
import SectionIcon from '@/components/ui/SectionIcon';
import { computeLocalBazi, buildDayunAnalysis, buildGejuYuanwen, type LocalDayunInput } from '@/data/baziDayun';
import { ModuleProps, ApiBadge } from '../shared';

/* ============================= 工具函数 ============================= */

/** 渲染检索增强命中的典籍原文：按行分割，行内《…》典籍书名号高亮 */
function renderRefText(text: string) {
  return text.split('\n').map((line, i) => (
    <div key={i} className="bazi-raw-line">
      {line
        .split(/(《[^》]*》)/)
        .map((seg, j) =>
          /^《/.test(seg) ? (
            <span key={j} className="bazi-raw-classic">{seg}</span>
          ) : (
            <span key={j}>{seg}</span>
          )
        )}
    </div>
  ));
}

/* ============================= 常量 ============================= */

/** 八字四柱：仅作最终 fallback，原型演示数据已清空，无排盘数据时返回空数组 */
const PILLARS: { label: string; gan: string; zhi: string; el: string; elCls: string; note?: string; gold?: boolean }[] = [];

/** 十神：原型演示数据已清空，无排盘数据时返回空数组 */
const SHI_SHEN: { name: string; val: number; wuxing?: string; color?: string }[] = [];

/** 模块1：八字命理
 * 后端在线 → 渲染后端 pillars/dayun + liunian（流年标 pink）；
 * 后端离线 → 本地 lunar-typescript 按出生信息真实排盘（四柱 + 大运流年，不再用写死的演示数据）
 */
export function BaziModule({ data, status, birth }: ModuleProps<BaziAPIResult> & { birth: LocalDayunInput }) {
  const GAN_WX: Record<string, string> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const local = useMemo(() => (data ? null : computeLocalBazi(birth)), [data, birth]);
  // 命理原文（检索增强）：完全由后端 /retrieve 返回，无前端兜底；null=加载中，空 text=无命中
  const [refs, setRefs] = useState<RetrieveResult | null>(null);
  useEffect(() => {
    let aborted = false;
    const localNow = data ? null : computeLocalBazi({ date: birth.date, time: birth.time, gender: birth.gender });
    const payload = {
      dayMaster: data?.dayMaster ?? localNow?.dayGan ?? '',
      dayMasterWuxing: data?.dayMasterWuxing ?? (localNow?.dayGan ? GAN_WX[localNow.dayGan] : ''),
      pillars: data?.pillars ?? localNow?.pillars ?? [],
      wuxing: data?.wuxing ?? localNow?.wuxing ?? [],
      wuxingCount: data?.wuxingCount ?? localNow?.wuxingCount ?? [],
      lacking: data?.lacking ?? localNow?.lacking ?? [],
      shiShen: data?.shiShen ?? localNow?.shiShen ?? [],
      yongshen: data?.yongshen ?? localNow?.yongshen ?? null,
    };
    // 命理原文（古籍原文，来自 /retrieve 检索增强）
    requestRetrieve('bazi', payload)
      .then((r) => { if (!aborted) setRefs(r); })
      .catch(() => { if (!aborted) setRefs({ enabled: false, count: 0, sources: [], text: '' }); });
    return () => { aborted = true; };
  }, [data, birth.date, birth.time, birth.gender]);
  const pillars = data?.pillars ?? local?.pillars ?? PILLARS;
  const shiShen = data?.shiShen ?? local?.shiShen ?? SHI_SHEN;
  // 神煞（后端计算；离线兜底 LocalBaziResult 暂不含此字段，故不取 local）
  const shensha = data?.shensha ?? [];
  // 四柱·神煞解说：按柱聚合「落于此柱的神煞」，配合每柱自带的十神 note 与五行，拼成可读串讲。
  // 纯前端确定性生成，零 AI 成本；命理原文(古籍 RAG)保留作典籍依据，二者互补。
  // 十神解说：把「正印坐正官」这类裸标签补成白话，含经典组合判定（官印相生/食神制杀…）。
  const SS_MEANING: Record<string, string> = {
    '正官': '名誉事业与自律，掌职位贵气',
    '七杀': '魄力压力与竞争，掌权柄亦带险',
    '正印': '学识庇护与贵人，掌文凭清贵',
    '偏印': '灵慧钻研与孤僻，掌技艺偏门',
    '正财': '稳定收入与务实，掌本分之财',
    '偏财': '流动机遇与外财，掌人缘投机',
    '食神': '才华享受与温和，掌才艺口福',
    '伤官': '才气叛逆与表现，掌聪明外露',
    '比肩': '同辈朋友与自我，帮扶亦争',
    '劫财': '义气争夺与损耗，主破财手足',
  };
  const _normSS = (s: string) => (s === '偏官' ? '七杀' : s);
  const buildShiShenRead = (note: string): string => {
    if (!note) return '';
    if (note.includes('日主')) return '日柱即命主自身，其余三柱皆围绕日主而断。';
    const parts = note.split('坐');
    if (parts.length !== 2) return '';
    const stem = _normSS(parts[0].trim());
    const branch = _normSS(parts[1].trim());
    const mS = SS_MEANING[stem] || '';
    const mB = SS_MEANING[branch] || '';
    const has = (a: string, b: string) => stem === a && branch === b;
    let combo = '';
    if (['正印', '偏印'].includes(stem) && branch === '正官') combo = '官印相生，主清贵得名、得长辈上级提携。';
    else if (['正印', '偏印'].includes(branch) && stem === '正官') combo = '官印相生，主清贵得名、得长辈上级提携。';
    else if (['正印', '偏印'].includes(branch) && stem === '七杀') combo = '杀印相生，以印化杀，压力转权柄，主贵人解厄。';
    else if (has('食神', '七杀')) combo = '食神制杀，以才御压，化竞争为权柄，利开拓。';
    else if (has('伤官', '正官')) combo = '伤官见官，才智冲克规矩，易生是非口舌，宜敛锋。';
    else if (['正印', '偏印'].includes(stem) && ['正财', '偏财'].includes(branch)) combo = '财星破印，务实伤文，防因财损名、学业受扰。';
    else if (['正财', '偏财'].includes(stem) && branch === '正官') combo = '财官相生，富且贵，事业财运互旺。';
    else if (has('食神', '正财') || has('食神', '偏财')) combo = '食神生财，才艺变现，口福生财。';
    else if (has('伤官', '正财') || has('伤官', '偏财')) combo = '伤官生财，以才生利，利技艺经营。';
    else if ((stem === '比肩' || stem === '劫财') && (branch === '比肩' || branch === '劫财')) combo = '比劫相扶亦相争，朋友多而财易分。';
    else if (has('正官', '七杀') || has('七杀', '正官')) combo = '官杀混杂，权责交争，心志易摇，宜专一。';
    const base = `${stem}（${mS}）坐 ${branch}（${mB}）`;
    return combo ? `${base}；${combo}` : base;
  };
  const PILLAR_NAMES = ['年柱', '月柱', '日柱', '时柱'];
  const pillarReads = pillars.map((p, i) => {
    const pname = PILLAR_NAMES[i] ?? p.label.split(/\s+/)[0];
    return {
      label: p.label,
      gz: `${p.gan}${p.zhi}`,
      el: p.el,
      elCls: (p as any).elCls || '',
      note: p.note || '',
      noteRead: buildShiShenRead(p.note || ''),
      shensha: shensha.filter((s) => s.pillar === pname),
    };
  });
  const dayun: BaziDayun[] = data?.dayun
    ? [
        ...data.dayun,
        ...(data.liunian ?? []).map((l): BaziDayun => ({
          age: `${l.yr}年`,
          gan: l.gan,
          note: l.note,
          pink: true,
        })),
      ]
    : (local?.dayun ?? []);
  const geju = buildGejuYuanwen(pillars[2]?.gan || '', pillars[1]?.zhi || '', pillars.map((p) => p.gan));

  // ===== 十神、用神与格局 · 综合研判所需派生数据 =====
  const yong = data?.yongshen ?? local?.yongshen ?? null;
  const xiWx = new Set((yong?.xi ?? []).map((s) => String(s).trim().charAt(0)).filter(Boolean));
  const jiWx = new Set((yong?.ji ?? []).map((s) => String(s).trim().charAt(0)).filter(Boolean));
  const xiList = (yong?.xi ?? []).slice(0, 4);
  const jiList = (yong?.ji ?? []).slice(0, 4);
  const dm = data?.dayMaster ?? local?.dayGan ?? '—';
  const dmWx = data?.dayMasterWuxing ?? (local?.dayGan ? GAN_WX[local.dayGan] : '');
  const wxCountArr = data?.wuxingCount ?? local?.wuxingCount ?? [];
  const dmCount = ((wxCountArr.find((c: any) => c?.label === dmWx)?.count) as number | undefined) ?? 0;
  const strengthLabel = dmCount >= 4 ? '气势偏旺' : dmCount <= 1 ? '气势偏弱' : '气势中和';
  const xiBrief = Array.from(xiWx).join('、') || '—';
  return (
    <>
      <div className="result-card">
        <div className="result-card-title"><SectionIcon name="sparkles" /> 八字四柱 · 格局总览 <ApiBadge status={status} /></div>
        <div className="bazi-pillars">
          {pillars.map((p) => (
            <div className="pillar" key={p.label}>
              <div className="pillar-label">{p.label}</div>
              <div className="pillar-char">{p.gan}{p.zhi}</div>
              <div className={'pillar-element ' + p.elCls}>{p.el}</div>
              <div className={'pillar-note' + (p.gold ? ' gold' : '')}>{p.note}</div>
            </div>
          ))}
        </div>

        {/* 神煞：高频子集（天乙贵人/文昌/桃花/驿马/华盖/禄神/羊刃/空亡），标注落于四柱哪一柱 */}
        {shensha.length > 0 && (
          <div className="shensha-box">
            <div className="sub-sec-title">神煞</div>
            <div className="shensha-grid">
              {shensha.map((s) => (
                <div key={s.name} className="shensha-cell">
                  <div className="shensha-top">
                    <span className="shensha-name">{s.name}</span>
                    <span className="shensha-zhi">{s.zhi}</span>
                  </div>
                  <div className={'shensha-pillar' + (s.pillar.startsWith('待') ? ' pending' : '')}>{s.pillar}</div>
                  <div className="shensha-desc">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 四柱·神煞解说：聚合每柱十神note+五行+落柱神煞，确定性白话串讲，零AI成本 */}
        <div className="pillar-read-box">
          <div className="sub-sec-title">四柱 · 神煞解说</div>
          <div className="pillar-read-list">
            {pillarReads.map((pr) => (
              <div className="pillar-read-item" key={pr.label}>
                <div className="pr-head">
                  <span className="pr-label">{pr.label}</span>
                  <span className="pr-gz">{pr.gz}</span>
                  <span className={'pr-el ' + pr.elCls}>{pr.el}</span>
                </div>
                {pr.note && (
                  <div className="pr-note">
                    <span className="pr-note-label">{pr.note}</span>
                    {pr.noteRead && <span className="pr-note-desc">{pr.noteRead}</span>}
                  </div>
                )}
                {pr.shensha.length > 0 && (
                  <div className="pr-shensha">
                    {pr.shensha.map((s) => (
                      <div className="pr-ss-item" key={s.name}>
                        <span className="pr-ss-name">{s.name}</span>
                        <span className="pr-ss-desc">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 命理原文：完全由后端 /retrieve 检索增强返回（典籍原文），无前端兜底 */}
        <div className="bazi-raw">
          <div className="bazi-raw-title">📜 典籍原文</div>
          {refs === null ? (
            <div className="bazi-raw-loading">典籍原文生成中…</div>
          ) : refs.text ? (
            <div className="bazi-raw-text">{renderRefText(refs.text)}</div>
          ) : (
            <div className="bazi-raw-empty">暂无典籍原文</div>
          )}
        </div>
      </div>

      {/* ===== 十神、用神与格局 · 综合研判（合并原「十神格局分析」与「十神、用神与格局分析」） ===== */}
      <div className="result-card">
        <div className="result-card-title"><SectionIcon name="layers" /> 十神、用神与格局分析</div>

        {/* 十神总览 */}
        <div className="shi-shen-grid">
          {shiShen.map((s) => (
            <div key={s.name} className="shi-shen-cell">
              <div className="shi-shen-name">{s.name}</div>
              <div className="shi-shen-val" style={{ color: s.color || 'inherit' }}>{s.val}</div>
              <div className="shi-shen-wuxing">{s.wuxing}</div>
            </div>
          ))}
        </div>

        {/* 综合研判 */}
        <div className="zonghe-verdict">
          日主<strong className="tc-secondary">{dm}</strong>（{dmWx}）四柱中「{dmWx}」现 <strong>{dmCount}</strong> 位，{strengthLabel}；以<strong className="tc-good">{xiBrief}</strong> 为用神调候，成<strong className="tc-gold">{geju?.name ?? '普通格局'}</strong> 之格。
        </div>

        {/* 十神喜忌对照 */}
        <div className="sub-sec-title">十神喜忌对照</div>
        <div className="shishen-yong-grid">
          {shiShen.map((s) => {
            const wx = (s.wuxing || '').slice(-1);
            const tag = xiWx.has(wx) ? 'good' : jiWx.has(wx) ? 'bad' : 'mid';
            const tagText = tag === 'good' ? '喜' : tag === 'bad' ? '忌' : '平';
            return (
              <div key={s.name} className={'shishen-yong-cell ' + tag}>
                <div className="sy-top"><span className="sy-name">{s.name}</span><span className={'sy-tag ' + tag}>{tagText}</span></div>
                <div className="sy-wx">{s.wuxing}</div>
              </div>
            );
          })}
        </div>

        {/* 用神要旨 */}
        <div className="sub-sec-title">用神要旨</div>
        <div className="yong-yao">
          <div className="yy-row good"><span className={'yy-label good'}>喜用神</span><span className="yy-val">{xiList.length ? xiList.join('、') : '—'}</span></div>
          <div className="yy-row bad"><span className={'yy-label bad'}>忌神</span><span className="yy-val">{jiList.length ? jiList.join('、') : '—'}</span></div>
        </div>

        {/* 格局论断（原两处格局块合并：名 + 定格依据 + 原文） */}
        <div className="sub-sec-title">格局论断</div>
        <div className="geju-dinglun">
          {geju ? (
            <>
              <div className="gdl-name">{geju.name}</div>
              <div className="gdl-basis">{geju.basis}</div>
              <div className="gdl-text">{geju.text}</div>
            </>
          ) : (
            <div className="gdl-empty">排盘数据缺失，格局需以月令藏干透干论定，请补全出生信息后重试。</div>
          )}
        </div>
      </div>

      <div className="result-card">
        <div className="result-card-title"><SectionIcon name="calendar-days" /> 大运流年</div>
        {(() => {
          const qy = data?.qiyun ?? local?.qiyun;
          if (!qy?.date) return null;
          const [y, m, d] = qy.date.split('-').map(Number);
          return (
            <div className="dayun-qiyun">
              ⏱ 起运：出生后{qy.after} · {y}年{m}月{d}日起运（虚岁{qy.age}岁起）· 下方年龄均按<strong>虚岁</strong>计
            </div>
          );
        })()}
        <div className="dayun-scroll">
          {dayun.map((d) => (
            <div key={d.age + d.gan} className={'dayun-card' + (d.highlight ? ' hl' : '')}>
              <div className={'dayun-age' + (d.primary ? ' primary' : '')}>{d.age}</div>
              <div className={'dayun-gan' + (d.gold ? ' gold' : d.pink ? ' pink' : d.green ? ' green' : d.primary ? ' primary' : '')}>{d.gan}</div>
              <div className={'dayun-note' + (d.gold ? ' gold' : d.pink ? ' pink' : d.green ? ' green' : d.primary ? ' primary' : '')}>{d.note}</div>
            </div>
          ))}
        </div>
        {/* 大运流年解说（基于排盘结果动态生成） */}
        {buildDayunAnalysis(pillars[2]?.gan || '', dayun).map((a, i) => (
          <div key={i} className={'dayun-analysis-item ' + a.tone}>
            <span className="dayun-analysis-tag">{a.tag}</span>
            <div className="dayun-analysis-body">
              <div className="dayun-analysis-title">{a.title}</div>
              <div className="dayun-analysis-text">{a.text}</div>
            </div>
          </div>
        ))}
      </div>

    </>
  );
}
