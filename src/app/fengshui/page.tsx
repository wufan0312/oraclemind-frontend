'use client';

import '@/styles/fengshui.scss';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
// 逐文件导入，不走 components/ui/index.ts 这个 barrel：
// 否则会把 RegionPicker / Cascader 及其 53KB 的 chinaRegions 数据拖进本路由
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import OmLoading from '@/components/ui/OmLoading';
import Chip from '@/components/ui/Chip';
import Tag from '@/components/ui/Tag';
import SectionTitle from '@/components/ui/SectionTitle';
import Compass from '@/components/fengshui/Compass';
import CrossPageLink from '@/components/ui/CrossPageLink';
import AIInterpretation from '@/components/ui/AIInterpretation';
import Progress from '@/components/ui/Progress';
import { requestFengshuiInterpretStream } from '@/lib/api';
import type { InterpretResponse, InterpretStreamOptions } from '@/lib/api';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { sanitizeAiText, mdToHtml } from '@/lib/markdown';
import {
  getAnnualStarLayout, STARS,
  getMingGua, getMingGuaInfo, GUAS, getBazhaiLayout, STAR_ATTRS,
  XING_SHA_LIST, type XingSha,
  DATE_CATEGORIES, findLuckyDates, getDailyYiJi, getShichenJiXiong,
  DIMENSIONS, type FengshuiDimension,
  loadBaziLink, getShengxiao, type BaziFengshuiLink,
} from '@/data/fengshuiData';

const TABS = [
  { k: 'home', i: '🏠', n: '家居风水' },
  { k: 'office', i: '💼', n: '办公风水' },
  { k: 'date', i: '📅', n: '择日择时' },
  { k: 'bazhai', i: '🧭', n: '八宅明镜' },
  { k: 'xingsha', i: '⚠️', n: '形煞自查' },
];

const CURRENT_YEAR = new Date().getFullYear();

// ==================== 真·SSE 流式输出 hook ====================
type StreamState = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

type StreamFetcher = (opts: {
  onDelta: NonNullable<InterpretStreamOptions['onDelta']>;
  onMeta: NonNullable<InterpretStreamOptions['onMeta']>;
  signal: AbortSignal;
}) => Promise<InterpretResponse>;

function useStreamingText() {
  const [state, setState] = useState<StreamState>('idle');
  const [displayText, setDisplayText] = useState('');
  const [fullText, setFullText] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (fetcher: StreamFetcher) => {
    // 停掉前一次（防止用户快速切维度并发两路流）
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState('loading');
    setDisplayText('');
    setFullText('');
    setDisclaimer('');

    try {
      const res = await fetcher({
        signal: ctrl.signal,
        onDelta: (_chunk, fullSoFar) => {
          setState((s) => (s === 'loading' ? 'streaming' : s));
          setDisplayText(fullSoFar);
          setFullText(fullSoFar);
        },
        onMeta: (_meta, d, finalText) => {
          if (d) setDisclaimer(d);
          if (finalText) {
            setFullText(finalText);
            setDisplayText(finalText);
          }
        },
      });
      // 兜底：SSE 可能正常 done 但 onMeta 没送（极端情况）
      if (res?.text && res.text.length > fullText.length) {
        setDisplayText(res.text);
        setFullText(res.text);
      }
      if (res?.disclaimer) setDisclaimer(res.disclaimer);
      setState('done');
    } catch (e: any) {
      if (e?.name === 'AbortError' || /AbortError/.test(String(e?.message || ''))) {
        // 被新请求覆盖 → 不标 error，保持当前 displayText
        setState((s) => (s === 'streaming' || s === 'loading' ? 'done' : s));
      } else {
        setState('error');
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, [fullText.length]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState('idle');
    setDisplayText('');
    setFullText('');
    setDisclaimer('');
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { state, displayText, disclaimer, start, reset };
}

export default function FengshuiPage() {
  const router = useRouter();
  const { birth: visitorBirth } = useVisitor();
  const [mode, setMode] = useState('home');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [selStarPos, setSelStarPos] = useState<string | null>(null);
  const [baziLink, setBaziLink] = useState<BaziFengshuiLink | null>(null);
  const [dim, setDim] = useState<FengshuiDimension>('wealth');
  const [dateCat, setDateCat] = useState('move');
  const [xingshaChecked, setXingshaChecked] = useState<Set<string>>(new Set());

  // 流式 AI hooks
  const homeAI = useStreamingText();
  const bazhaiAI = useStreamingText();

  // 读取八字跨页数据（补充 dayMaster/yongshen，出生日期以 VisitorProvider 为主）
  useEffect(() => {
    setBaziLink(loadBaziLink());
  }, []);

  // 从访客信息解析出生年月日（主数据源）
  const visitorParsed = useMemo(() => {
    if (!visitorBirth?.date) return null;
    const parts = visitorBirth.date.split('-');
    if (parts.length < 3) return null;
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10),
      time: visitorBirth.time || '不详',
      gender: visitorBirth.gender || '男',
      province: visitorBirth.province as string | undefined,
      city: visitorBirth.city as string | undefined,
    };
  }, [visitorBirth]);

  // 合并出生信息：优先 VisitorProvider，回退 BaziLink
  const birthInfo = useMemo(() => {
    if (visitorParsed) return visitorParsed;
    if (baziLink) return {
      year: baziLink.birthYear, month: baziLink.birthMonth, day: baziLink.birthDay,
      time: baziLink.birthTime, gender: baziLink.gender,
      province: undefined as string | undefined, city: undefined as string | undefined,
    };
    return null;
  }, [visitorParsed, baziLink]);

  // 计算九宫飞星布局
  const starLayout = useMemo(() => getAnnualStarLayout(year), [year]);
  const centralStar = useMemo(() => starLayout.find((s) => s.pos === '中宫')?.star, [starLayout]);

  // 八宅命卦 — 使用访客出生年/性别，无访客信息时用当前年默认
  const mingGuaNum = useMemo(() => {
    if (birthInfo) return getMingGua(birthInfo.year, birthInfo.gender as '男' | '女');
    return getMingGua(CURRENT_YEAR, '' as '男' | '女');
  }, [birthInfo]);
  const mingGuaInfo = useMemo(() => getMingGuaInfo(birthInfo?.year || CURRENT_YEAR, (birthInfo?.gender || '') as '男' | '女'), [birthInfo]);
  const bazhaiLayout = useMemo(() => getBazhaiLayout(mingGuaNum), [mingGuaNum]);

  // 选中星曜详情
  const selStar = useMemo(() => {
    if (!selStarPos) return null;
    return starLayout.find((s) => s.pos === selStarPos) || null;
  }, [selStarPos, starLayout]);

  // 形煞命中的列表
  const hitXingSha = useMemo(() => XING_SHA_LIST.filter((x) => x.checklist.some((_, j) => xingshaChecked.has(`${x.id}-${j}`))), [xingshaChecked]);

  // 请求 AI 堪舆四维解读（流式）
  const fetchHomeAI = useCallback(async (dimension: FengshuiDimension) => {
    const stars = starLayout.map((s) => ({
      pos: s.pos, starNum: s.starNum, starName: s.star.name, auspicious: s.star.auspicious,
    }));
    const bazhai = bazhaiLayout.map((b) => ({
      dir: b.dir, star: b.star, auspicious: b.attr.auspicious,
    }));
    const bazi = baziLink ? {
      dayMaster: baziLink.dayMaster, wuxing: baziLink.dayMasterWuxing,
      xi: baziLink.yongshen.xi, ji: baziLink.yongshen.ji,
    } : undefined;
    const xingSha = hitXingSha.map((x) => ({ id: x.id, name: x.name, severity: x.severity }));
    const birthDate = birthInfo ? {
      year: birthInfo.year, month: birthInfo.month, day: birthInfo.day,
      time: birthInfo.time, gender: birthInfo.gender,
    } : undefined;
    await homeAI.start(({ onDelta, onMeta, signal }) => requestFengshuiInterpretStream({
      dimension, stars, mingGua: { num: mingGuaNum, name: mingGuaInfo.name, group: mingGuaInfo.group, dir: mingGuaInfo.dir },
      bazhai, bazi, xingSha, year, birthDate,
    }, { onDelta, onMeta, signal }));
  }, [starLayout, bazhaiLayout, baziLink, hitXingSha, mingGuaNum, mingGuaInfo, year, homeAI, birthInfo]);

  // 请求八宅明镜 AI 综合解读（流式）
  const fetchBazhaiAI = useCallback(async () => {
    const bazhai = bazhaiLayout.map((b) => ({
      dir: b.dir, star: b.star, auspicious: b.attr.auspicious,
    }));
    const bazi = baziLink ? {
      dayMaster: baziLink.dayMaster, wuxing: baziLink.dayMasterWuxing,
      xi: baziLink.yongshen.xi, ji: baziLink.yongshen.ji,
    } : undefined;
    const birthDate = birthInfo ? {
      year: birthInfo.year, month: birthInfo.month, day: birthInfo.day,
      time: birthInfo.time, gender: birthInfo.gender,
    } : undefined;
    await bazhaiAI.start(({ onDelta, onMeta, signal }) => requestFengshuiInterpretStream({
      dimension: 'wealth' as FengshuiDimension, // 复用 fengshui 模块，dimension 不影响八宅解读
      stars: [], // 八宅解读不依赖九宫飞星
      mingGua: { num: mingGuaNum, name: mingGuaInfo.name, group: mingGuaInfo.group, dir: mingGuaInfo.dir },
      bazhai, bazi, year, birthDate,
    }, { onDelta, onMeta, signal }));
  }, [bazhaiLayout, baziLink, mingGuaNum, mingGuaInfo, year, bazhaiAI, birthInfo]);

  // 维度切换时自动请求 AI（家居风水 Tab）
  useEffect(() => {
    if (mode === 'home') {
      fetchHomeAI(dim);
    }
  }, [dim, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换到八宅明镜 Tab 时自动请求 AI
  useEffect(() => {
    if (mode === 'bazhai' && bazhaiAI.state === 'idle') {
      fetchBazhaiAI();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 择日引擎
  const luckyDates = useMemo(() => {
    const start = new Date();
    return findLuckyDates(start, 90, dateCat);
  }, [dateCat]);

  // 今日宜忌与时辰吉凶
  const todayStr = useMemo(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
  }, []);
  const shichenData = useMemo(() => getShichenJiXiong(todayStr.y, todayStr.m, todayStr.day), [todayStr]);
  const todayYiJi = useMemo(() => getDailyYiJi(todayStr.y, todayStr.m, todayStr.day), [todayStr]);

  // 喜用神→方位映射
  const xiDirs = useMemo(() => {
    if (!baziLink?.yongshen?.xi) return [];
    const wx2dir: Record<string, string[]> = {
      '金': ['正西', '西北'], '木': ['正东', '东南'], '水': ['正北'], '火': ['正南'], '土': ['东北', '西南', '中宫'],
    };
    return baziLink.yongshen.xi.flatMap((wx) => wx2dir[wx] || []);
  }, [baziLink]);

  // 格式化出生日期（含出生地区）
  const birthDateStr = birthInfo
    ? `${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日 ${birthInfo.time} · ${birthInfo.gender}${birthInfo.province ? ` · ${birthInfo.province} / ${birthInfo.city}` : ''}`
    : null;

  return (
    <div className="page active" id="page-fengshui">
      <div className="page-header">
        <div>
          <div className="page-title">🏠 居家风水</div>
          <div className="page-subtitle">九宫飞星 × 八宅明镜 · 算法驱动的家居·办公·方位布局</div>
          {birthDateStr && <div className="page-subtitle" style={{ fontSize: 13, color: 'var(--accent-cyan)' }}>📊 命主：{birthDateStr}</div>}
        </div>
      </div>

      <div className="fs-tabs-wrap">
        {TABS.map((t) => (
          <Chip key={t.k} data-tab={t.k} variant="mode" active={mode === t.k} onClick={() => setMode(t.k)}>{t.i} {t.n}</Chip>
        ))}
      </div>

      <div className="result-layout">
        <div className="result-main">

          {/* ===================== 家居风水 ===================== */}
          {mode === 'home' && (
            <>
              {/* 流年切换器 */}
              <div className="fs-year-bar">
                <span className="fs-year-label">流年飞星</span>
                <div className="fs-year-nav">
                  <button className="fs-year-btn" onClick={() => setYear((y) => y - 1)}>‹</button>
                  <span className="fs-year-val">{year}年</span>
                  <button className="fs-year-btn" onClick={() => setYear((y) => y + 1)}>›</button>
                  <button className="fs-year-reset" onClick={() => setYear(CURRENT_YEAR)}>今年</button>
                </div>
                <span className="fs-year-center">中宫：<strong style={{ color: centralStar?.color }}>{centralStar?.name}</strong></span>
              </div>

              <Compass />

              <Card variant="fs">
                <SectionTitle icon="star">{year} 九宫飞星方位图</SectionTitle>
                <div className="fs-star-grid fs-star-clickable">
                  {starLayout.map((c, i) => (
                    <div
                      key={i}
                      className={`fs-star-cell ${selStarPos === c.pos ? 'fs-star-selected' : ''}`}
                      style={{
                        '--star-color': c.star.color,
                        background: c.star.color + '12',
                        borderColor: c.star.color + '55',
                      } as React.CSSProperties}
                      onClick={() => setSelStarPos(c.pos)}
                    >
                      <div className="fs-star-pos">{c.pos}</div>
                      <div className="fs-star-name" style={{ color: c.star.color }}>{c.star.short}</div>
                      <div className="fs-star-title">{c.star.title}</div>
                      <div className={`fs-star-badge fs-star-${c.star.auspicious}`}>{c.star.auspicious}</div>
                    </div>
                  ))}
                </div>

                {/* 星曜详解卡 */}
                {selStar ? (
                  <div className="star-detail">
                    <div className="star-detail-head">
                      <span className="fs-star-big-ico" style={{ color: selStar.star.color }}>★</span>
                      <span className="star-name">{selStar.star.name}</span>
                      <Tag variant={selStar.star.auspicious === '吉' ? 'good' : selStar.star.auspicious === '凶' ? 'bad' : 'warn'}>{selStar.star.auspicious}</Tag>
                      <span className="star-detail-pos">飞临：{selStar.pos}</span>
                    </div>
                    <div className="star-detail-meta">
                      五行：<strong>{selStar.star.wuxing}</strong> ｜ 别名：{selStar.star.title} ｜ 主事：{selStar.star.meaning}
                    </div>
                    <div className="star-detail-full">{selStar.star.detail}</div>
                  </div>
                ) : (
                  <div className="star-detail-empty">👆 点击上方任意宫位，查看星曜详解与布局建议</div>
                )}

                <div className="star-intro open">
                  <p>「九宫飞星」是玄空风水的基础工具：把住宅按九宫格分为 <strong className="tc-text-primary">九个方位</strong>，每年有九颗星飞临不同宫位，<strong className="tc-text-primary">吉凶各异</strong>。</p>
                  <p><strong className="tc-text-primary">怎么看这张图：</strong>站在客厅中央，用手机指南针定出正北方向，再把图对应到你家——格子里写的是 <strong>{year}</strong> 年飞临该方位的星。</p>
                  <p><strong className="tc-text-primary">怎么用：</strong>各星落宫对应不同的传统方位说法，可点击每格查看详细解读。</p>
                </div>
              </Card>

              {/* 八字喜用跨页打通 */}
              <Card>
                <SectionTitle icon="sparkles">八字喜用 · 方位布局建议{baziLink ? '' : '（请先在卜卦页排盘获取喜用神）'}</SectionTitle>
                <div className="fs-detail-grid">
                  {birthInfo ? (
                    <>
                      <div className="fs-detail-cell">
                        <div className="fs-cell-title">{baziLink ? '日主' : '命主'}</div>
                        <div className="fs-tags-row">
                          {baziLink
                            ? <Tag variant="good">{baziLink.dayMaster}（{baziLink.dayMasterWuxing}）</Tag>
                            : <Tag variant="good">{birthInfo.year}年 · {birthInfo.gender}命</Tag>}
                        </div>
                        <div className="fs-cell-desc">出生：{birthInfo.year}年{birthInfo.month}月{birthInfo.day}日 {birthInfo.time} · 生肖：{getShengxiao(birthInfo.year, birthInfo.month, birthInfo.day)}</div>
                      </div>
                      <div className="fs-detail-cell">
                        <div className="fs-cell-title">喜用神</div>
                        <div className="fs-tags-row">
                          {baziLink
                            ? baziLink.yongshen.xi.map((v, j) => <Tag key={j} variant="good" className="tag-mr">{v}</Tag>)
                            : <Tag variant="warn">未排盘</Tag>}
                        </div>
                        <div className="fs-cell-desc">{baziLink ? `宜在 ${xiDirs.join('、')} 方位活动布置，顺应命局喜用` : '前往卜卦页排盘后自动同步喜用神方位建议'}</div>
                      </div>
                      <div className="fs-detail-cell">
                        <div className="fs-cell-title">忌神</div>
                        <div className="fs-tags-row">
                          {baziLink
                            ? baziLink.yongshen.ji.map((v, j) => <Tag key={j} variant="bad" className="tag-mr">{v}</Tag>)
                            : <Tag variant="warn">未排盘</Tag>}
                        </div>
                        <div className="fs-cell-desc">{baziLink ? '对应方位宜注意，减少该五行属性物品' : '排盘后自动显示忌神五行及注意要点'}</div>
                      </div>
                      <div className="fs-detail-cell">
                        <div className="fs-cell-title">流年财位</div>
                        <div className="fs-tags-row"><Tag variant="good" className="tag-mr">{starLayout.find((s) => s.starNum === 8)?.pos || '东北'}</Tag></div>
                        <div className="fs-cell-desc">八白财星飞临之方，宜保持整洁明亮</div>
                      </div>
                    </>
                  ) : (
                    <div className="fs-detail-cell" style={{ gridColumn: '1 / -1' }}>
                      <div className="fs-cell-desc">尚未填写出生信息。请先到 <Button variant="ghost" onClick={() => router.push('/')}>首页填写出生日期</Button> 或 <Button variant="ghost" onClick={() => router.push('/bugua')}>卜卦页排盘</Button>，系统将自动打通喜用神到风水布局。</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* AI 堪舆四维切换器 — 流式输出 */}
              <Card>
                <SectionTitle icon="compass">小玄陪你看看四维风水</SectionTitle>
                <div className="fs-dim-switcher">
                  {DIMENSIONS.map((d) => (
                    <div
                      key={d.key}
                      className={`fs-dim-card ${dim === d.key ? 'fs-dim-active' : ''}`}
                      onClick={() => setDim(d.key)}
                    >
                      <span className="fs-dim-ico">{d.icon}</span>
                      <span className="fs-dim-name">{d.name}</span>
                      <span className="fs-dim-desc">{d.desc}</span>
                    </div>
                  ))}
                </div>
                {homeAI.state === 'loading' && <OmLoading label="正在分析家居风水布局…" mode="inline" />}
                {homeAI.state === 'streaming' && (
                  <AIInterpretation>
                    <div dangerouslySetInnerHTML={{ __html: mdToHtml(homeAI.displayText) + '<span class="fs-cursor">▌</span>' }} />
                  </AIInterpretation>
                )}
                {homeAI.state === 'error' && (
                  <AIInterpretation><p>小玄暂时连接不上，先看看上方的飞星布局与八宅方位吧</p></AIInterpretation>
                )}
                {homeAI.state === 'done' && (
                  <AIInterpretation>
                    <div dangerouslySetInnerHTML={{ __html: mdToHtml(homeAI.displayText) }} />
                    {homeAI.disclaimer && <div className="fs-disclaimer">{homeAI.disclaimer}</div>}
                  </AIInterpretation>
                )}
                {homeAI.state === 'idle' && (
                  <AIInterpretation><p>小玄在认真梳理「{DIMENSIONS.find((d) => d.key === dim)?.name}」这个维度…</p></AIInterpretation>
                )}
              </Card>
            </>
          )}

          {/* ===================== 办公风水 ===================== */}
          {mode === 'office' && (
            <>
              <Card>
                <SectionTitle icon="building">办公风水 · 核心建议</SectionTitle>
                <div className="fs-detail-grid">
                  <div className="fs-detail-cell">
                    <div className="fs-cell-title">座位朝向</div>
                    <div className="fs-tags-row">
                      {baziLink ? (
                        <Tag variant="good">{xiDirs.slice(0, 2).join(' / ')}</Tag>
                      ) : <Tag variant="good">{mingGuaInfo.dir}方（命卦吉方）</Tag>}
                    </div>
                    <div className="fs-cell-desc">背靠实墙、面朝门窗，避开直冲走廊{baziLink ? '（基于八字喜用方位）' : '（基于命卦方位）'}</div>
                  </div>
                  <div className="fs-detail-cell">
                    <div className="fs-cell-title">桌面五行</div>
                    <div className="fs-tags-row">
                      {baziLink ? baziLink.yongshen.xi.map((v, j) => <Tag key={j} variant="good" className="tag-mr">{v}</Tag>) : <Tag variant="good">{mingGuaInfo.wuxing}行</Tag>}
                    </div>
                    <div className="fs-cell-desc">{baziLink ? '按喜用神配色' : '按命卦五行配色'}，补足命局所需五行</div>
                  </div>
                  <div className="fs-detail-cell">
                    <div className="fs-cell-title">办公财位</div>
                    <div className="fs-tags-row"><Tag variant="good">{starLayout.find((s) => s.starNum === 8)?.pos || '东北'}（八白）</Tag></div>
                    <div className="fs-cell-desc">办公室该方位放黄水晶或聚宝盆</div>
                  </div>
                  <div className="fs-detail-cell">
                    <div className="fs-cell-title">避煞要点</div>
                    <div className="fs-tags-row">
                      {starLayout.filter((s) => s.star.auspicious === '凶').map((s, j) => <Tag key={j} variant="bad" className="tag-mr">{s.pos}（{s.star.short}）</Tag>)}
                    </div>
                    <div className="fs-cell-desc">凶星飞临之方忌做主位，减少活动</div>
                  </div>
                </div>
              </Card>
              <Card>
                <SectionTitle icon="grid">办公室分区布局（{year}年飞星）</SectionTitle>
                <div className="fs-detail-grid">
                  {starLayout.filter((s) => s.pos !== '中宫').slice(0, 4).map((s, i) => (
                    <div key={i} className="room-card">
                      <div className="fs-room-head">
                        <div className="fs-room-ico">{s.star.auspicious === '吉' ? '✨' : s.star.auspicious === '凶' ? '⚠️' : '🔹'}</div>
                        <div className="fs-room-name">{s.pos}方</div>
                        <span className="room-tag" style={{ color: s.star.color }}>{s.star.short}·{s.star.auspicious}</span>
                      </div>
                      <div className="fs-room-desc">{s.star.meaning}。{s.star.auspicious === '吉' ? '宜做工位或会客区' : '宜静不宜动，忌做主位'}</div>
                    </div>
                  ))}
                </div>
              </Card>
              <AIInterpretation>
                <p><strong>{year}年办公风水总诀：</strong>今年中宫飞临<strong style={{ color: centralStar?.color }}>{centralStar?.name}</strong>，{centralStar?.meaning}。财星在{starLayout.find((s) => s.starNum === 8)?.pos}，办公桌若能面朝该方最佳。{baziLink ? `命局喜${baziLink.yongshen.xi.join('、')}，桌面宜用对应五行配色。` : birthInfo ? `命主${birthInfo.year}年${birthInfo.gender}命，命卦${mingGuaInfo.name}（${mingGuaInfo.wuxing}行）。` : ''}凶星方位宜静守化煞。</p>
              </AIInterpretation>
            </>
          )}

          {/* ===================== 择日择时 ===================== */}
          {mode === 'date' && (
            <>
              <Card>
                <SectionTitle icon="check-double">{todayYiJi.gan}{todayYiJi.zhi}日 · 今日宜忌</SectionTitle>
                <div className="fs-today-banner">
                  <div className="fs-today-date">
                    <div className="fs-today-gan">{todayYiJi.gan}{todayYiJi.zhi}</div>
                    <div className="fs-today-jc">建除：{todayYiJi.jianchu}（{todayYiJi.auspicious}）</div>
                  </div>
                  <div className="fs-today-yiji">
                    <div className="fs-yi-row"><span className="fs-yi-label">宜：</span><span className="fs-yi-text">{todayYiJi.yi.join('、')}</span></div>
                    <div className="fs-ji-row"><span className="fs-ji-label">忌：</span><span className="fs-ji-text">{todayYiJi.ji.join('、')}</span></div>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionTitle icon="calendar">择日引擎 · 分类筛选吉日</SectionTitle>
                <div className="fs-cat-filter">
                  {DATE_CATEGORIES.map((c) => (
                    <button
                      key={c.k}
                      className={`fs-cat-btn ${dateCat === c.k ? 'fs-cat-active' : ''}`}
                      onClick={() => setDateCat(c.k)}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
                <div className="fs-col-list">
                  {luckyDates.length === 0 ? (
                    <div className="fs-date-empty">近期 90 天内暂无匹配「{DATE_CATEGORIES.find((c) => c.k === dateCat)?.name}」的吉日，请换一个分类试试。</div>
                  ) : (
                    luckyDates.map((d, i) => (
                      <div key={i} className="fs-date-row">
                        <div className="fs-date-meta">
                          <div className="fs-date-name">{d.date.getFullYear()}-{String(d.date.getMonth() + 1).padStart(2, '0')}-{String(d.date.getDate()).padStart(2, '0')}</div>
                          <div className="fs-date-tag">{d.gan}{d.zhi}日 · {d.jianchu}</div>
                        </div>
                        <div className="fs-date-body">
                          <div className="fs-yi-row"><span className="fs-yi-label">宜：</span><span className="fs-yi-text">{d.yi.join('、')}</span></div>
                          <div className="fs-ji-row"><span className="fs-ji-label">忌：</span><span className="fs-ji-text">{d.ji.join('、')}</span></div>
                          <div className="fs-date-match">✅ 匹配：{d.matched.join('、')}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card>
                <SectionTitle icon="clock">今日时辰吉凶（{todayYiJi.gan}{todayYiJi.zhi}日干推算）</SectionTitle>
                <div className="fs-slot-grid">
                  {shichenData.map((s, i) => (
                    <div key={i} className="fs-slot-cell">
                      <div className="fs-slot-head">
                        <span className="fs-slot-name">{s.time} {s.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.level}</span>
                      </div>
                      <Progress percent={s.score} color={s.color} height={6} />
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* ===================== 八宅明镜 ===================== */}
          {mode === 'bazhai' && (
            <>
              <Card>
                <SectionTitle icon="home">八宅明镜 · 命卦推算</SectionTitle>
                <div className="fs-bazhai-ming">
                  <div className="fs-bazhai-gua-big" style={{ color: 'var(--accent-gold)' }}>
                    <span className="fs-bazhai-trigram">{mingGuaInfo.trigram}</span>
                    <span className="fs-bazhai-name">{mingGuaInfo.name}卦</span>
                  </div>
                  <div className="fs-bazhai-info">
                    <div className="fs-cell-title">命卦推算结果</div>
                    <div className="fs-bazhai-tags">
                      <Tag variant="good">{mingGuaInfo.group}</Tag>
                      <Tag variant="warn">{mingGuaInfo.dir}方 · {mingGuaInfo.wuxing}行</Tag>
                      {birthInfo && <Tag variant="warn">{birthInfo.year}年{birthInfo.gender}命</Tag>}
                    </div>
                    <div className="fs-cell-desc">{mingGuaInfo.desc}</div>
                  </div>
                </div>
                <div className="fs-bazhai-note">
                  <strong>命卦公式：</strong>男命 = (11 - 年份末位) 取九余数，遇5寄坤(2)；女命与男命互补，遇5寄艮(8)。<br/>
                  <strong>东四命</strong>（坎/震/巽/离）吉方在东、东南、南、北；<strong>西四命</strong>（乾/坤/艮/兑）吉方在西北、西、东北、西南。
                </div>
              </Card>

              <Card>
                <SectionTitle icon="navigation">八方吉凶布局（大游年）</SectionTitle>
                <div className="fs-bazhai-grid">
                  {bazhaiLayout.map((b, i) => (
                    <div
                      key={i}
                      className={`fs-bazhai-cell fs-bazhai-${b.attr.auspicious}`}
                      style={{ borderColor: b.attr.color + '66', background: b.attr.color + '0a' }}
                    >
                      <div className="fs-bazhai-dir">{b.dir}</div>
                      <div className="fs-bazhai-star" style={{ color: b.attr.color }}>{b.star}</div>
                      <div className={`fs-bazhai-level fs-bazhai-${b.attr.auspicious}`}>{b.attr.level}</div>
                      <div className="fs-bazhai-meaning">{b.attr.meaning}</div>
                      <div className="fs-bazhai-advice">{b.attr.advice}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 吉凶方位热力图 */}
              <Card>
                <SectionTitle icon="thermometer">吉凶热力图</SectionTitle>
                <div className="fs-heatmap">
                  {bazhaiLayout.map((b, i) => (
                    <div key={i} className="fs-heat-row">
                      <span className="fs-heat-dir">{b.dir}</span>
                      <div className="fs-heat-bar">
                        <div
                          className="fs-heat-fill"
                          style={{
                            width: b.attr.auspicious === '吉' ? '85%' : b.attr.auspicious === '凶' ? '20%' : '50%',
                            background: b.attr.color,
                          }}
                        />
                      </div>
                      <span className="fs-heat-label" style={{ color: b.attr.color }}>{b.star}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* AI 八宅综合解读 — 流式输出 */}
              <Card>
                <SectionTitle icon="bot">小玄陪你聊聊八宅明镜</SectionTitle>
                {bazhaiAI.state === 'loading' && <OmLoading label="正在分析八宅明镜方位…" mode="inline" />}
                {bazhaiAI.state === 'streaming' && (
                  <AIInterpretation>
                    <div dangerouslySetInnerHTML={{ __html: mdToHtml(bazhaiAI.displayText) + '<span class="fs-cursor">▌</span>' }} />
                  </AIInterpretation>
                )}
                {bazhaiAI.state === 'error' && (
                  <AIInterpretation><p>小玄暂时连接不上，先看看上方的八宅方位布局</p></AIInterpretation>
                )}
                {bazhaiAI.state === 'done' && (
                  <AIInterpretation>
                    <div dangerouslySetInnerHTML={{ __html: mdToHtml(bazhaiAI.displayText) }} />
                    {bazhaiAI.disclaimer && <div className="fs-disclaimer">{bazhaiAI.disclaimer}</div>}
                  </AIInterpretation>
                )}
                {bazhaiAI.state === 'idle' && (
                  <AIInterpretation><p>小玄在认真梳理八宅明镜的综合解读…</p></AIInterpretation>
                )}
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <Button variant="ghost" onClick={() => { bazhaiAI.reset(); fetchBazhaiAI(); }}>🔄 重新生成</Button>
                </div>
              </Card>
            </>
          )}

          {/* ===================== 形煞自查 ===================== */}
          {mode === 'xingsha' && (
            <>
              <Card>
                <SectionTitle icon="alert-triangle">形煞自查 · 10类高频煞</SectionTitle>
                <div className="fs-xingsha-intro">
                  勾选你住宅/办公室存在的煞形，系统将展示对应方位的传统说法。
                </div>
                <div className="fs-xingsha-list">
                  {XING_SHA_LIST.map((sha) => {
                    const hasAny = sha.checklist.some((_, j) => xingshaChecked.has(`${sha.id}-${j}`));
                    const allChecked = sha.checklist.every((_, j) => xingshaChecked.has(`${sha.id}-${j}`));
                    return (
                    <div key={sha.id} className={`fs-xingsha-card ${hasAny ? 'fs-xingsha-hit' : ''}`}>
                      <div className="fs-xingsha-head" onClick={() => {
                        setXingshaChecked((s) => {
                          const ns = new Set(s);
                          sha.checklist.forEach((_, j) => {
                            const key = `${sha.id}-${j}`;
                            if (allChecked) ns.delete(key); else ns.add(key);
                          });
                          return ns;
                        });
                      }}>
                        <span className="fs-xingsha-check" style={{ color: hasAny ? '#4ade80' : 'var(--text-muted)' }}>
                          {hasAny ? '☑' : '☐'}
                        </span>
                        <span className="fs-xingsha-ico">{sha.icon}</span>
                        <span className="fs-xingsha-name">{sha.name}</span>
                        <span className={`fs-xingsha-sev fs-sev-${sha.severity}`}>{sha.severity}</span>
                      </div>
                      <div className="fs-xingsha-checklist">
                        {sha.checklist.map((c, j) => (
                          <label key={j} className="fs-checklist-item form-check">
                            <input
                              type="checkbox"
                              checked={xingshaChecked.has(`${sha.id}-${j}`)}
                              onChange={() => {
                                setXingshaChecked((s) => {
                                  const ns = new Set(s);
                                  const key = `${sha.id}-${j}`;
                                  if (ns.has(key)) ns.delete(key); else ns.add(key);
                                  return ns;
                                });
                              }}
                            />
                            {c}
                          </label>
                        ))}
                      </div>
                      <div className="fs-xingsha-effect">影响：{sha.effect}</div>

                    </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </div>

        {/* ===================== 侧栏 ===================== */}
        <div className="result-sidebar">
          <Card variant="side">
            <SectionTitle icon="compass">方位常识</SectionTitle>
            <div className="fs-col-list">
              {mode === 'date' ? (
                <>
                  <div className="fs-goods-row"><span className="fs-goods-ico">🏠</span><div className="fs-goods-body"><div className="fs-goods-title">搬家入宅</div><div className="fs-goods-note">选水旺吉日，进门先开灯、烧水</div></div></div>
                  <div className="fs-goods-row"><span className="fs-goods-ico">✍️</span><div className="fs-goods-body"><div className="fs-goods-title">签约谈判</div><div className="fs-goods-note">宜申酉时，坐西朝东更有利</div></div></div>
                  <div className="fs-goods-row"><span className="fs-goods-ico">🔨</span><div className="fs-goods-body"><div className="fs-goods-title">装修动土</div><div className="fs-goods-note">避开五黄、二黑方与午未月</div></div></div>
                </>
              ) : (
                <div className="fs-goods-row"><span className="fs-goods-ico">🧭</span><div className="fs-goods-body"><div className="fs-goods-title">方位常识</div><div className="fs-goods-note">方位吉凶属传统环境文化认知，仅供了解，不构成任何操作建议</div></div></div>
              )}
            </div>
          </Card>

          <CrossPageLink
            links={[
              { icon: '☯️', label: '查看八字喜忌', href: '/bugua' },
              { icon: '🔢', label: '数字方位', href: '/numerology' },
              { icon: '📋', label: '生成综合报告', href: '/report', variant: 'primary' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/** Markdown 渲染统一走 @/lib/markdown 的 mdToHtml（含 sanitizeAiText + XSS 转义 + 标题/列表/引用/表格），故删除本页自写的 renderMarkdown。 */
