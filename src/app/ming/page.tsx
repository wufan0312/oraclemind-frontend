'use client';

import '@/styles/ming.scss';
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { calculateBazi, type BaziAPIResult, type MingAgentBirthHint } from '@/lib/api';
import {
  analyzeCezi,
  analyzeXingming,
  analyzeHehun,
  analyzeNameDetail,
  generateNames,
  generatePoetryNames,
  generateTwinNames,
  lookupCharDict,
  charStroke,
  baziWuxing,
  scoreNameCandidate,
  nameDuplicationRate,
  type CeziResult,
  type XingmingResult,
  type HehunResult,
  type NameCandidate,
  type PoetryNameCandidate,
  type TwinNamePair,
  type NameDetailResult,
  type CharDictResult,
  type BaziWuxing,
  type NameScore,
  type DupRateResult,
} from '@/lib/ceming';
import { track } from '@/lib/track';
import { storage } from '@/lib/storage';
import {
  CEZI_TOPICS,
  FIVE_ELEMENTS,
  DZHI_TO_ZODIAC,
  type Element,
} from '@/data/cemingData';
import { NAME_STYLES, NAME_CHARS } from '@/data/cemingNameData';
import { charToPinyin } from '@/data/pinyinData';
/** M29：复用风水页的择日引擎，在合婚结果里直接给出嫁娶吉日 */
import { findLuckyDates } from '@/data/fengshuiData';
import CrossPageLink from '@/components/ui/CrossPageLink';
import SectionIcon from '@/components/ui/SectionIcon';
import { DatePicker } from '@/components/ui/DateTimePicker';
import OmLoading from '@/components/ui/OmLoading';
import Modal from '@/components/ui/Modal';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import {
  MingAIPanel,
  MingPageChat,
  MingActions,
  MingHistoryModal,
  useMingHistory,
  useMingPersist,
  useMingFavorites,
  type MingFavName,
  writeMingUrl,
  readMingUrl,
  buildCeziReport,
  buildNameReport,
  buildHehunReport,
  buildQimingReport,
  buildZidianReport,
  MING_DISCLAIMER,
  type MingTab,
  type MingPanelProps,
} from './shared';

const DISCLAIMER = MING_DISCLAIMER;

const JI_COLOR: Record<string, string> = {
  吉: 'var(--accent-green, #4ade80)',
  半吉: 'var(--accent-cyan, #5ce1e6)',
  凶: 'var(--danger, #ff6b6b)',
};

const SHICHEN = [
  '子时', '丑时', '寅时', '卯时', '辰时', '巳时',
  '午时', '未时', '申时', '酉时', '戌时', '亥时', '不详',
];

/** 五行 -> 主色（用于色环 / 小圆点高亮） */
const ELEMENT_COLOR: Record<Element, string> = {
  金: 'var(--accent-gold, #d4a853)',
  木: 'var(--accent-green, #4ade80)',
  水: 'var(--accent-cyan, #5ce1e6)',
  火: 'var(--danger, #ff6b6b)',
  土: 'var(--warn, #ff8e53)',
};

/** 八卦符号（用于页面装饰背景与卦象图示） */
const BAGUA_SYMBOLS = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];

/** 防连点冷却：「换一批」与 tarot 重抽一致，避免接口/计算被短时间打爆 */
const RESHUFFLE_COOLDOWN_MS = 800;

/* ============================================================================
 * 起名增强（M12 随机池 / M22 筛选 / M25 收藏 / M26 对比）共用组件与工具
 * ==========================================================================*/
type NameFilterType = 'all' | 'single' | 'double';

/** M12：随机字池（测字 / 字典「换一个字」用，避开当前字） */
const RESHUFFLE_POOL = ['福','安','梦','瑞','涵','梓','欣','宇','泽','宁','悦','朗','睿','桐','萱','辰','卿','墨','屿','笙','嘉','熙','瑾','霖'];
function pickRandomChar(exclude?: string): string {
  const pool = RESHUFFLE_POOL;
  let c = pool[Math.floor(Math.random() * pool.length)];
  if (exclude && c === exclude) c = pool[(pool.indexOf(c) + 1) % pool.length];
  return c;
}
/** M12：姓名「换一组示例」——随机取一条示例参数直接跑 */
function pickRandomSample(items: SampleItem[]): SampleItem {
  return items[Math.floor(Math.random() * items.length)];
}

/** M22：按单/双字 + 五行过滤候选名（poetry 无五行信息，hasEl=false 时忽略五行）
 * 注意：NameCandidate.chars 是 `{char, meaning, element}[]`，
 * 而 PoetryNameCandidate.chars 是 `string[]` —— 两者结构不同，
 * 所以这里不把 chars 写进泛型约束，改为运行时安全提取 element。 */
function filterNameList<T extends { given: string }>(
  list: T[],
  type: NameFilterType,
  el: Element | 'all',
  hasEl: boolean,
): T[] {
  return list.filter((n) => {
    if (type === 'single' && n.given.length !== 1) return false;
    if (type === 'double' && n.given.length !== 2) return false;
    if (hasEl && el !== 'all') {
      const raw = (n as { chars?: unknown }).chars;
      const els: Element[] = Array.isArray(raw)
        ? raw
            .map((c) =>
              c && typeof c === 'object' && 'element' in c
                ? (c as { element?: unknown }).element
                : undefined,
            )
            .filter((e): e is Element => typeof e === 'string')
        : [];
      if (!els.includes(el)) return false;
    }
    return true;
  });
}

/** M22 筛选条：单/双字 + 五行（五行仅对有五行信息的风格/生肖模式展示） */
function NameFilterBar({
  type, el, hasEl, onType, onEl,
}: {
  type: NameFilterType;
  el: Element | 'all';
  hasEl: boolean;
  onType: (t: NameFilterType) => void;
  onEl: (e: Element | 'all') => void;
}) {
  return (
    <div className="ming-filter-bar">
      <div className="ming-filter-group">
        {(['all','single','double'] as const).map((t) => (
          <button key={t} type="button" className={'ming-filter-chip' + (type === t ? ' active' : '')} onClick={() => onType(t)}>
            {t === 'all' ? '全部' : t === 'single' ? '单字' : '双字'}
          </button>
        ))}
      </div>
      {hasEl && (
        <div className="ming-filter-group">
          <button type="button" className={'ming-filter-chip' + (el === 'all' ? ' active' : '')} onClick={() => onEl('all')}>不限五行</button>
          {FIVE_ELEMENTS.map((e) => (
            <button
              key={e}
              type="button"
              className={'ming-filter-chip' + (el === e ? ' active' : '')}
              style={{ color: el === e ? ELEMENT_COLOR[e] : undefined }}
              onClick={() => onEl(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** M28：结果区二级分组 —— 统一子模块卡片（对标 bugua 七术数模块分组）。
 * 姓名「五格/三才/详批/宜忌」、测字「字形字义/延伸/文化/宜忌/运势」都包一层带序号的小标题卡。 */
function MingSection({
  idx, title, children,
}: {
  idx?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ming-section">
      <div className="ming-section-head">
        {idx && <span className="ming-section-idx">{idx}</span>}
        <span className="ming-section-title">{title}</span>
      </div>
      <div className="ming-section-body">{children}</div>
    </section>
  );
}

/** M25/M26：候选名卡片外壳，统一封装拼音、收藏 ♡、对比 ☑、测名跳转 */
function NameCard({
  full, given, surname, gender, isFav, onToggleFav,
  inCompare, onToggleCompare, compareDisabled, onJump, className, children, score,
}: {
  full: string; given: string; surname: string; gender: string;
  isFav: boolean; onToggleFav: () => void;
  inCompare: boolean; onToggleCompare: () => void; compareDisabled: boolean;
  onJump: (tab: MingTab, params: Record<string, string>) => void;
  className?: string; children: ReactNode;
  score?: NameScore;
}) {
  const py = [...full].map((c) => charToPinyin(c)).filter(Boolean).join(' ');
  return (
    <div className={'ming-name-card' + (isFav ? ' is-fav' : '') + (className ? ' ' + className : '')}>
      <div className="ming-name-head">
        <div className="ming-name-full">{full}</div>
        {score && (
          <div className="ming-name-score" title={`五格${score.grids} · 三才${score.threeTalent} · 音律${score.phonetic} · 字形${score.form} · 字义${score.meaning} · 五行${score.wuxing}`}>
            <span className="ming-name-score-num">{score.total}</span>
            <span className="ming-name-score-unit">分</span>
          </div>
        )}
        <button type="button" className="ming-name-fav" aria-label={isFav ? '取消收藏' : '收藏'} onClick={onToggleFav}>
          {isFav ? '♥' : '♡'}
        </button>
      </div>
      <div className="ming-name-py">{py}</div>
      {children}
      <div className="ming-name-foot">
        <label className="ming-name-cmp">
          <input type="checkbox" checked={inCompare} disabled={compareDisabled} onChange={onToggleCompare} /> 对比
        </label>
        <button type="button" className="ming-name-test" onClick={() => onJump('name', { s: surname, g: given, gd: gender })}>
          测这个名字 →
        </button>
      </div>
    </div>
  );
}

/** 候选名对比条目（M26）：选中时快照当前名数据，避免换一批后错位 */
interface CompareName {
  full: string;
  given: string;
  surname: string;
  gender: string;
  mode: string;
  py: string;
  elements: Element[];
  detail: string;
  /** 综合打分（对比时异步计算） */
  score?: NameScore;
}

/** M25：我的收藏弹层 */
function MingFavoritesModal({
  open, onClose, favs, onClear, onApply,
}: {
  open: boolean;
  onClose: () => void;
  favs: MingFavName[];
  onClear: () => void;
  /** 直接把该收藏的姓氏 / 性别 / 模式应用到当前起名表单并重排。
   * 不走跨 Tab 跳转：弹层只在起名 Tab 内可达，`setTab` 到同 Tab 是空操作，
   * 面板的恢复 effect 又受 restoredRef 保护不会重跑，跳转会静默失效。 */
  onApply: (f: MingFavName) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} icon="♥" title={`我的收藏（${favs.length}）`}>
      {favs.length === 0 ? (
        <div className="ming-history-empty">还没有收藏的名字，点名字卡片上的 ♡ 即可收藏。</div>
      ) : (
        <div className="ming-fav-list">
          {favs.map((f) => (
            <div className="ming-fav-item" key={f.full + f.mode}>
              <div className="ming-fav-main">
                <span className="ming-fav-name">{f.full}</span>
                <span className="ming-fav-meta">
                  {f.py} · {f.gender} · {f.mode === 'style' ? '风格' : f.mode === 'poetry' ? '诗词' : f.mode === 'dict' ? '字典' : '生肖'}
                </span>
              </div>
              <div className="ming-fav-ops">
                <button type="button" className="ming-action-btn" onClick={() => navigator.clipboard.writeText(f.full).catch(() => {})}>
                  复制
                </button>
                <button
                  type="button"
                  className="ming-action-btn"
                  onClick={() => {
                    onApply(f);
                    onClose();
                  }}
                >
                  按此重排
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {favs.length > 0 && (
        <div className="ming-history-footer">
          <button type="button" className="ming-action-btn" onClick={onClear}>
            清空收藏
          </button>
        </div>
      )}
    </Modal>
  );
}

/** M26：多名字横向对比弹层 */
function MingCompareModal({
  open, onClose, items,
}: {
  open: boolean;
  onClose: () => void;
  items: CompareName[];
}) {
  return (
    <Modal open={open} onClose={onClose} icon="⚖️" title={`名字对比（${items.length}）`}>
      {items.length < 2 ? (
        <div className="ming-history-empty">至少选择 2 个名字（最多 3 个）进行对比。</div>
      ) : (
        <div className="ming-compare">
          <div className="ming-compare-scroll">
            <table className="ming-compare-table">
              <thead>
                <tr>
                  <th>维度</th>
                  {items.map((n) => (
                    <th key={n.full}>{n.full}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>拼音</td>
                  {items.map((n) => (
                    <td key={n.full}>{n.py}</td>
                  ))}
                </tr>
                <tr>
                  <td>五行</td>
                  {items.map((n) => (
                    <td key={n.full}>
                      {n.elements.length === 0 ? (
                        <span className="ming-badge muted">—</span>
                      ) : (
                        n.elements.map((e) => (
                          <span className="ming-badge" key={e} style={{ color: ELEMENT_COLOR[e] }}>
                            {e}
                          </span>
                        ))
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>综合评分</td>
                  {items.map((n) => (
                    <td key={n.full}>
                      {n.score ? (
                        <span className="ming-badge" style={{ color: 'var(--accent-gold, #d4a853)', fontSize: '15px', fontWeight: 700 }}>{n.score.total}分</span>
                      ) : (
                        <span className="ming-badge muted">计算中…</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>五格数理</td>
                  {items.map((n) => (
                    <td key={n.full}>
                      {n.score ? <span style={{ color: JI_COLOR[n.score.grids >= 80 ? '吉' : n.score.grids >= 60 ? '半吉' : '凶'] }}>{n.score.grids}分</span> : <span className="ming-badge muted">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>三才配置</td>
                  {items.map((n) => (
                    <td key={n.full}>
                      {n.score ? <span style={{ color: JI_COLOR[n.score.threeTalent >= 90 ? '吉' : n.score.threeTalent >= 80 ? '半吉' : '凶'] }}>{n.score.threeTalent}分</span> : <span className="ming-badge muted">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>音律</td>
                  {items.map((n) => (
                    <td key={n.full}>
                      {n.score ? <span style={{ color: JI_COLOR[n.score.phonetic >= 80 ? '吉' : n.score.phonetic >= 65 ? '半吉' : '凶'] }}>{n.score.phonetic}分</span> : <span className="ming-badge muted">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>字形</td>
                  {items.map((n) => (
                    <td key={n.full}>
                      {n.score ? <span style={{ color: JI_COLOR[n.score.form >= 80 ? '吉' : n.score.form >= 65 ? '半吉' : '凶'] }}>{n.score.form}分</span> : <span className="ming-badge muted">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>字义</td>
                  {items.map((n) => (
                    <td key={n.full}>
                      {n.score ? <span style={{ color: JI_COLOR[n.score.meaning >= 80 ? '吉' : n.score.meaning >= 65 ? '半吉' : '凶'] }}>{n.score.meaning}分</span> : <span className="ming-badge muted">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>五行匹配</td>
                  {items.map((n) => (
                    <td key={n.full}>
                      {n.score ? <span style={{ color: JI_COLOR[n.score.wuxing >= 80 ? '吉' : n.score.wuxing >= 65 ? '半吉' : '凶'] }}>{n.score.wuxing}分</span> : <span className="ming-badge muted">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>解析</td>
                  {items.map((n) => (
                    <td key={n.full} className="ming-compare-detail">
                      {n.detail}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================================
 * 一键示例：新用户面对空表单不知道该输什么，给 2-3 个可直接点的样例
 * ==========================================================================*/
interface SampleItem {
  label: string;
  params: Record<string, string>;
}
const CEZI_SAMPLES: SampleItem[] = [
  { label: '福', params: { c: '福' } },
  { label: '安', params: { c: '安' } },
  { label: '梦', params: { c: '梦' } },
];
const NAME_SAMPLES: SampleItem[] = [
  { label: '王伟', params: { s: '王', g: '伟', gd: '男' } },
  { label: '李静', params: { s: '李', g: '静', gd: '女' } },
  { label: '陈昊', params: { s: '陈', g: '昊', gd: '男' } },
];
const QIMING_SAMPLES: SampleItem[] = [
  { label: '王 · 诗意男孩', params: { s: '王', g: '男', m: 'style', k: 'poetic' } },
  { label: '李 · 诗经女孩', params: { s: '李', g: '女', m: 'poetry', ps: '诗经' } },
  { label: '陈 · 属龙男孩', params: { s: '陈', g: '男', m: 'zodiac', z: '龙' } },
];
const ZIDIAN_SAMPLES: SampleItem[] = [
  { label: '瑞', params: { c: '瑞' } },
  { label: '涵', params: { c: '涵' } },
  { label: '梓', params: { c: '梓' } },
];
const HEHUN_SAMPLES: SampleItem[] = [
  { label: '示例 · 95 后情侣', params: { md: '1995-08-12', ms: '辰时', fd: '1996-03-05', fs: '午时' } },
  { label: '示例 · 90 后伴侣', params: { md: '1992-11-20', ms: '酉时', fd: '1993-06-18', fs: '未时' } },
];

/** 「试试：」样例行（对标 numerology 的 num-samples-row） */
function SamplesRow({ items, onPick }: { items: SampleItem[]; onPick: (p: Record<string, string>) => void }) {
  return (
    <div className="ming-samples-row">
      <span className="ming-sample-label">试试：</span>
      {items.map((it) => (
        <button type="button" className="ming-sample" key={it.label} onClick={() => onPick(it.params)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================================
 * 基础工具：Markdown -> HTML（处理 **加粗** / *斜体* / # 标题 / - 列表 / > 引用 / 换行）
 * ==========================================================================*/
/** 由汉字码点推导五行（与 ceming 算法一致） */
function elementOf(ch: string): Element {
  const code = ch.codePointAt(0)!;
  return FIVE_ELEMENTS[code % 5];
}

/** 从同五行用字库中取 N 个推荐字（排除当前字） */
function pickSameElementChars(el: Element, exclude: string, n = 3): { char: string; meaning: string }[] {
  return NAME_CHARS[el]
    .filter((c) => c.char !== exclude)
    .slice(0, n)
    .map((c) => ({ char: c.char, meaning: c.meaning }));
}

/* 历史记录 Hook 与 AI 解读面板已抽到 ./shared：
 * - 历史覆盖全部 5 个 Tab、带 schema 版本校验、支持单删/清空/回放
 * - AI 面板支持「换个说法」重试、失败重试、结果缓存（切 Tab 不重跑）、追问 */

/* ============================================================================
 * 引导卡片：页面顶部展示模块介绍与使用提示
 * ==========================================================================*/
function IntroCard() {
  return (
    <div className="ming-intro-card">
      <div className="ming-intro-head">
        <span className="ming-intro-glyph">🔮</span>
        <div>
          <div className="ming-intro-title">玄镜 · 测字起名一站式推演</div>
          <div className="ming-intro-sub">
            融汇五行八卦与典籍诗赋，单字取象 · 五格测名 · 智能起名 · 八字合婚，一键获取 AI 文化解读。
          </div>
        </div>
      </div>
      <div className="ming-intro-tips">
        <span className="ming-badge">测字：单字取象</span>
        <span className="ming-badge">姓名：五格数理</span>
        <span className="ming-badge">起名：风格 / 诗词 / 生肖</span>
        <span className="ming-badge">合婚：八字配对</span>
        <span className="ming-badge">字典：字义五行</span>
      </div>
    </div>
  );
}

/* ============================================================================
 * 缘分雷达图：SVG 五角雷达，5 轴对应 感情 / 事业 / 财运 / 健康 / 总分
 * ==========================================================================*/
function RadarChart({ axes, values, size = 220 }: { axes: string[]; values: number[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;
  const n = axes.length;
  const point = (i: number, radius: number): [number, number] => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  };
  const rings = [0.25, 0.5, 0.75, 1];
  const dataPts = values
    .map((v, i) => point(i, (Math.max(0, Math.min(100, v)) / 100) * r).join(','))
    .join(' ');
  return (
    <svg className="ming-radar" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="缘分雷达图">
      {rings.map((p, idx) => (
        <polygon
          key={idx}
          points={Array.from({ length: n }, (_, i) => point(i, r * p).join(',')).join(' ')}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
          opacity={0.55}
        />
      ))}
      {axes.map((label, i) => {
        const [x, y] = point(i, r);
        const [lx, ly] = point(i, r + 16);
        return (
          <g key={label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} opacity={0.55} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="var(--text-secondary)">
              {label}
            </text>
          </g>
        );
      })}
      <polygon points={dataPts} fill="rgba(124,92,255,0.18)" stroke="var(--primary)" strokeWidth={2} />
      {values.map((v, i) => {
        const [x, y] = point(i, (Math.max(0, Math.min(100, v)) / 100) * r);
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--primary-light, #a78bfa)" />;
      })}
    </svg>
  );
}

function ScoreBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="ming-score-bar">
      <div
        className="ming-score-fill"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? 'linear-gradient(90deg, var(--primary), var(--accent-cyan))' }}
      />
    </div>
  );
}

/* ============================================================================
 * 生肖起名 · 生肖宜用字根表 + 禁忌字根
 * ==========================================================================*/
interface ZodiacFavor {
  zodiac: string;
  radicals: string;
  desc: string;
  chars: { char: string; meaning: string }[];
  /** 禁忌字根：犯冲/害/刑的字根，起名应避开 */
  forbidden: string;
  /** 禁忌说明 */
  forbiddenDesc: string;
}
const ZODIAC_FAVOR: ZodiacFavor[] = [
  { zodiac: '鼠', radicals: '宀 / 米 / 禾 / 豆 / 王', desc: '鼠喜穴居覆护，宜「宀」部；喜食五谷，宜「禾米豆」；位列肖首，宜「王」字根。', chars: [{ char: '宇', meaning: '屋宇覆护' }, { char: '安', meaning: '安宁安居' }, { char: '粟', meaning: '丰食有余' }, { char: '瑾', meaning: '美玉如王' }, { char: '宏', meaning: '宏图大展' }, { char: '粱', meaning: '五谷丰登' }], forbidden: '马 / 火 / 羊', forbiddenDesc: '子午相冲忌「马」；子未相害忌「羊」；鼠忌火，避「火」旁。' },
  { zodiac: '牛', radicals: '宀 / 冖 / 氵 / 禾 / 鸟', desc: '牛耐劳作，宜「宀冖」安栖；喜水草丰美，宜「氵禾」；与鸡三合，宜「鸟」类字根。', chars: [{ char: '宇', meaning: '安居稳栖' }, { char: '浩', meaning: '水草丰美' }, { char: '渊', meaning: '渊深厚重' }, { char: '禾', meaning: '五谷充盈' }, { char: '鹏', meaning: '鹏程万里' }, { char: '宏', meaning: '宏大稳进' }], forbidden: '羊 / 马 / 日 / 山', forbiddenDesc: '丑未相冲忌「羊」；丑午相害忌「马」；牛怕日晒，避「日」；牛不喜山上，避「山」。' },
  { zodiac: '虎', radicals: '山 / 木 / 林 / 王 / 水', desc: '虎为山君，宜「山木林」字根以归山林；称王霸气，宜「王」字根；喜清流，宜「水」。', chars: [{ char: '岚', meaning: '山间清气' }, { char: '峰', meaning: '雄踞高峰' }, { char: '林', meaning: '归林称王' }, { char: '森', meaning: '繁茂雄浑' }, { char: '瑾', meaning: '王者美玉' }, { char: '渊', meaning: '虎啸清渊' }], forbidden: '猴 / 蛇 / 人 / 口', forbiddenDesc: '寅申相冲忌「猴」；寅巳相害忌「蛇」；虎遇人则伤人或被伤，避「人亻」「口」。' },
  { zodiac: '兔', radicals: '月 / 宀 / 禾 / 艹 / 木', desc: '兔为月精，宜「月」字根；喜窟穴安栖，宜「宀」；食草禾，宜「禾艹木」字根。', chars: [{ char: '朋', meaning: '月朗朋聚' }, { char: '安', meaning: '安栖有窟' }, { char: '芷', meaning: '香草可食' }, { char: '芮', meaning: '草木柔嫩' }, { char: '桂', meaning: '月宫折桂' }, { char: '禾', meaning: '五谷丰食' }], forbidden: '鸡 / 龙 / 鼠', forbiddenDesc: '卯酉相冲忌「鸡」；卯辰相害忌「龙」；子卯相刑忌「鼠」。' },
  { zodiac: '龙', radicals: '水 / 日 / 月 / 王 / 星', desc: '龙腾云海，宜「水」字根；呼风唤雨、日月同辉，宜「日月」；龙颜尊贵，宜「王」与星辰字根。', chars: [{ char: '浩', meaning: '龙游江海' }, { char: '晨', meaning: '旭日同辉' }, { char: '朋', meaning: '日月并明' }, { char: '瑾', meaning: '龙颜美玉' }, { char: '霖', meaning: '甘霖沛雨' }, { char: '辰', meaning: '星辰龙时' }], forbidden: '狗 / 兔', forbiddenDesc: '辰戌相冲忌「狗」；辰卯相害忌「兔」。' },
  { zodiac: '蛇', radicals: '宀 / 冖 / 口 / 木 / 田', desc: '蛇喜穴居窟隐，宜「宀冖」字根；多栖林野，宜「木田」；口舌为火，宜「口」字根谨慎取用。', chars: [{ char: '宇', meaning: '隐栖安窟' }, { char: '安', meaning: '安居隐行' }, { char: '林', meaning: '栖林修炼' }, { char: '嘉', meaning: '嘉言善辞' }, { char: '富', meaning: '田宅丰足' }, { char: '宏', meaning: '宏隐深藏' }], forbidden: '猪 / 虎', forbiddenDesc: '巳亥相冲忌「猪」；巳寅相害忌「虎」。' },
  { zodiac: '马', radicals: '艹 / 木 / 禾 / 衣 / 人', desc: '马食水草，宜「艹木禾」字根；披甲挂鞍，宜「衣」部；良驹逢主，宜「人亻」字根。', chars: [{ char: '茗', meaning: '草青料足' }, { char: '林', meaning: '林间驰骋' }, { char: '禾', meaning: '禾谷丰食' }, { char: '裕', meaning: '披甲丰裕' }, { char: '俊', meaning: '良驹遇主' }, { char: '杰', meaning: '人中骏杰' }], forbidden: '鼠 / 牛', forbiddenDesc: '午子相冲忌「鼠」；午丑相害忌「牛」。' },
  { zodiac: '羊', radicals: '艹 / 木 / 禾 / 米 / 豆', desc: '羊食水草五谷，宜「艹木禾米豆」字根；性情温顺，宜柔和之字，忌「大」形傲字。', chars: [{ char: '芷', meaning: '香草丰食' }, { char: '芮', meaning: '柔嫩草木' }, { char: '林', meaning: '林间悠然' }, { char: '粟', meaning: '五谷丰登' }, { char: '粱', meaning: '丰食安饱' }, { char: '禾', meaning: '禾黍充盈' }], forbidden: '牛 / 鼠', forbiddenDesc: '未丑相冲忌「牛」；未子相害忌「鼠」。' },
  { zodiac: '猴', radicals: '木 / 禾 / 人 / 口 / 子', desc: '猴栖林间，宜「木禾」字根；性灵近人，宜「人亻」；喜果食，宜「口」；申子拱水，宜「子」字根。', chars: [{ char: '林', meaning: '栖林自在' }, { char: '森', meaning: '繁茂果林' }, { char: '俊', meaning: '灵慧近人' }, { char: '嘉', meaning: '嘉果可口' }, { char: '子', meaning: '申子拱水' }, { char: '学', meaning: '灵慧好学' }], forbidden: '虎 / 猪', forbiddenDesc: '申寅相冲忌「虎」；申亥相害忌「猪」。' },
  { zodiac: '鸡', radicals: '金 / 米 / 禾 / 豆 / 山', desc: '鸡为兑金，宜「金」字根；食五谷，宜「米禾豆」；司晨唱晓，宜「山」字根高栖。', chars: [{ char: '锦', meaning: '金羽华美' }, { char: '铭', meaning: '金声司晨' }, { char: '粟', meaning: '丰食有余' }, { char: '粱', meaning: '五谷丰登' }, { char: '岚', meaning: '山栖高唱' }, { char: '峰', meaning: '高栖报晓' }], forbidden: '兔 / 狗', forbiddenDesc: '酉卯相冲忌「兔」；酉戌相害忌「狗」。' },
  { zodiac: '狗', radicals: '人 / 入 / 冖 / 小 / 少', desc: '狗忠主人，宜「人入亻」字根；喜窝居安栖，宜「冖宀」；谦逊守宅，宜「小少」字根。', chars: [{ char: '俊', meaning: '忠勇近人' }, { char: '杰', meaning: '人杰守宅' }, { char: '安', meaning: '安栖守家' }, { char: '宏', meaning: '宏居护主' }, { char: '慕', meaning: '慕义守诚' }, { char: '少', meaning: '谦逊敛守' }], forbidden: '龙 / 鸡', forbiddenDesc: '戌辰相冲忌「龙」；戌酉相害忌「鸡」。' },
  { zodiac: '猪', radicals: '宀 / 冖 / 米 / 禾 / 豆 / 金', desc: '猪喜窟宅安栖，宜「宀冖」字根；食丰五谷，宜「米禾豆」；亥水生木，宜「金水」相济字根。', chars: [{ char: '宇', meaning: '安栖丰宅' }, { char: '安', meaning: '安居丰食' }, { char: '粟', meaning: '五谷丰登' }, { char: '粱', meaning: '丰食安饱' }, { char: '铭', meaning: '金水相济' }, { char: '锦', meaning: '丰裕华美' }], forbidden: '蛇 / 猴', forbiddenDesc: '亥巳相冲忌「蛇」；亥申相害忌「猴」。' },
];

/** 生肖起名候选生成：结合生肖宜用字根 */
function generateZodiacNames(surname: string, zodiac: string): NameCandidate[] {
  const z = ZODIAC_FAVOR.find((x) => x.zodiac === zodiac) ?? ZODIAC_FAVOR[0];
  const chars = z.chars;
  const candidates: NameCandidate[] = [];
  const used = new Set<string>();
  for (const c of chars.slice(0, 3)) {
    const full = surname + c.char;
    if (used.has(full)) continue;
    used.add(full);
    candidates.push({
      full,
      given: c.char,
      chars: [{ char: c.char, meaning: c.meaning, element: elementOf(c.char) }],
      style: `生肖·${zodiac}`,
      reason: `宜用「${c.char}」：${c.meaning}。${z.desc}`,
    });
  }
  for (let i = 0; i < chars.length && candidates.length < 9; i++) {
    for (let j = i + 1; j < chars.length && candidates.length < 9; j++) {
      const a = chars[i], b = chars[j];
      const given = a.char + b.char;
      const full = surname + given;
      if (used.has(full)) continue;
      used.add(full);
      candidates.push({
        full,
        given,
        chars: [
          { char: a.char, meaning: a.meaning, element: elementOf(a.char) },
          { char: b.char, meaning: b.meaning, element: elementOf(b.char) },
        ],
        style: `生肖·${zodiac}`,
        reason: `宜用「${a.char}」「${b.char}」：${a.meaning}、${b.meaning}。${z.desc}`,
      });
    }
  }
  return candidates;
}

/* ============================ 测字 ============================ */
function CeziPanel({ active, history, onAdd, onRemove, onClearTab, onJump, onZidian, seed }: MingPanelProps) {
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('all');
  const [res, setRes] = useState<CeziResult | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const { persist, restore } = useMingPersist();
  const restoredRef = useRef(false);

  const myHistory = history.filter((h) => h.tab === 'cezi');

  const run = async (charOverride?: string, topicOverride?: string) => {
    setErr('');
    const target = (charOverride ?? input).trim();
    const tp = topicOverride ?? topic;
    if (!/[㐀-鿿]/.test(target)) {
      setErr('请输入一个汉字');
      return;
    }
    setLoading(true);
    const t0 = performance.now();
    try {
      const ch = Array.from(target).find((c) => /[㐀-鿿]/.test(c))!;
      const strokes = await charStroke(ch);
      const r = analyzeCezi(target, tp, strokes);
      setRes(r);
      onAdd({
        tab: 'cezi',
        input: r.char,
        summary: `${r.element}行 ${r.trigram.name}卦 偏${r.tendency.word}`,
        params: { c: r.char, topic: tp },
      });
      persist('cezi', { c: r.char, topic: tp }, { cezi: r }, `测字 · ${r.char}`);
      track('ming', 'cezi.run', { ok: true, char: r.char, topic: tp, latencyMs: Math.round(performance.now() - t0) });
    } catch (e: any) {
      setErr(e?.message || '测算失败');
      track('ming', 'cezi.run', { ok: false, topic: tp, reason: e?.message || 'unknown' });
    } finally {
      setLoading(false);
    }
  };

  // 只在首次切到本 Tab 时恢复，避免 5 个 Tab 进页面就并发打接口
  useEffect(() => {
    if (!active || restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      // 跨 Tab 跳转带来的预填优先于本地存档：用户刚点「查这个字」，就该看到它
      if (seed?.c) {
        setInput(seed.c);
        const tp = seed.topic || topic;
        setTopic(tp);
        await run(seed.c, tp);
        return;
      }
      const p = await restore('cezi');
      if (!p?.c) return;
      setInput(p.c);
      if (p.topic) setTopic(p.topic);
      await run(p.c, p.topic);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, restore, seed]);

  const sameChars = res ? pickSameElementChars(res.element, res.char, 3) : [];
  const topicLabel = CEZI_TOPICS.find((t) => t.key === topic)?.label ?? '综合';

  return (
    <div className="ming-panel">
      <div className="ming-form-card">
        <div className="result-card-title">
          <SectionIcon name="type" />
          测字 · 一字观象
          {myHistory.length > 0 && (
            <button type="button" className="ming-history-entry" onClick={() => setHistOpen(true)}>
              历史 {myHistory.length}
            </button>
          )}
        </div>
        <p className="dream-search-hint">输入一个汉字，按「形音义」推演其五行、卦象与运势倾向（同字同题结果稳定）。</p>
        <div className="ming-form-group">
          <div className="ming-form-group-title">输入与主题</div>
          <div className="ming-form-grid-2">
            <input
              className="form-input field-pill ming-form-col-full"
              maxLength={4}
              placeholder="如：福 / 安 / 梦"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
            <select
              className="form-input ming-select field-pill"
              value={topic}
              onChange={(e) => {
                // 已有结果时改选项立即重算，避免「结果显示的是上一个主题」的困惑
                setTopic(e.target.value);
                if (res) void run(undefined, e.target.value);
              }}
            >
              {CEZI_TOPICS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <button className="btn-submit ming-btn" onClick={() => run()} disabled={loading}>
              {loading ? '测算中…' : '测字'}
            </button>
          </div>
        </div>
        <SamplesRow
          items={CEZI_SAMPLES}
          onPick={(p) => {
            track('ming', 'sample.use', { tab: 'cezi' });
            setInput(p.c);
            void run(p.c);
          }}
        />
        {err && <div className="ming-err">{err}</div>}

        {myHistory.length > 0 && (
          <div className="ming-history-bar">
            <span className="ming-history-label">最近测字</span>
            <div className="ming-history-scroll">
              {myHistory.slice(0, 8).map((h) => (
                <button
                  key={h.time}
                  className="ming-history-chip"
                  onClick={() => {
                    setInput(h.input);
                    void run(h.input, h.params.topic);
                  }}
                  title={h.summary}
                >
                  <span className="ming-history-char">{h.input}</span>
                  <span className="ming-history-sum">{h.summary}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && !res && <OmLoading label="正在拆字推演…" mode="inline" />}

      {res && (
        <div className="mood-tracker">
          <div className="ming-cezi-head">
            <div className="ming-cezi-char">{res.char}</div>
            <div className="ming-cezi-meta">
              <span className="ming-badge" style={{ color: 'var(--primary-light)' }}>{res.element} 行</span>
              <span className="ming-badge" style={{ color: 'var(--accent-cyan)' }}>{res.trigram.sym} {res.trigram.name}卦</span>
              <span className="ming-badge" style={{ color: res.tendency.color }}>偏{res.tendency.word}</span>
              <span className="ming-badge muted">笔画 {res.strokes ?? '—'}</span>
              {res.pinyin && <span className="ming-badge muted">拼音 {res.pinyin}</span>}
            </div>
          </div>

          {/* 五行色环 */}
          <div className="ming-element-ring">
            {FIVE_ELEMENTS.map((e) => (
              <span
                key={e}
                className={'ming-element-dot' + (e === res.element ? ' active' : '')}
                style={{ background: ELEMENT_COLOR[e] }}
                title={`${e}行`}
              >
                {e}
              </span>
            ))}
          </div>

          {/* 卦象图示 */}
          <div className="ming-trigram-display">
            <span className="ming-trigram-sym">{res.trigram.sym}</span>
            <span className="ming-trigram-name">{res.trigram.name} · {res.trigram.nature}</span>
            <span className="ming-trigram-desc">{res.trigram.desc}</span>
          </div>

          {/* M28：二级分组 · 字形字义 */}
          <MingSection idx="壹" title="字形字义">
            <div className="ming-block-text"><b>拆字</b>：{res.chaizi}</div>
            <div className="ming-block-text"><b>字象</b>：{res.zixiang}</div>
            <div className="ming-block-text"><b>{topicLabel}趣解</b>：{res.topicText}</div>
          </MingSection>

          {/* 字感延伸：同五行推荐用字 */}
          {sameChars.length > 0 && (
            <MingSection idx="贰" title="字感延伸 · 同五行佳字">
              <div className="ming-extend-list">
                {sameChars.map((c) => (
                  <span className="ming-badge ming-extend-chip" key={c.char} style={{ color: ELEMENT_COLOR[res.element] }}>
                    {c.char} · {c.meaning}
                  </span>
                ))}
              </div>
            </MingSection>
          )}

          {/* 文化延展：组词 / 成语 / 典故 */}
          {(res.words.length > 0 || res.idiom || res.allusion) && (
            <MingSection idx="叁" title="文化延展">
              {res.words.length > 0 && (
                <div className="ming-culture-row">
                  <span className="ming-culture-key">组词</span>
                  <span className="ming-culture-val">{res.words.join('、')}</span>
                </div>
              )}
              {res.idiom && (
                <div className="ming-culture-row">
                  <span className="ming-culture-key">成语</span>
                  <span className="ming-culture-val">{res.idiom}</span>
                </div>
              )}
              {res.allusion && (
                <div className="ming-culture-row">
                  <span className="ming-culture-key">典故</span>
                  <span className="ming-culture-val ming-culture-allusion">{res.allusion}</span>
                </div>
              )}
            </MingSection>
          )}

          {/* 入名宜忌 */}
          {res.nameFit && (
            <MingSection idx="肆" title="入名宜忌">
              <div className="ming-block-text">
                <span className="ming-badge" style={{ color: JI_COLOR[res.nameFit.fit === '宜' ? '吉' : res.nameFit.fit === '中性' ? '半吉' : '凶'] }}>
                  {res.nameFit.fit}入名
                </span>
                <span style={{ marginLeft: 8 }}>{res.nameFit.text}</span>
              </div>
            </MingSection>
          )}

          {/* 整体运势签 */}
          <MingSection idx="伍" title="整体运势签">
            <div className="ming-omen">
              <div className="ming-omen-level">{res.omen.level}</div>
              <div className="ming-omen-text">{res.omen.text}</div>
            </div>
          </MingSection>

          {/* 跨模块联动：测到一个好字，顺手深查字义 / 直接拿去起名 */}
          <div className="ming-jump-row">
            <span className="ming-jump-label">接着做：</span>
            <button type="button" className="ming-jump-btn" onClick={() => onZidian?.(res.char)}>
              去字典深查「{res.char}」
            </button>
            <button type="button" className="ming-jump-btn" onClick={() => onJump?.('qiming', { m: 'style', mc: res.char })}>
              用「{res.char}」起名
            </button>
            <button type="button" className="ming-jump-btn" onClick={() => { const c = pickRandomChar(res.char); void run(c, topic); }} disabled={loading}>
              🎲 换一个字
            </button>
          </div>

          <MingAIPanel
            cacheKey={`cezi:${res.char}:${topic}`}
            message={`测字「${res.char}」，五行属${res.element}，${res.trigram.name}卦，偏${res.tendency.word}。请从字义、五行、卦象角度解读此字的文化内涵与运势寓意。`}
            title="小玄陪你测字"
            chips={['这个字适合用在名字里吗？', '它能补我缺的五行吗？', '换个角度再讲讲这个字']}
          />

          <MingActions
            title={`玄镜测字 · ${res.char}`}
            markdown={buildCeziReport(res, topicLabel)}
            posterKeyword={`测字 · ${res.char}`}
            posterContext={`测字「${res.char}」：${res.element}行，${res.trigram.name}卦，偏${res.tendency.word}。${res.zixiang}`}
          />

          <div className="ming-disclaimer">{DISCLAIMER}</div>
        </div>
      )}

      <MingHistoryModal
        open={histOpen}
        onClose={() => setHistOpen(false)}
        history={history}
        activeTab="cezi"
        onPick={(it) => {
          setInput(it.input);
          void run(it.input, it.params.topic);
        }}
        onRemove={onRemove}
        onClear={onClearTab}
      />
    </div>
  );
}

/* ============================ 姓名 · 五格剖象 ============================ */
function NamePanel({ active, history, onAdd, onRemove, onClearTab, onJump, onZidian, seed }: MingPanelProps) {
  const [surname, setSurname] = useState('');
  const [given, setGiven] = useState('');
  const [gender, setGender] = useState('男');
  const [res, setRes] = useState<XingmingResult | null>(null);
  const [detail, setDetail] = useState<NameDetailResult | null>(null);
  const [yinXingYi, setYinXingYi] = useState<NameScore | null>(null);
  const [dupRate, setDupRate] = useState<DupRateResult | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [histOpen, setHistOpen] = useState(false);
  const { persist, restore } = useMingPersist();
  const { birth } = useVisitor();
  const [date, setDate] = useState('');
  const [shichen, setShichen] = useState('不详');
  const [baziWx, setBaziWx] = useState<BaziWuxing | null>(null);
  const restoredRef = useRef(false);
  const filledRef = useRef(false);

  const myHistory = history.filter((h) => h.tab === 'name');

  // 入参可覆盖：历史回放直接传值，不必先等 state 更新
  const run = async (sOverride?: string, gOverride?: string, gdOverride?: string) => {
    const sn = (sOverride ?? surname).trim();
    const gn = (gOverride ?? given).trim();
    const gd = gdOverride ?? gender;
    setErr('');
    if (!sn || !gn) {
      setErr('请输入完整的姓与名');
      return;
    }
    setLoading(true);
    const t0 = performance.now();
    try {
      // 填了生辰：排盘算八字五行，供「名字补益命局」展示（不参与五格算法）
      if (date) {
        try {
          const [y, mo, d] = date.split('-').map(Number);
          const bz = (await calculateBazi({ year: y, month: mo, day: d, timeText: shichen, gender: gd })) as BaziAPIResult;
          setBaziWx(baziWuxing(bz));
        } catch {
          setBaziWx(null);
        }
      } else {
        setBaziWx(null);
      }
      const r = await analyzeXingming(sn, gn, gd);
      setRes(r);
      setDetail(analyzeNameDetail(r));
      // 音形义分析（音律/字形/字义三维度）
      try {
        const yxy = await scoreNameCandidate(sn, gn, gd);
        setYinXingYi(yxy);
      } catch {
        setYinXingYi(null);
      }
      // 重名率估算
      setDupRate(nameDuplicationRate(sn, gn));
      onAdd({
        tab: 'name',
        input: `${r.surname}${r.given}`,
        summary: `${r.score}分 · 三才${r.threeTalent.tian}/${r.threeTalent.ren}/${r.threeTalent.di}`,
        params: { s: sn, g: gn, gd },
      });
      persist('name', { s: sn, g: gn, gd }, { name: r }, `姓名测算 · ${r.surname}${r.given}`);
      track('ming', 'name.run', {
        ok: true, score: r.score, gender: gd,
        latencyMs: Math.round(performance.now() - t0),
      });
    } catch (e: any) {
      setErr(e?.message || '测算失败');
      track('ming', 'name.run', { ok: false, gender: gd, reason: e?.message || 'unknown' });
    } finally {
      setLoading(false);
    }
  };

  // 只在首次切到本 Tab 时恢复，避免 5 个 Tab 进页面就并发打接口
  useEffect(() => {
    if (!active || restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      // 跨 Tab 跳转预填优先（如从起名结果「测这个名字」过来）
      if (seed?.s && seed?.g) {
        const gd = seed.gd || '男';
        setSurname(seed.s);
        setGiven(seed.g);
        setGender(gd);
        await run(seed.s, seed.g, gd);
        return;
      }
      const p = await restore('name');
      if (!p?.s || !p?.g) return;
      setSurname(p.s);
      setGiven(p.g);
      if (p.gd) setGender(p.gd);
      await run(p.s, p.g, p.gd);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, restore, seed]);

  // 访客档案有出生信息时回填「结合生辰」（只填一次）
  useEffect(() => {
    if (!birth?.date || filledRef.current) return;
    filledRef.current = true;
    const t = birth.time;
    setDate((d) => d || birth.date);
    if (t) setShichen((s) => (s === '不详' ? t : s));
  }, [birth]);

  // 评分动画：从 0 渐增到目标值
  useEffect(() => {
    if (!res) {
      setDisplayScore(0);
      return;
    }
    const target = res.score;
    let raf = 0;
    const start = performance.now();
    const dur = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [res]);

  const gridList = res ? [res.grids.tian, res.grids.ren, res.grids.di, res.grids.wai, res.grids.zong] : [];
  const maxNum = gridList.length ? Math.max(...gridList.map((g) => g.num), 1) : 1;

  const yiJi = res
    ? res.score >= 80
      ? { tone: '吉', text: '此名格局上佳、五行调和，数理多为吉象，可放心沿用。日后宜修身立德以配其名。' }
      : res.score >= 60
        ? { tone: '平', text: '此名总体尚可，个别宫位略有不足。可通过后天修养、名号（字号）搭配或行善积德予以增益。' }
        : { tone: '慎', text: '此名数理偏弱、冲克较多，建议结合八字五行另择佳字补益，或以字号、艺名调和。' }
    : null;

  return (
    <div className="ming-panel">
      <div className="ming-form-card">
        <div className="result-card-title">
          <SectionIcon name="user" />
          姓名 · 五格剖象
          {myHistory.length > 0 && (
            <button type="button" className="ming-history-entry" onClick={() => setHistOpen(true)}>
              历史 {myHistory.length}
            </button>
          )}
        </div>
        <p className="dream-search-hint">按姓名学五格法推算天/人/地/外/总格与三才五行，给出综合评分（笔画以通用标准计）。</p>
        <div className="ming-form-group">
          <div className="ming-form-group-title">姓名信息</div>
          <div className="ming-form-grid-2">
            <input className="form-input field-pill" placeholder="姓（如：王）" value={surname} onChange={(e) => setSurname(e.target.value)} />
            <input className="form-input field-pill" placeholder="名（如：伟）" value={given} onChange={(e) => setGiven(e.target.value)} />
            <select
              className="form-input ming-select field-pill"
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                if (res) void run(undefined, undefined, e.target.value);
              }}
            >
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
            <button className="btn-submit ming-btn" onClick={() => run()} disabled={loading}>
              {loading ? '测算中…' : '测名'}
            </button>
          </div>
        </div>

        <div className="ming-form-group">
          <div className="ming-form-group-title">出生信息（可选）</div>
          <div className="ming-form-grid-2">
            <DatePicker
              value={date}
              onChange={(v) => {
                setDate(v);
                if (res) void run(undefined, undefined, gender);
              }}
              placeholder="选择出生日期"
            />
            <select
              className="form-input ming-select field-pill"
              value={shichen}
              onChange={(e) => {
                setShichen(e.target.value);
                if (res) void run(undefined, undefined, gender);
              }}
              title="如未填具体时辰，可保持「不详」（将不会按八字推荐）"
            >
              {SHICHEN.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <SamplesRow
          items={NAME_SAMPLES}
          onPick={(p) => {
            track('ming', 'sample.use', { tab: 'name' });
            setSurname(p.s);
            setGiven(p.g);
            if (p.gd) setGender(p.gd);
            void run(p.s, p.g, p.gd);
          }}
        />
        {err && <div className="ming-err">{err}</div>}

        {myHistory.length > 0 && (
          <div className="ming-history-bar">
            <span className="ming-history-label">最近测名</span>
            <div className="ming-history-scroll">
              {myHistory.slice(0, 8).map((h) => (
                <button
                  key={h.time}
                  className="ming-history-chip"
                  onClick={() => {
                    setSurname(h.params.s ?? '');
                    setGiven(h.params.g ?? '');
                    if (h.params.gd) setGender(h.params.gd);
                    void run(h.params.s, h.params.g, h.params.gd);
                  }}
                  title={h.summary}
                >
                  <span className="ming-history-char">{h.input}</span>
                  <span className="ming-history-sum">{h.summary}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && !res && <OmLoading label="正在排五格、配三才…" mode="inline" />}

      {res && (
        <div className="mood-tracker">
          <div className="ming-score-head">
            <div>
              <div className="ming-score-num">{displayScore}<span>分</span></div>
              <div className="ming-score-cap">{res.surname}{res.given} · 综合评分</div>
            </div>
            <ScoreBar value={displayScore} />
          </div>

          {/* M28：二级分组 · 五格数理 */}
          <MingSection idx="壹" title="五格数理">
            <div className="ming-grid-row">
              {gridList.map((g) => (
                <div className="ming-grid-card" key={g.label}>
                  <div className="ming-grid-name">{g.label}</div>
                  <div className="ming-grid-role">{g.role}</div>
                  <div className="ming-grid-num">{g.num}</div>
                  <div className="ming-grid-k">数理 {g.k}</div>
                  <div className="ming-badge" style={{ color: JI_COLOR[g.ji] }}>{g.ji}</div>
                  {/* 笔画可视化：占最大笔画数比例 */}
                  <div className="ming-grid-stroke">
                    <div
                      className="ming-grid-stroke-fill"
                      style={{ width: `${(g.num / maxNum) * 100}%`, background: JI_COLOR[g.ji] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </MingSection>

          {/* M28：二级分组 · 三才配置 */}
          <MingSection idx="贰" title="三才配置">
            <div className="ming-block-text">
              {res.threeTalent.tian} · {res.threeTalent.ren} · {res.threeTalent.di}（天 · 人 · 地）—— {res.threeTalent.text}
            </div>
          </MingSection>

          {/* M28：二级分组 · 各格评语 */}
          <MingSection idx="叁" title="各格评语">
            <div className="ming-comments">
              {res.comments.map((c) => (
                <div className="ming-comment" key={c.label}>
                  <span className="ming-comment-label">{c.label}</span>
                  <span className="ming-badge" style={{ color: JI_COLOR[c.ji] }}>{c.ji}</span>
                  <span className="ming-comment-text">{c.text}</span>
                </div>
              ))}
            </div>
          </MingSection>

          {detail && (
            <MingSection idx="肆" title="五行详批 · 五大运势">
              <div className="ming-detail-section">
                <div className="ming-detail-grid">
                  {detail.dims.map((d) => (
                    <div className="ming-detail-card" key={d.key}>
                      <div className="ming-detail-head">
                        <span className="ming-detail-icon">{d.icon}</span>
                        <span className="ming-detail-name">{d.label}</span>
                        <span className="ming-badge" style={{ color: JI_COLOR[d.ji] }}>{d.ji}</span>
                      </div>
                      <div className="ming-detail-text">{d.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </MingSection>
          )}

          {/* 音形义三维分析 */}
          {yinXingYi && (
            <MingSection idx="肆·补" title="音形义 · 三维解析">
              <div className="ming-yxy-grid">
                <div className="ming-yxy-card">
                  <div className="ming-yxy-head">
                    <span className="ming-yxy-icon">🎵</span>
                    <span className="ming-yxy-name">音律</span>
                    <span className="ming-yxy-score" style={{ color: yinXingYi.phonetic >= 80 ? JI_COLOR['吉'] : yinXingYi.phonetic >= 65 ? JI_COLOR['半吉'] : JI_COLOR['凶'] }}>{yinXingYi.phonetic}分</span>
                  </div>
                  <div className="ming-yxy-text">{yinXingYi.phoneticNote}</div>
                </div>
                <div className="ming-yxy-card">
                  <div className="ming-yxy-head">
                    <span className="ming-yxy-icon">✍️</span>
                    <span className="ming-yxy-name">字形</span>
                    <span className="ming-yxy-score" style={{ color: yinXingYi.form >= 80 ? JI_COLOR['吉'] : yinXingYi.form >= 65 ? JI_COLOR['半吉'] : JI_COLOR['凶'] }}>{yinXingYi.form}分</span>
                  </div>
                  <div className="ming-yxy-text">{yinXingYi.formNote}</div>
                </div>
                <div className="ming-yxy-card">
                  <div className="ming-yxy-head">
                    <span className="ming-yxy-icon">📖</span>
                    <span className="ming-yxy-name">字义</span>
                    <span className="ming-yxy-score" style={{ color: yinXingYi.meaning >= 80 ? JI_COLOR['吉'] : yinXingYi.meaning >= 65 ? JI_COLOR['半吉'] : JI_COLOR['凶'] }}>{yinXingYi.meaning}分</span>
                  </div>
                  <div className="ming-yxy-text">{yinXingYi.meaningNote}</div>
                </div>
              </div>
            </MingSection>
          )}

          {/* 重名率查询 */}
          {dupRate && (
            <MingSection idx="伍·补" title="重名率查询">
              <div className="ming-dup-card">
                <div className="ming-dup-head">
                  <div className="ming-dup-stat">
                    <span className="ming-dup-num">{dupRate.per10k}</span>
                    <span className="ming-dup-unit">人 / 万人</span>
                  </div>
                  <span
                    className="ming-badge"
                    style={{
                      color: dupRate.level === '极多' ? JI_COLOR['凶'] : dupRate.level === '较多' ? JI_COLOR['半吉'] : JI_COLOR['吉'],
                      fontSize: '15px',
                    }}
                  >
                    {dupRate.level}
                  </span>
                </div>
                <div className="ming-dup-text">{dupRate.text}</div>
                <div className="ming-dup-note">* 为重名率估算值，基于姓氏与用字频率启发式计算，仅供参考；精确数据请以公安部门查询为准。</div>
              </div>
            </MingSection>
          )}

          {/* 宜忌提示 */}
          {yiJi && (
            <MingSection idx="陆" title="宜忌提示">
              <div className="ming-block-text">
                <span className="ming-badge" style={{ color: JI_COLOR[yiJi.tone === '吉' ? '吉' : yiJi.tone === '平' ? '半吉' : '凶'] }}>
                  {yiJi.tone}
                </span>
                <span style={{ marginLeft: 8 }}>{yiJi.text}</span>
              </div>
            </MingSection>
          )}

          {/* 八字配合：填了生辰才展示，给出名字与命局补益结论 */}
          {baziWx && (
            <MingSection idx="柒" title="八字配合 · 名字补益命局">
              <div className="ming-block ming-bazi-card">
                <div className="ming-block-label">命局五行分布</div>
                <div className="ming-bazi-dist">
                  {FIVE_ELEMENTS.map((e) => (
                    <span key={e} className={'ming-bazi-item' + (baziWx.lacking.includes(e) ? ' lacking' : '')} style={{ color: ELEMENT_COLOR[e] }}>
                      {e} {baziWx.map[e] ?? 0}
                    </span>
                  ))}
                </div>
                <div className="ming-block-text">
                  {baziWx.lacking.length > 0 ? `命局缺${baziWx.lacking.join('、')}。` : '命局五行俱全，无明显偏缺。'}
                </div>
              </div>
              <div className="ming-block">
                <div className="ming-block-label">此名五行</div>
                <div className="ming-block-text">
                  {[...res.given].map((c) => {
                    const el = elementOf(c);
                    return <span key={c} className="ming-badge" style={{ color: ELEMENT_COLOR[el] }}>{c}·{el}</span>;
                  })}
                </div>
              </div>
              <div className="ming-block">
                <div className="ming-block-label">配合结论</div>
                <div className="ming-block-text">
                  {(() => {
                    const nameEls = [...res.given].map(elementOf);
                    const covered = baziWx.lacking.filter((e) => nameEls.includes(e));
                    return covered.length > 0
                      ? <><span className="ming-badge" style={{ color: JI_COLOR['吉'] }}>宜</span> 此名含「{covered.join('、')}」，可补益命局所缺，名字与八字相得益彰。</>
                      : <><span className="ming-badge" style={{ color: JI_COLOR['半吉'] }}>平</span> 此名五行（{nameEls.join('、')}）命局本不缺，可作风格调和，整体无冲克。</>;
                  })()}
                </div>
              </div>
            </MingSection>
          )}

          {res.incomplete && (
            <div className="ming-warn">部分字未能取到笔画数，评分为估算，仅供参考。</div>
          )}

          {/* 跨模块联动：分数偏低时给一条真实的出路，而不是只在文案里提一句 */}
          <div className="ming-jump-row">
            <span className="ming-jump-label">接着做：</span>
            {res.score < 60 && <span className="ming-jump-tip">分数偏低，换个名字试试？</span>}
            <button
              type="button"
              className={'ming-jump-btn' + (res.score < 60 ? ' emphasis' : '')}
              onClick={() => onJump?.('qiming', { s: res.surname, g: gender, m: 'style' })}
            >
              去起名看看
            </button>
            <button
              type="button"
              className="ming-jump-btn"
              onClick={() => onZidian?.([...res.given][0] ?? '')}
            >
              查名字里的字
            </button>
            <button type="button" className="ming-jump-btn" onClick={() => { const s = pickRandomSample(NAME_SAMPLES); setSurname(s.params.s); setGiven(s.params.g); if (s.params.gd) setGender(s.params.gd); void run(s.params.s, s.params.g, s.params.gd); }} disabled={loading}>
              🎲 换一组示例
            </button>
          </div>

          <MingAIPanel
            cacheKey={`name:${res.surname}${res.given}:${res.score}`}
            message={`姓名「${res.surname}${res.given}」，综合评分${res.score}分。天格${res.grids.tian.num}(${res.grids.tian.ji})、人格${res.grids.ren.num}(${res.grids.ren.ji})、地格${res.grids.di.num}(${res.grids.di.ji})、外格${res.grids.wai.num}(${res.grids.wai.ji})、总格${res.grids.zong.num}(${res.grids.zong.ji})。三才：${res.threeTalent.tian}/${res.threeTalent.ren}/${res.threeTalent.di}。请从姓名学角度解读此姓名的整体格局与运势。`}
            title="小玄帮你看看姓名"
            chips={['这个名字对事业有帮助吗？', '哪一格最需要留意？', '想改名的话有什么建议？']}
          />

          <MingActions
            title={`玄镜姓名测算 · ${res.surname}${res.given}`}
            markdown={buildNameReport(res, detail)}
            posterKeyword={`姓名测算 · ${res.surname}${res.given}`}
            posterContext={`姓名「${res.surname}${res.given}」综合评分${res.score}分，三才配置${res.threeTalent.tian}/${res.threeTalent.ren}/${res.threeTalent.di}。${res.threeTalent.text}`}
          />

          <div className="ming-disclaimer">{DISCLAIMER}</div>
        </div>
      )}

      <MingHistoryModal
        open={histOpen}
        onClose={() => setHistOpen(false)}
        history={history}
        activeTab="name"
        onPick={(it) => {
          setSurname(it.params.s ?? '');
          setGiven(it.params.g ?? '');
          if (it.params.gd) setGender(it.params.gd);
          void run(it.params.s, it.params.g, it.params.gd);
        }}
        onRemove={onRemove}
        onClear={onClearTab}
      />
    </div>
  );
}

/* ============================ 合婚 · 八字合婚 ============================ */
interface PartnerInput {
  name: string;
  gender: string;
  date: string;
  shichen: string;
}
const emptyPartner = (gender: string): PartnerInput => ({ name: '', gender, date: '', shichen: '不详' });

function HehunPanel({ active, history, onAdd, onRemove, onClearTab, onJump, seed }: MingPanelProps) {
  // 姓名默认留空：卡片标题已用 name || '男方/女方' 兜底，
  // 若这里也预填「男方」，标题与输入框会重复显示同一串字
  const [m, setM] = useState<PartnerInput>(() => emptyPartner('男'));
  const [f, setF] = useState<PartnerInput>(() => emptyPartner('女'));
  const [res, setRes] = useState<HehunResult | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const { persist, restore } = useMingPersist();
  const { birth, setBirth } = useVisitor();
  const restoredRef = useRef(false);
  const filledRef = useRef(false);

  const myHistory = history.filter((h) => h.tab === 'hehun');

  // 访客档案有出生信息时回填男方（只填一次，不覆盖用户已填内容）
  useEffect(() => {
    if (!birth?.date || filledRef.current) return;
    filledRef.current = true;
    setM((p) => ({
      ...p,
      date: p.date || birth.date,
      shichen: p.date ? p.shichen : birth.time || p.shichen,
      gender: p.date ? p.gender : birth.gender || p.gender,
    }));
  }, [birth]);

  const setSide = (side: 'm' | 'f', patch: Partial<PartnerInput>) => {
    if (side === 'm') setM((p) => ({ ...p, ...patch }));
    else setF((p) => ({ ...p, ...patch }));
  };

  const run = async (mIn?: PartnerInput, fIn?: PartnerInput) => {
    const mm = mIn ?? m;
    const ff = fIn ?? f;
    setErr('');
    if (!mm.date || !ff.date) {
      setErr('请填写双方出生日期');
      return;
    }
    setLoading(true);
    try {
      const toReq = (p: PartnerInput) => {
        const [y, mo, d] = p.date.split('-').map(Number);
        return { year: y, month: mo, day: d, timeText: p.shichen, gender: p.gender };
      };
      const t0 = performance.now();
      const [mb, fb] = await Promise.all([calculateBazi(toReq(mm)), calculateBazi(toReq(ff))]);
      const r = analyzeHehun(mb as BaziAPIResult, fb as BaziAPIResult);
      setRes(r);
      // M20：写回访客档案（以男方出生信息为代表），切到 numerology/horoscope 自动回填
      if (mm.date) void setBirth({ date: mm.date, time: mm.shichen, gender: mm.gender });
      track('ming', 'hehun.run', {
        ok: true, total: r.total, tier: r.tier,
        latencyMs: Math.round(performance.now() - t0),
      });
      onAdd({
        tab: 'hehun',
        input: `${mm.name || '男方'}×${ff.name || '女方'}`,
        summary: `${r.total}分 · ${r.tier}`,
        params: {
          mn: mm.name, md: mm.date, ms: mm.shichen, mg: mm.gender,
          fn: ff.name, fd: ff.date, fs: ff.shichen, fg: ff.gender,
        },
      });
      persist(
        'hehun',
        {
          mn: mm.name, md: mm.date, ms: mm.shichen, mg: mm.gender,
          fn: ff.name, fd: ff.date, fs: ff.shichen, fg: ff.gender,
        },
        { hehun: r },
        `合婚 · ${mm.name || '男方'} × ${ff.name || '女方'}`,
      );
    } catch (e: any) {
      setErr('合婚失败：' + (e?.message || '请确认后端排盘服务已启动'));
      track('ming', 'hehun.run', { ok: false, reason: e?.message || 'unknown' });
    } finally {
      setLoading(false);
    }
  };

  // 只在首次切到本 Tab 时恢复，避免 5 个 Tab 进页面就并发打接口
  useEffect(() => {
    if (!active || restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      // 跨 Tab 跳转预填优先
      if (seed?.md && seed?.fd) {
        const mm: PartnerInput = { name: seed.mn || '', gender: seed.mg || '男', date: seed.md, shichen: seed.ms || '不详' };
        const ff: PartnerInput = { name: seed.fn || '', gender: seed.fg || '女', date: seed.fd, shichen: seed.fs || '不详' };
        filledRef.current = true;
        setM(mm);
        setF(ff);
        await run(mm, ff);
        return;
      }
      const p = await restore('hehun');
      if (!p?.md || !p?.fd) return;
      filledRef.current = true; // 已有存档，别再让访客档案覆盖
      const mm: PartnerInput = { name: p.mn || '', gender: p.mg || '男', date: p.md, shichen: p.ms || '不详' };
      const ff: PartnerInput = { name: p.fn || '', gender: p.fg || '女', date: p.fd, shichen: p.fs || '不详' };
      setM(mm);
      setF(ff);
      await run(mm, ff);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, restore]);

  const renderForm = (side: 'm' | 'f', p: PartnerInput) => (
    <div className="ming-partner">
      {/* 卡头固定为「男方／女方」：原来用 p.name 兜底会导致标题与下方姓名框重复同一串字 */}
      <div className="ming-partner-title">{side === 'm' ? '男方' : '女方'}</div>
      <div className="ming-row">
        <input className="form-input ming-input field-pill" placeholder="称呼" value={p.name} onChange={(e) => setSide(side, { name: e.target.value })} />
        <select className="form-input ming-select field-pill" value={p.gender} onChange={(e) => setSide(side, { gender: e.target.value })}>
          <option value="男">男</option>
          <option value="女">女</option>
        </select>
        <DatePicker value={p.date} onChange={(v) => setSide(side, { date: v })} placeholder="出生日期" />
        <select className="form-input ming-select field-pill" value={p.shichen} onChange={(e) => setSide(side, { shichen: e.target.value })}>
          {SHICHEN.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const advice = res
    ? res.total >= 85
      ? '天作之合，宜珍惜彼此、共同成长。多以真诚相待、少计得失，情路自能长久。'
      : res.total >= 70
        ? '适配度佳，性格互补。遇分歧多换位思考，给彼此空间与信任，关系会愈发稳固。'
        : res.total >= 55
          ? '总体相合，偶有摩擦属常态。沟通是良药，遇事不冷战、不翻旧账，方可久处不厌。'
          : res.total >= 40
            ? '冲克较多，需更多耐心。可借共同爱好、定期旅行等方式增进情感，亦可择吉日行事。'
            : '冲克明显，宜理性看待。莫以命论定一切，重在用心经营；若分歧难解，亦当善待彼此。'
    : '';

  const radarAxes = ['感情', '事业', '财运', '健康', '总分'];
  const radarValues = res
    ? [res.subs[0]?.score ?? 0, res.subs[1]?.score ?? 0, res.subs[2]?.score ?? 0, res.subs[3]?.score ?? 0, res.total]
    : [0, 0, 0, 0, 0];

  /** M29：合婚 → 择日延伸。复用风水页 findLuckyDates（嫁娶订婚类），
   * 直接在本页给出近期吉日，无需跳到风水页（风水页当前也还不支持 URL 深链） */
  const marryDays = useMemo(() => {
    if (!res) return [];
    try {
      return findLuckyDates(new Date(), 90, 'marry').slice(0, 5);
    } catch {
      return [];
    }
  }, [res]);

  return (
    <div className="ming-panel">
      <div className="mood-tracker">
        <div className="result-card-title">
          <SectionIcon name="heart-handshake" />
          合婚 · 八字配对
          {myHistory.length > 0 && (
            <button type="button" className="ming-history-entry" onClick={() => setHistOpen(true)}>
              历史 {myHistory.length}
            </button>
          )}
        </div>
        <p className="dream-search-hint">输入双方出生信息，排八字后从生肖、日干、夫妻宫、五行互补等维度评估契合度。</p>
        <div className="ming-partner-row">
          {renderForm('m', m)}
          {renderForm('f', f)}
        </div>
        <button className="btn-submit ming-btn ming-btn-wide" onClick={() => run()} disabled={loading}>
          {loading ? '合婚推算中…' : '开始合婚'}
        </button>
        <SamplesRow
          items={HEHUN_SAMPLES}
          onPick={(p) => {
            track('ming', 'sample.use', { tab: 'hehun' });
            filledRef.current = true; // 用户主动选了示例，别再让访客档案覆盖
            const mm: PartnerInput = { name: '', gender: '男', date: p.md, shichen: p.ms || '不详' };
            const ff: PartnerInput = { name: '', gender: '女', date: p.fd, shichen: p.fs || '不详' };
            setM(mm);
            setF(ff);
            void run(mm, ff);
          }}
        />
        {err && <div className="ming-err">{err}</div>}

        {myHistory.length > 0 && (
          <div className="ming-history-bar">
            <span className="ming-history-label">最近合婚</span>
            <div className="ming-history-scroll">
              {myHistory.slice(0, 8).map((h) => (
                <button
                  key={h.time}
                  className="ming-history-chip"
                  onClick={() => {
                    const mm: PartnerInput = { name: h.params.mn || '', gender: h.params.mg || '男', date: h.params.md, shichen: h.params.ms || '不详' };
                    const ff: PartnerInput = { name: h.params.fn || '', gender: h.params.fg || '女', date: h.params.fd, shichen: h.params.fs || '不详' };
                    setM(mm);
                    setF(ff);
                    void run(mm, ff);
                  }}
                  title={h.summary}
                >
                  <span className="ming-history-char">{h.input}</span>
                  <span className="ming-history-sum">{h.summary}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && !res && <OmLoading label="正在排双方八字…" mode="inline" />}

      {res && (
        <div className="mood-tracker">
          <div className="ming-score-head">
            <div>
              <div className="ming-score-num">{res.total}<span>分</span></div>
              <div className="ming-score-cap">{res.tier}</div>
            </div>
            <ScoreBar value={res.total} color="linear-gradient(90deg, var(--accent-pink, #ff6b9d), var(--accent-gold, #d4a853))" />
          </div>

          {/* 缘分雷达图 */}
          <div className="ming-radar-wrap">
            <div className="ming-block-label">缘分雷达</div>
            <RadarChart axes={radarAxes} values={radarValues} />
          </div>

          <div className="ming-sub-row">
            {res.subs.map((s) => (
              <div className="ming-sub" key={s.label}>
                <div className="ming-sub-label">{s.label}</div>
                <div className="ming-sub-score">{s.score}</div>
                <ScoreBar value={s.score} />
              </div>
            ))}
          </div>

          <div className="ming-rel-list">
            <div className="ming-rel"><span>生肖</span><b>{res.mSX} × {res.fSX}</b><i style={{ color: JI_COLOR[res.sx.score >= 90 ? '吉' : res.sx.score >= 60 ? '半吉' : '凶'] }}>{res.sx.text} · {res.sx.score}</i></div>
            <div className="ming-rel"><span>日干</span><b>{res.mDM} × {res.fDM}</b><i style={{ color: JI_COLOR[res.gan.score >= 90 ? '吉' : res.gan.score >= 60 ? '半吉' : '凶'] }}>{res.gan.text} · {res.gan.score}</i></div>
            <div className="ming-rel"><span>夫妻宫</span><b>{res.mZhi || '—'} × {res.fZhi || '—'}</b><i style={{ color: JI_COLOR[res.palace.score >= 90 ? '吉' : res.palace.score >= 60 ? '半吉' : '凶'] }}>{res.palace.text} · {res.palace.score}</i></div>
            <div className="ming-rel"><span>五行</span><b>互补</b><i style={{ color: JI_COLOR[res.wu.score >= 90 ? '吉' : res.wu.score >= 60 ? '半吉' : '凶'] }}>{res.wu.score}</i></div>
          </div>

          <div className="ming-block">
            <div className="ming-block-label">合婚总评</div>
            <div className="ming-block-text">{res.analysis}</div>
          </div>

          {/* 相处建议 */}
          {advice && (
            <div className="ming-block ming-advice-card">
              <div className="ming-block-label">相处建议</div>
              <div className="ming-block-text">{advice}</div>
            </div>
          )}

          {/* M29：嫁娶吉日 —— 复用风水页择日引擎（建除十二神 · 嫁娶类） */}
          {marryDays.length > 0 && (
            <MingSection title="嫁娶吉日 · 近 90 天">
              <div className="ming-lucky-list">
                {marryDays.map((d) => (
                  <div className="ming-lucky-item" key={d.date.toISOString()}>
                    <div className="ming-lucky-date">{d.date.getMonth() + 1}月{d.date.getDate()}日</div>
                    <div className="ming-lucky-gz">{d.gan}{d.zhi} · {d.jianchu}</div>
                    <div className="ming-lucky-yi">{d.matched.slice(0, 3).join('、')}</div>
                  </div>
                ))}
              </div>
              <div className="ming-block-text ming-lucky-note">
                吉日取自建除十二神宜忌（嫁娶类）；如需结合双方八字、避开冲日，可到风水页使用完整择日引擎。
              </div>
            </MingSection>
          )}

          {/* 跨模块联动：合完婚自然要挑日子——择日引擎在风水页 */}
          <div className="ming-jump-row">
            <span className="ming-jump-label">接着做：</span>
            {res.total < 70 && <span className="ming-jump-tip">冲克偏多，可选吉日调和</span>}
            <a className={'ming-jump-btn' + (res.total < 70 ? ' emphasis' : '')} href="/fengshui">
              去择吉日 · 风水页
            </a>
            <button type="button" className="ming-jump-btn" onClick={() => onJump?.('qiming', { m: 'style' })}>
              顺便给孩子起名
            </button>
          </div>

          <MingAIPanel
            cacheKey={`hehun:${m.date}:${f.date}:${res.total}`}
            message={`合婚分析：男方${m.name}（属${res.mSX}，日干${res.mDM}）与女方${f.name}（属${res.fSX}，日干${res.fDM}），总分${res.total}分（${res.tier}）。请从生肖、日干、夫妻宫、五行互补角度综合解读双方匹配度。`}
            title="小玄帮你合合婚"
            chips={['我们最需要注意什么？', '哪一年适合结婚？', '性格上怎么互补？']}
          />

          <MingActions
            title={`玄镜合婚 · ${m.name || '男方'} × ${f.name || '女方'}`}
            markdown={buildHehunReport(res, m.name || '男方', f.name || '女方', advice)}
            posterKeyword={`合婚 · ${m.name || '男方'}×${f.name || '女方'}`}
            posterContext={`合婚：${m.name || '男方'}（属${res.mSX}）与 ${f.name || '女方'}（属${res.fSX}），契合度${res.total}分（${res.tier}）。${res.analysis}`}
          />

          <div className="ming-disclaimer">{DISCLAIMER}</div>
        </div>
      )}

      <MingHistoryModal
        open={histOpen}
        onClose={() => setHistOpen(false)}
        history={history}
        activeTab="hehun"
        onPick={(it) => {
          const mm: PartnerInput = { name: it.params.mn || '', gender: it.params.mg || '男', date: it.params.md, shichen: it.params.ms || '不详' };
          const ff: PartnerInput = { name: it.params.fn || '', gender: it.params.fg || '女', date: it.params.fd, shichen: it.params.fs || '不详' };
          setM(mm);
          setF(ff);
          void run(mm, ff);
        }}
        onRemove={onRemove}
        onClear={onClearTab}
      />
    </div>
  );
}

/* ============================ 起名 · 智能起名 + 诗词起名 + 生肖起名 ============================ */
const POETRY_SOURCES = [
  { key: 'all', label: '全部' },
  { key: '诗经', label: '诗经' },
  { key: '楚辞', label: '楚辞' },
  { key: '唐诗', label: '唐诗' },
  { key: '宋词', label: '宋词' },
];

const ZODIAC_LIST = Object.values(DZHI_TO_ZODIAC);

/** 起名入参集合：历史回放时整体覆盖，避免逐项 setState 后再读旧值 */
interface QimingArgs {
  surname: string;
  gender: string;
  mode: 'style' | 'poetry' | 'zodiac' | 'dict';
  styleKey: string;
  useBazi: boolean;
  date: string;
  shichen: string;
  poetrySource: string;
  zodiac: string;
  /** 定字：候选名必须包含此字（字典 / 测字跳转带来） */
  must: string;
  /** 字辈模式：定字固定在中间 */
  generation: boolean;
  /** 双胞胎模式：生成成对名字 */
  twin: boolean;
  /** 扰动种子：0 = 不扰动（默认结果完全确定，历史可复现） */
  seed: number;
}

function QimingPanel({ active, history, onAdd, onRemove, onClearTab, onJump, onZidian, seed }: MingPanelProps) {
  const [surname, setSurname] = useState('');
  const [gender, setGender] = useState('男');
  const [mode, setMode] = useState<'style' | 'poetry' | 'zodiac' | 'dict'>('style');
  const [styleKey, setStyleKey] = useState('poetic');
  const [useBazi, setUseBazi] = useState(false);
  const [date, setDate] = useState('');
  const [shichen, setShichen] = useState('不详');
  const [poetrySource, setPoetrySource] = useState('all');
  const [zodiac, setZodiac] = useState('龙');
  const [mustChar, setMustChar] = useState('');
  const [generation, setGeneration] = useState(false);
  const [twin, setTwin] = useState(false);
  const [twinPairs, setTwinPairs] = useState<TwinNamePair[]>([]);
  const [nonce, setNonce] = useState(0);
  const [names, setNames] = useState<NameCandidate[]>([]);
  const [nameScores, setNameScores] = useState<Record<string, NameScore>>({});
  const [poetryNames, setPoetryNames] = useState<PoetryNameCandidate[]>([]);
  const [zodiacNames, setZodiacNames] = useState<NameCandidate[]>([]);
  const [dictNames, setDictNames] = useState<NameCandidate[]>([]);
  const [baziWx, setBaziWx] = useState<BaziWuxing | null>(null);
  const [reshuffleWait, setReshuffleWait] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const { persist, restore } = useMingPersist();
  const { birth, setBirth } = useVisitor();
  const restoredRef = useRef(false);
  const filledRef = useRef(false);
  /** M25/M26：收藏与对比状态（收藏持久化到 localStorage） */
  const favApi = useMingFavorites();
  const [filterType, setFilterType] = useState<NameFilterType>('all');
  const [filterEl, setFilterEl] = useState<Element | 'all'>('all');
  const [compare, setCompare] = useState<CompareName[]>([]);
  const [favOpen, setFavOpen] = useState(false);
  const [cmpOpen, setCmpOpen] = useState(false);
  /** 排盘结果按入参缓存：换一批时不必重复打接口 */
  const baziCacheRef = useRef<{ key: string; data: BaziAPIResult } | null>(null);

  const myHistory = history.filter((h) => h.tab === 'qiming');

  // 访客档案有出生信息时回填「结合生辰」的日期（只填一次）
  useEffect(() => {
    if (!birth?.date || filledRef.current) return;
    filledRef.current = true;
    setDate((d) => d || birth.date);
    if (birth.time) setShichen((s) => (s === '不详' ? birth.time : s));
  }, [birth]);

  const run = async (args?: Partial<QimingArgs>) => {
    const a: QimingArgs = {
      surname: surname.trim(),
      gender,
      mode,
      styleKey,
      useBazi,
      date,
      shichen,
      poetrySource,
      zodiac,
      must: mustChar,
      generation,
      twin,
      seed: nonce,
      ...args,
    };
    const sn = a.surname.trim();
    setErr('');
    if (!sn) {
      setErr('请输入姓氏');
      return;
    }
    setLoading(true);
    const t0 = performance.now();
    let produced = 0; // 本轮产出数量（setState 是异步的，埋点取局部变量才准）
    try {
      if (a.mode === 'style') {
        let bazi: BaziAPIResult | undefined;
        if (a.useBazi && a.date) {
          // 同入参直接复用上次排盘，避免「换一批」反复打接口
          const key = `${a.date}|${a.shichen}|${a.gender}`;
          if (baziCacheRef.current?.key === key) {
            bazi = baziCacheRef.current.data;
          } else {
            const [y, mo, d] = a.date.split('-').map(Number);
            bazi = (await calculateBazi({
              year: y,
              month: mo,
              day: d,
              timeText: a.shichen,
              gender: a.gender,
            })) as BaziAPIResult;
            baziCacheRef.current = { key, data: bazi };
          }
          setBaziWx(baziWuxing(bazi));
        } else {
          setBaziWx(null);
        }
        if (a.twin) {
          // 双胞胎起名：生成成对名字
          const pairs = generateTwinNames(sn, a.gender, bazi);
          setTwinPairs(pairs);
          setNames([]);
          setNameScores({});
          produced = pairs.length;
        } else {
          setTwinPairs([]);
          const list = generateNames(sn, a.gender, a.styleKey, bazi, {
            // seed 为 0 视为「不扰动」，保证默认结果与历史回放完全一致
            seed: a.seed || undefined,
            mustChar: a.must || undefined,
            generation: a.generation,
          });
          // 综合打分并排序（五格 40% + 三才 20% + 音形义 25% + 五行 15%）
          const lacking = bazi ? baziWuxing(bazi).lacking : [];
          const scored = await Promise.all(
            list.map(async (n) => {
              try {
                const s = await scoreNameCandidate(sn, n.given, a.gender, lacking);
                return { n, s };
              } catch {
                return { n, s: null as NameScore | null };
              }
            }),
          );
          const scoreMap: Record<string, NameScore> = {};
          scored.forEach(({ n, s }) => { if (s) scoreMap[n.full] = s; });
          setNameScores(scoreMap);
          const sorted = [...list].sort((a, b) => {
            const sa = scoreMap[a.full]?.total ?? 60;
            const sb = scoreMap[b.full]?.total ?? 60;
            return sb - sa;
          });
          setNames(sorted);
          produced = sorted.length;
        }
        setPoetryNames([]);
        setZodiacNames([]);
      } else if (a.mode === 'dict') {
        if (!a.must) {
          setErr('请先从字典选一个字作为定字');
          setLoading(false);
          return;
        }
        let bazi: BaziAPIResult | undefined;
        if (a.useBazi && a.date) {
          const key = `${a.date}|${a.shichen}|${a.gender}`;
          if (baziCacheRef.current?.key === key) {
            bazi = baziCacheRef.current.data;
          } else {
            const [y, mo, d] = a.date.split('-').map(Number);
            bazi = (await calculateBazi({
              year: y, month: mo, day: d, timeText: a.shichen, gender: a.gender,
            })) as BaziAPIResult;
            baziCacheRef.current = { key, data: bazi };
          }
          setBaziWx(baziWuxing(bazi));
        } else {
          setBaziWx(null);
        }
        setTwinPairs([]);
        const list = generateNames(sn, a.gender, a.styleKey, bazi, {
          seed: a.seed || undefined,
          mustChar: a.must,
          generation: a.generation,
        });
        const lacking = bazi ? baziWuxing(bazi).lacking : [];
        const scored = await Promise.all(
          list.map(async (n) => {
            try {
              const s = await scoreNameCandidate(sn, n.given, a.gender, lacking);
              return { n, s };
            } catch {
              return { n, s: null as NameScore | null };
            }
          }),
        );
        const scoreMap: Record<string, NameScore> = {};
        scored.forEach(({ n, s }) => { if (s) scoreMap[n.full] = s; });
        setNameScores(scoreMap);
        const sorted = [...list].sort((a, b) => {
          const sa = scoreMap[a.full]?.total ?? 60;
          const sb = scoreMap[b.full]?.total ?? 60;
          return sb - sa;
        });
        setDictNames(sorted);
        produced = sorted.length;
        setPoetryNames([]);
        setZodiacNames([]);
      } else if (a.mode === 'poetry') {
        const list = generatePoetryNames(sn, a.gender, a.poetrySource);
        setPoetryNames(list);
        produced = list.length;
        setNames([]);
        setZodiacNames([]);
        // 诗词卡也补算音形义评分（前 12 个），供卡片展开「音律」解读
        const sm: Record<string, NameScore> = {};
        await Promise.all(list.slice(0, 12).map(async (n) => {
          try { sm[n.full] = await scoreNameCandidate(sn, n.given, a.gender); } catch { /* 跳过 */ }
        }));
        setNameScores((m) => ({ ...m, ...sm }));
      } else {
        const list = generateZodiacNames(sn, a.zodiac);
        setZodiacNames(list);
        produced = list.length;
        setNames([]);
        setPoetryNames([]);
        // 生肖卡也补算音形义评分（前 12 个），供卡片展开解读
        const sm: Record<string, NameScore> = {};
        await Promise.all(list.slice(0, 12).map(async (n) => {
          try { sm[n.full] = await scoreNameCandidate(sn, n.given, a.gender); } catch { /* 跳过 */ }
        }));
        setNameScores((m) => ({ ...m, ...sm }));
      }

      const modeLabel = a.mode === 'style' ? '风格' : a.mode === 'poetry' ? '诗词' : a.mode === 'dict' ? '字典' : `生肖·${a.zodiac}`;
      const params: Record<string, string> = {
        s: sn,
        g: a.gender,
        m: a.mode,
        k: a.styleKey,
        bz: a.useBazi ? '1' : '',
        d: a.date,
        sc: a.shichen,
        ps: a.poetrySource,
        z: a.zodiac,
        mc: a.must,
        nz: a.seed ? String(a.seed) : '',
      };
      onAdd({ tab: 'qiming', input: `${sn}·${modeLabel}`, summary: `${a.gender}宝 · ${modeLabel}`, params });
      persist('qiming', params, { qiming: { mode: a.mode, surname: sn } }, `起名 · ${sn}（${modeLabel}）`);
      // M20：写回访客档案（宝宝出生信息），切到 numerology/horoscope 自动回填
      if (a.date) void setBirth({ date: a.date, time: a.shichen, gender: a.gender });
      track('ming', 'qiming.run', {
        ok: true, mode: a.mode, style: a.styleKey, gender: a.gender,
        useBazi: a.useBazi, must: !!a.must, seed: a.seed, count: produced,
        latencyMs: Math.round(performance.now() - t0),
      });
    } catch (e: any) {
      setErr(e?.message || '起名失败');
      track('ming', 'qiming.run', { ok: false, mode: a.mode, reason: e?.message || 'unknown' });
    } finally {
      setLoading(false);
    }
  };

  /** 换一批：递增种子重排候选池（与 tarot 重抽一致，带冷却防连点） */
  const reshuffle = () => {
    if (reshuffleWait || loading) return;
    const next = nonce + 1;
    setNonce(next);
    setReshuffleWait(true);
    track('ming', 'qiming.reshuffle', { mode, seed: next });
    void run({ seed: next });
    window.setTimeout(() => setReshuffleWait(false), RESHUFFLE_COOLDOWN_MS);
  };

  /** M26：把候选名快照成对比条目（选中时定格，换一批后不错位） */
  const toCompare = (item: NameCandidate | PoetryNameCandidate, m: 'style' | 'poetry' | 'zodiac' | 'dict'): CompareName => {
    const full = item.full;
    const els =
      'chars' in item && Array.isArray((item as NameCandidate).chars) && typeof (item as NameCandidate).chars[0]?.element === 'string'
        ? (item as NameCandidate).chars.map((c) => c.element)
        : [];
    const detail = 'reason' in item ? (item as NameCandidate).reason : (item as PoetryNameCandidate).meaning;
    return {
      full,
      given: item.given,
      surname,
      gender,
      mode: m,
      py: [...full].map((c) => charToPinyin(c)).filter(Boolean).join(' '),
      elements: els,
      detail,
    };
  };
  const isInCompare = (full: string) => compare.some((c) => c.full === full);
  const compareDisabled = compare.length >= 3;
  const toggleCompare = async (n: CompareName) => {
    setCompare((prev) => {
      if (prev.some((c) => c.full === n.full)) return prev.filter((c) => c.full !== n.full);
      if (prev.length >= 3) return prev;
      return [...prev, n];
    });
    // 异步计算综合打分（五格/三才/音形义/五行），用于对比表格
    if (!compare.some((c) => c.full === n.full)) {
      try {
        const s = await scoreNameCandidate(n.surname, n.given, n.gender);
        setCompare((prev) => prev.map((c) => (c.full === n.full ? { ...c, score: s } : c)));
      } catch {
        // 打分失败不影响对比
      }
    }
  };

  // 只在首次切到本 Tab 时恢复，避免 5 个 Tab 进页面就并发打接口
  useEffect(() => {
    if (!active || restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      // 跨 Tab 跳转预填优先：从字典「用此字起名」/ 测字跳过来时带 mc（定字）
      const src = seed?.s || seed?.mc ? seed : await restore('qiming');
      if (!src?.s && !src?.mc) return;
      filledRef.current = true;
      const args: QimingArgs = {
        surname: src.s || '',
        gender: src.g || '男',
        mode: (src.m as QimingArgs['mode']) || 'style',
        styleKey: src.k || 'poetic',
        useBazi: src.bz === '1',
        date: src.d || '',
        shichen: src.sc || '不详',
        poetrySource: src.ps || 'all',
        zodiac: src.z || '龙',
        must: src.mc || '',
        generation: false,
        twin: false,
        seed: Number(src.nz) || 0,
      };
      setSurname(args.surname);
      setGender(args.gender);
      setMode(args.mode);
      setStyleKey(args.styleKey);
      setUseBazi(args.useBazi);
      setDate(args.date);
      setShichen(args.shichen);
      setPoetrySource(args.poetrySource);
      setZodiac(args.zodiac);
      setMustChar(args.must);
      setNonce(args.seed);
      if (!args.surname) return; // 只带定字没带姓氏：填好定字，等用户补姓氏
      await run(args);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, restore, seed]);

  const zodiacFavor = ZODIAC_FAVOR.find((x) => x.zodiac === zodiac) ?? ZODIAC_FAVOR[0];
  const styleLabel = NAME_STYLES.find((s) => s.key === styleKey)?.label ?? '';

  // 三种模式共用一块 AI 解读（此前只有风格模式有）
  const birthText = useMemo(() => {
    if (!date) return '（未提供生辰）';
    const [y, mo, d] = date.split('-').map(Number);
    return `出生于${y}年${mo}月${d}日${shichen === '不详' ? '（时辰不详）' : shichen}`;
  }, [date, shichen]);

  const birthHintForAI = useMemo<MingAgentBirthHint | undefined>(() => {
    if (!date) return undefined;
    const [y, mo, d] = date.split('-').map(Number);
    return { year: y, month: mo, day: d, timeText: shichen === '不详' ? undefined : shichen, gender };
  }, [date, shichen, gender]);

  const aiMessage =
    mode === 'style' && names.length > 0
      ? `请为姓${surname}的${gender}宝宝起名，${birthText}，偏好${styleLabel}风格${useBazi ? '，结合生辰八字补缺五行' : ''}。\n\n候选名（按推荐度排序，必须按 1./2./3./4./5. 递增编号，禁止全部写成 1.）：\n${names.slice(0, 5).map((n, i) => `${i + 1}. ${n.full}：\n- 寓意：\n- 音律：\n- 五行搭配：`).join('\n\n')}\n\n最后请从整体推荐一名最佳名，并简述理由。`
      : mode === 'poetry' && poetryNames.length > 0
        ? `以下是为姓${surname}的${gender}宝宝从${poetrySource === 'all' ? '古诗词' : poetrySource}中选取的佳名，${birthText}。\n\n候选名（按推荐度排序，必须按 1./2./3./4./5. 递增编号，禁止全部写成 1.）：\n${poetryNames.slice(0, 5).map((n, i) => `${i + 1}. ${n.full}（${n.quote}）：\n- 出处意境：\n- 字义：\n- 音律：`).join('\n\n')}\n\n最后请从整体推荐一名最佳名，并简述理由。`
        : mode === 'zodiac' && zodiacNames.length > 0
          ? `以下是为姓${surname}的${gender}宝宝按${zodiac}生肖宜用字根生成的佳名，${birthText}。\n\n候选名（按推荐度排序，必须按 1./2./3./4./5. 递增编号，禁止全部写成 1.）：\n${zodiacNames.slice(0, 5).map((n, i) => `${i + 1}. ${n.full}：\n- 生肖喜忌：\n- 字义：\n- 音律：`).join('\n\n')}\n\n最后请从整体推荐一名最佳名，并简述理由。`
          : mode === 'dict' && dictNames.length > 0
            ? `以下是为姓${surname}的${gender}宝宝以「${mustChar}」为定字生成的佳名，${birthText}${useBazi ? '，结合生辰八字补缺五行' : ''}。全部候选名都包含定字「${mustChar}」。\n\n候选名（按推荐度排序，必须按 1./2./3./4./5. 递增编号，禁止全部写成 1.）：\n${dictNames.slice(0, 5).map((n, i) => `${i + 1}. ${n.full}：\n- 定字「${mustChar}」的搭配：\n- 音律：\n- 五行搭配：`).join('\n\n')}\n\n最后请从整体推荐一名最佳名，并简述理由。`
            : '';

  const currentList = mode === 'poetry' ? poetryNames.map((n) => n.full) : mode === 'zodiac' ? zodiacNames.map((n) => n.full) : mode === 'dict' ? dictNames.map((n) => n.full) : names.map((n) => n.full);
  /** 是否已有结果：决定改选项要不要立即重算 */
  const hasResult = currentList.length > 0;
  /** AI 解读缓存后缀：生辰变化时必须重新请求，避免命中旧缓存 */
  const aiCacheSuffix = `${date || 'x'}_${shichen}`;

  /** M22：按单/双字 + 五行过滤（三种模式共用，poetry 无五行信息） */
  const styleFiltered = useMemo(() => filterNameList(names, filterType, filterEl, true), [names, filterType, filterEl]);
  const poetryFiltered = useMemo(() => filterNameList(poetryNames, filterType, filterEl, false), [poetryNames, filterType, filterEl]);
  const zodiacFiltered = useMemo(() => filterNameList(zodiacNames, filterType, filterEl, true), [zodiacNames, filterType, filterEl]);
  const dictFiltered = useMemo(() => filterNameList(dictNames, filterType, filterEl, true), [dictNames, filterType, filterEl]);

  return (
    <div className="ming-panel">
      <div className="ming-form-card">
        <div className="result-card-title">
          <SectionIcon name="pen-tool" />
          起名 · 智能起名 / 诗词起名 / 生肖起名
          {myHistory.length > 0 && (
            <button type="button" className="ming-history-entry" onClick={() => setHistOpen(true)}>
              历史 {myHistory.length}
            </button>
          )}
        </div>
        <p className="dream-search-hint">按姓氏、性别、风格偏好生成候选佳名；可选输入生辰以补八字所缺五行。诗词起名取自诗经、楚辞、唐诗、宋词；生肖起名按十二生肖宜用字根取字。</p>

        <div className="ming-form-group">
          <div className="ming-form-group-title">基础信息</div>
          <div className="ming-form-grid-2">
            <input className="form-input field-pill" placeholder="姓氏（如：王）" value={surname} onChange={(e) => setSurname(e.target.value)} />
            <select
              className="form-input ming-select field-pill"
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                if (hasResult) void run({ gender: e.target.value });
              }}
            >
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
        </div>

        <div className="ming-form-group">
          <div className="ming-form-group-title">起名模式</div>
          <div className="ming-mode-tabs">
            {(['style', 'poetry', 'zodiac', 'dict'] as const).map((k) => (
              <button
                key={k}
                className={'ming-mode-tab' + (mode === k ? ' active' : '')}
                onClick={() => {
                  setMode(k);
                  // 已有结果时切模式立即重算，避免停留在上一个模式的结果上
                  if (hasResult) void run({ mode: k });
                }}
              >
                {k === 'style' ? '风格起名' : k === 'poetry' ? '诗词起名' : k === 'dict' ? '字典起名' : '生肖起名'}
              </button>
            ))}
          </div>
        </div>

        <div className="ming-form-group">
          <div className="ming-form-group-title">出生信息（可选）</div>
          <div className="ming-form-grid-2">
            <DatePicker
              value={date}
              onChange={(v) => {
                setDate(v);
                if (hasResult && v) void run({ date: v });
              }}
              placeholder="选择出生日期"
            />
            <select
              className="form-input ming-select field-pill"
              value={shichen}
              onChange={(e) => {
                setShichen(e.target.value);
                if (hasResult) void run({ shichen: e.target.value });
              }}
              title="如未填具体时辰，可保持「不详」（AI 将不会按八字推荐）"
            >
              {SHICHEN.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {mode === 'style' ? (
          <div className="ming-form-group">
            <div className="ming-form-group-title">风格配置</div>
            <div className="ming-form-grid-2">
              <select
                className="form-input ming-select field-pill"
                value={styleKey}
                onChange={(e) => {
                  setStyleKey(e.target.value);
                  if (hasResult) void run({ styleKey: e.target.value });
                }}
              >
                {NAME_STYLES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              <input
                className="form-input field-pill"
                maxLength={2}
                placeholder="定字 / 字辈（可选，如：泽）"
                value={mustChar}
                onChange={(e) => setMustChar(e.target.value)}
              />
            </div>
            {mustChar && (
              <label className="ming-bazi-toggle form-check">
                <input
                  type="checkbox"
                  checked={generation}
                  onChange={(e) => {
                    setGeneration(e.target.checked);
                    if (hasResult) void run({ generation: e.target.checked });
                  }}
                />
                <span>字辈起名（定字固定在名字中间，仅末字变化）</span>
              </label>
            )}
            <div className="ming-check-group">
              <label className="ming-bazi-toggle form-check">
                <input
                  type="checkbox"
                  checked={useBazi}
                  onChange={(e) => {
                    setUseBazi(e.target.checked);
                    if (hasResult) void run({ useBazi: e.target.checked });
                  }}
                />
                <span>结合生辰补缺五行（八字所缺）</span>
              </label>
              <label className="ming-bazi-toggle form-check">
                <input
                  type="checkbox"
                  checked={twin}
                  onChange={(e) => {
                    setTwin(e.target.checked);
                    if (hasResult) void run({ twin: e.target.checked });
                  }}
                />
                <span>双胞胎起名（生成成对关联名字）</span>
              </label>
            </div>
          </div>
        ) : mode === 'poetry' ? (
          <div className="ming-form-group">
            <div className="ming-form-group-title">诗词来源</div>
            <select
              className="form-input ming-select field-pill"
              value={poetrySource}
              onChange={(e) => {
                setPoetrySource(e.target.value);
                if (hasResult) void run({ poetrySource: e.target.value });
              }}
            >
              {POETRY_SOURCES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        ) : mode === 'dict' ? (
          <div className="ming-form-group">
            <div className="ming-form-group-title">字典选字（定字）</div>
            <div className="ming-form-grid-2">
              <input
                className="form-input field-pill"
                maxLength={2}
                placeholder="定字，如：泽（必填）"
                value={mustChar}
                onChange={(e) => setMustChar(e.target.value)}
              />
              <button
                type="button"
                className="btn-submit ming-btn ming-btn-ghost"
                onClick={() => onZidian?.('')}
                title="打开字典，选一个喜欢的字作为起名定字"
              >
                📖 从字典选字
              </button>
            </div>
            {mustChar && (
              <label className="ming-bazi-toggle form-check">
                <input
                  type="checkbox"
                  checked={generation}
                  onChange={(e) => {
                    setGeneration(e.target.checked);
                    if (hasResult) void run({ generation: e.target.checked });
                  }}
                />
                <span>字辈起名（定字固定在名字中间，仅末字变化）</span>
              </label>
            )}
            <div className="ming-check-group">
              <label className="ming-bazi-toggle form-check">
                <input
                  type="checkbox"
                  checked={useBazi}
                  onChange={(e) => {
                    setUseBazi(e.target.checked);
                    if (hasResult) void run({ useBazi: e.target.checked });
                  }}
                />
                <span>结合生辰补缺五行（八字所缺）</span>
              </label>
            </div>
            <p className="ming-form-hint">从字典挑一个中意的字作为「定字」，系统会生成全部包含该字的候选名，并按五行、音律、字义综合排序。</p>
          </div>
        ) : (
          <div className="ming-form-group">
            <div className="ming-form-group-title">生肖配置</div>
            <select
              className="form-input ming-select field-pill"
              value={zodiac}
              onChange={(e) => {
                setZodiac(e.target.value);
                if (hasResult) void run({ zodiac: e.target.value });
              }}
            >
              {ZODIAC_LIST.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <div className="ming-block">
              <div className="ming-block-label">生肖宜用字根</div>
              <div className="ming-block-text">
                <span className="ming-badge" style={{ color: 'var(--accent-gold, #d4a853)' }}>{zodiacFavor.radicals}</span>
                <span style={{ marginLeft: 8 }}>{zodiacFavor.desc}</span>
              </div>
            </div>
            <div className="ming-block ming-forbid-card">
              <div className="ming-block-label">生肖禁忌字根 · 起名宜避</div>
              <div className="ming-block-text">
                <span className="ming-badge" style={{ color: 'var(--danger, #ff6b6b)' }}>{zodiacFavor.forbidden}</span>
                <span style={{ marginLeft: 8 }}>{zodiacFavor.forbiddenDesc}</span>
              </div>
            </div>
          </div>
        )}

        <div className="ming-form-actions">
          <button className="btn-submit ming-btn" onClick={() => run()} disabled={loading}>
            {loading ? '生成中…' : '生成候选名'}
          </button>
        </div>
        <SamplesRow
          items={QIMING_SAMPLES}
          onPick={(p) => {
            track('ming', 'sample.use', { tab: 'qiming' });
            const args: QimingArgs = {
              surname: p.s || '',
              gender: p.g || '男',
              mode: (p.m as QimingArgs['mode']) || 'style',
              styleKey: p.k || 'poetic',
              useBazi: false,
              date: '',
              shichen: '不详',
              poetrySource: p.ps || 'all',
              zodiac: p.z || '龙',
              must: '',
              generation: false,
              twin: false,
              seed: 0,
            };
            setSurname(args.surname);
            setGender(args.gender);
            setMode(args.mode);
            setStyleKey(args.styleKey);
            setPoetrySource(args.poetrySource);
            setZodiac(args.zodiac);
            setNonce(0);
            void run(args);
          }}
        />
        {err && <div className="ming-err">{err}</div>}

        {myHistory.length > 0 && (
          <div className="ming-history-bar">
            <span className="ming-history-label">最近起名</span>
            <div className="ming-history-scroll">
              {myHistory.slice(0, 8).map((h) => (
                <button
                  key={h.time}
                  className="ming-history-chip"
                  onClick={() => {
                    const args: QimingArgs = {
                      surname: h.params.s,
                      gender: h.params.g || '男',
                      mode: (h.params.m as QimingArgs['mode']) || 'style',
                      styleKey: h.params.k || 'poetic',
                      useBazi: h.params.bz === '1',
                      date: h.params.d || '',
                      shichen: h.params.sc || '不详',
                      poetrySource: h.params.ps || 'all',
                      zodiac: h.params.z || '龙',
                      must: h.params.mc || '',
                      generation: false,
                      twin: false,
                      seed: Number(h.params.nz) || 0,
                    };
                    setSurname(args.surname);
                    setGender(args.gender);
                    setMode(args.mode);
                    setStyleKey(args.styleKey);
                    setUseBazi(args.useBazi);
                    setDate(args.date);
                    setShichen(args.shichen);
                    setPoetrySource(args.poetrySource);
                    setZodiac(args.zodiac);
                    setMustChar(args.must);
                    setNonce(args.seed);
                    void run(args);
                  }}
                  title={h.summary}
                >
                  <span className="ming-history-char">{h.input}</span>
                  <span className="ming-history-sum">{h.summary}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && currentList.length === 0 && <OmLoading label="正在挑选佳名…" mode="inline" />}

      {/* M25/M26：收藏 / 对比入口（任一非空时出现，跨三种模式共用一组数据） */}
      {(favApi.favs.length > 0 || compare.length > 0) && (
        <div className="ming-fav-bar">
          {favApi.favs.length > 0 && (
            <button type="button" className="ming-action-btn" onClick={() => setFavOpen(true)}>
              ♥ 我的收藏（{favApi.favs.length}）
            </button>
          )}
          {compare.length > 0 && (
            <button type="button" className="ming-action-btn" onClick={() => setCmpOpen(true)}>
              ⚖️ 对比（{compare.length}）
            </button>
          )}
        </div>
      )}

      {twinPairs.length > 0 && (
        <div className="mood-tracker">
          <div className="ming-jump-row">
            <span className="ming-jump-label">双胞胎佳名（{twinPairs.length} 对）</span>
            <button type="button" className="ming-jump-btn" onClick={reshuffle} disabled={reshuffleWait || loading}>
              {reshuffleWait ? '换一批…' : '🔄 换一批'}
            </button>
          </div>
          {baziWx && (
            <div className="ming-block ming-bazi-card">
              <div className="ming-block-label">八字五行 · 补缺依据</div>
              <div className="ming-bazi-dist">
                {FIVE_ELEMENTS.map((e) => (
                  <span
                    key={e}
                    className={'ming-bazi-item' + (baziWx.lacking.includes(e) ? ' lacking' : '')}
                    style={{ color: ELEMENT_COLOR[e] }}
                  >
                    {e} {baziWx.map[e] ?? 0}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="ming-twin-grid">
            {twinPairs.map((p) => (
              <div className="ming-twin-card" key={p.full1 + p.full2}>
                <div className="ming-twin-pair">
                  <div className="ming-twin-name">{p.full1}</div>
                  <div className="ming-twin-vs">×</div>
                  <div className="ming-twin-name">{p.full2}</div>
                </div>
                <div className="ming-twin-py">
                  {[...p.full1].map((c) => charToPinyin(c)).filter(Boolean).join(' ')}
                  <span className="ming-twin-vs"> × </span>
                  {[...p.full2].map((c) => charToPinyin(c)).filter(Boolean).join(' ')}
                </div>
                <div className="ming-twin-theme">
                  <span className="ming-badge" style={{ color: 'var(--accent-gold, #d4a853)' }}>{p.theme}</span>
                </div>
                <div className="ming-twin-reason">{p.reason}</div>
              </div>
            ))}
          </div>
          <div className="ming-block ming-tip-card">
            <div className="ming-block-label">双胞胎起名小贴士</div>
            <div className="ming-block-text">
              双胞胎起名讲究关联性与独立性并重：可同偏旁、同寓意、成语拆分或五行互补；既体现手足情深，又各自有鲜明寓意。避免两字读音过于相近，以免呼唤时混淆。
            </div>
          </div>
          <div className="ming-disclaimer">{DISCLAIMER}</div>
        </div>
      )}

      {/* 只渲染当前激活 mode 的结果区：避免 3 个 MingAIPanel 同时挂载并发请求 */}
      {mode === 'style' && names.length > 0 && (
        <div className="mood-tracker">
          {/* 操作条：换一批（带冷却）/ 定字提示 */}
          <div className="ming-jump-row">
            <span className="ming-jump-label">候选佳名（{names.length}）</span>
            {mustChar && <span className="ming-jump-tip">已定字「{mustChar}」，全部候选名均含此字</span>}
            <button type="button" className="ming-jump-btn" onClick={reshuffle} disabled={reshuffleWait || loading}>
              {reshuffleWait ? '换一批…' : '🔄 换一批'}
            </button>
          </div>

          {/* 八字五行补缺可视化：勾了「结合生辰」就该让用户看见依据 */}
          {baziWx && (
            <div className="ming-block ming-bazi-card">
              <div className="ming-block-label">八字五行 · 补缺依据</div>
              <div className="ming-bazi-dist">
                {FIVE_ELEMENTS.map((e) => (
                  <span
                    key={e}
                    className={'ming-bazi-item' + (baziWx.lacking.includes(e) ? ' lacking' : '')}
                    style={{ color: ELEMENT_COLOR[e] }}
                    title={baziWx.lacking.includes(e) ? `${e}：八字所缺，推荐优先补` : `${e}：八字已有`}
                  >
                    {e} {baziWx.map[e] ?? 0}
                  </span>
                ))}
              </div>
              <div className="ming-block-text">
                {baziWx.lacking.length > 0
                  ? `八字缺${baziWx.lacking.join('、')}，下列候选名中带「补X」标记者优先补所缺五行。`
                  : '八字五行俱全，无明显偏缺，可按风格与音律自由挑选。'}
              </div>
            </div>
          )}

          <NameFilterBar type={filterType} el={filterEl} hasEl onType={setFilterType} onEl={setFilterEl} />
          <div className="ming-name-grid">
            {styleFiltered.map((n) => (
              <NameCard
                key={n.full}
                full={n.full}
                given={n.given}
                surname={surname}
                gender={gender}
                score={nameScores[n.full]}
                isFav={favApi.has(n.full, 'style')}
                onToggleFav={() => favApi.toggle({ full: n.full, given: n.given, surname, gender, mode: 'style', py: [...n.full].map((c) => charToPinyin(c)).filter(Boolean).join(' ') })}
                inCompare={isInCompare(n.full)}
                onToggleCompare={() => toggleCompare(toCompare(n, 'style'))}
                compareDisabled={compareDisabled}
                onJump={onJump ?? (() => {})}
              >
                <div className="ming-name-chars">
                  {n.chars.map((c) => (
                    <span className="ming-badge" key={c.char} style={{ color: 'var(--primary-light)' }}>{c.char} · {c.element}</span>
                  ))}
                  {baziWx?.lacking.some((e) => n.chars.some((c) => c.element === e)) && (
                    <span className="ming-badge ming-bazi-fix">
                      补{n.chars.find((c) => baziWx.lacking.includes(c.element))!.element}
                    </span>
                  )}
                </div>
                <div className="ming-name-chars-mean">
                  {n.chars.map((c) => (
                    <span key={c.char} className="ming-char-mean">{c.char}：{c.meaning}</span>
                  ))}
                </div>
                <div className="ming-name-reason">{n.reason}</div>
                {nameScores[n.full] && (
                  <div className="ming-name-yxy">
                    <span className="ming-yxy-mini">🎵 {nameScores[n.full].phoneticNote}</span>
                    <span className="ming-yxy-mini">✍️ {nameScores[n.full].formNote}</span>
                    <span className="ming-yxy-mini">📖 {nameScores[n.full].meaningNote}</span>
                  </div>
                )}
              </NameCard>
            ))}
            {styleFiltered.length === 0 && <div className="ming-empty-hint">没有符合筛选条件的名字，换一批或调整筛选。</div>}
          </div>

          {/* 起名小贴士 */}
          <div className="ming-block ming-tip-card">
            <div className="ming-block-label">起名小贴士</div>
            <div className="ming-block-text">
              起名宜兼顾音、形、义、五行与八字所缺；避生僻拗口、避谐音不雅；双字名音调错落（如平仄相间）更添韵律。本工具结果为趣味推演，正式取名建议多方查证。
            </div>
          </div>

          {aiMessage && (
            <>
              <MingAIPanel
                cacheKey={`qiming:style:v3:${surname}:${names.map((n) => n.full).join(',')}:${aiCacheSuffix}`}
                message={aiMessage}
                title="小玄帮你取个好名字"
                chips={['这几个名字哪个最旺运？', '能结合八字再优化吗？', '换种风格还有好名吗？']}
                birthHint={birthHintForAI}
                orderedNames={names.slice(0, 5).map((n) => n.full)}
              />
              <MingActions
                title={`玄镜起名 · ${surname}（${styleLabel}）`}
                markdown={buildQimingReport(surname, gender, 'style', names, poetryNames, styleLabel, zodiac)}
                posterKeyword={`起名 · ${surname}`}
                posterContext={`为姓${surname}的${gender}宝宝起名（${styleLabel}风格）：${names.slice(0, 5).map((n) => n.full).join('、')}`}
              />
            </>
          )}

          <div className="ming-disclaimer">{DISCLAIMER}</div>
        </div>
      )}

      {mode === 'poetry' && poetryNames.length > 0 && (
        <div className="mood-tracker">
          <div className="ming-block-label">诗词佳名（{poetryNames.length}）</div>

          <NameFilterBar type={filterType} el={filterEl} hasEl={false} onType={setFilterType} onEl={setFilterEl} />
          <div className="ming-name-grid">
            {poetryFiltered.map((n) => (
              <NameCard
                key={n.full}
                className="ming-poetry-card"
                full={n.full}
                given={n.given}
                surname={surname}
                gender={gender}
                isFav={favApi.has(n.full, 'poetry')}
                onToggleFav={() => favApi.toggle({ full: n.full, given: n.given, surname, gender, mode: 'poetry', py: [...n.full].map((c) => charToPinyin(c)).filter(Boolean).join(' ') })}
                inCompare={isInCompare(n.full)}
                onToggleCompare={() => toggleCompare(toCompare(n, 'poetry'))}
                compareDisabled={compareDisabled}
                onJump={onJump ?? (() => {})}
              >
                <div className="ming-poetry-src">
                  <span className="ming-badge" style={{ color: 'var(--accent-gold, #d4a853)' }}>{n.source}</span>
                  <span className="ming-poetry-quote" style={{ fontStyle: 'italic' }}>「{n.quote}」</span>
                </div>
                <div className="ming-poetry-cite">——《{n.title}》{n.author}</div>
                <div className="ming-name-py">{[...n.full].map((c) => charToPinyin(c)).filter(Boolean).join(' ')}</div>
                <div className="ming-name-reason">{n.meaning}</div>
                {nameScores[n.full] && (
                  <div className="ming-name-yxy">
                    <span className="ming-yxy-mini">🎵 {nameScores[n.full].phoneticNote}</span>
                  </div>
                )}
              </NameCard>
            ))}
            {poetryFiltered.length === 0 && <div className="ming-empty-hint">没有符合筛选条件的名字，换一批或调整筛选。</div>}
          </div>

          {/* 起名小贴士 */}
          <div className="ming-block ming-tip-card">
            <div className="ming-block-label">起名小贴士</div>
            <div className="ming-block-text">
              诗词起名重意境出处，宜先辨性别与寓意，再查笔画五行是否相配；忌断章取义、忌与原诗悲意相左。经典常取《诗经》《楚辞》之字，温雅含蓄。
            </div>
          </div>

          {aiMessage && (
            <>
              <MingAIPanel
                cacheKey={`qiming:poetry:v3:${surname}:${poetryNames.map((n) => n.full).join(',')}:${aiCacheSuffix}`}
                message={aiMessage}
                title="小玄帮你取个好名字"
                chips={['这句意境适合男孩还是女孩？', '能选更喜庆的典故吗？', '这些名字五行搭吗？']}
                birthHint={birthHintForAI}
                orderedNames={poetryNames.slice(0, 5).map((n) => n.full)}
              />
              <MingActions
                title={`玄镜起名 · ${surname}（诗词）`}
                markdown={buildQimingReport(surname, gender, 'poetry', names, poetryNames, styleLabel, zodiac)}
                posterKeyword={`起名 · ${surname}`}
                posterContext={`为姓${surname}的${gender}宝宝诗词起名：${poetryNames.slice(0, 5).map((n) => n.full).join('、')}`}
              />
            </>
          )}

          <div className="ming-disclaimer">{DISCLAIMER}</div>
        </div>
      )}

      {mode === 'zodiac' && zodiacNames.length > 0 && (
        <div className="mood-tracker">
          <div className="ming-block-label">生肖佳名 · {zodiac}（{zodiacNames.length}）</div>

          <NameFilterBar type={filterType} el={filterEl} hasEl onType={setFilterType} onEl={setFilterEl} />
          <div className="ming-name-grid">
            {zodiacFiltered.map((n) => (
              <NameCard
                key={n.full}
                full={n.full}
                given={n.given}
                surname={surname}
                gender={gender}
                isFav={favApi.has(n.full, 'zodiac')}
                onToggleFav={() => favApi.toggle({ full: n.full, given: n.given, surname, gender, mode: 'zodiac', py: [...n.full].map((c) => charToPinyin(c)).filter(Boolean).join(' ') })}
                inCompare={isInCompare(n.full)}
                onToggleCompare={() => toggleCompare(toCompare(n, 'zodiac'))}
                compareDisabled={compareDisabled}
                onJump={onJump ?? (() => {})}
              >
                <div className="ming-name-chars">
                  {n.chars.map((c) => (
                    <span className="ming-badge" key={c.char} style={{ color: ELEMENT_COLOR[c.element] }}>{c.char} · {c.element}</span>
                  ))}
                </div>
                <div className="ming-name-chars-mean">
                  {n.chars.map((c) => (
                    <span key={c.char} className="ming-char-mean">{c.char}：{c.meaning}</span>
                  ))}
                </div>
                <div className="ming-name-reason">{n.reason}</div>
                {nameScores[n.full] && (
                  <div className="ming-name-yxy">
                    <span className="ming-yxy-mini">🎵 {nameScores[n.full].phoneticNote}</span>
                    <span className="ming-yxy-mini">✍️ {nameScores[n.full].formNote}</span>
                    <span className="ming-yxy-mini">📖 {nameScores[n.full].meaningNote}</span>
                  </div>
                )}
              </NameCard>
            ))}
            {zodiacFiltered.length === 0 && <div className="ming-empty-hint">没有符合筛选条件的名字，换一批或调整筛选。</div>}
          </div>
          <div className="ming-block ming-tip-card">
            <div className="ming-block-label">起名小贴士</div>
            <div className="ming-block-text">
              生肖起名以十二生肖习性为据，取其喜用字根、避其冲克字形，属传统民俗取义。同名亦需结合八字五行与音义综合衡量，不可一概而论。
            </div>
          </div>

          {aiMessage && (
            <>
              <MingAIPanel
                cacheKey={`qiming:zodiac:v3:${surname}:${zodiac}:${zodiacNames.map((n) => n.full).join(',')}:${aiCacheSuffix}`}
                message={aiMessage}
                title="小玄帮你取个好名字"
                chips={['属龙还有哪些宜用字根？', '这名和生辰八字搭吗？', '再来几个大气点的名字']}
                birthHint={birthHintForAI}
                orderedNames={zodiacNames.slice(0, 5).map((n) => n.full)}
              />
              <MingActions
                title={`玄镜起名 · ${surname}（生肖·${zodiac}）`}
                markdown={buildQimingReport(surname, gender, 'zodiac', names, poetryNames, styleLabel, zodiac)}
                posterKeyword={`起名 · ${surname}`}
                posterContext={`为姓${surname}的${gender}宝宝按${zodiac}生肖起名：${zodiacNames.slice(0, 5).map((n) => n.full).join('、')}`}
              />
            </>
          )}

          <div className="ming-disclaimer">{DISCLAIMER}</div>
        </div>
      )}

      {mode === 'dict' && dictNames.length > 0 && (
        <div className="mood-tracker">
          <div className="ming-jump-row">
            <span className="ming-jump-label">字典候选名（{dictNames.length}）</span>
            {mustChar && <span className="ming-jump-tip">定字「{mustChar}」，全部候选名均含此字</span>}
            <button type="button" className="ming-jump-btn" onClick={reshuffle} disabled={reshuffleWait || loading}>
              {reshuffleWait ? '换一批…' : '🔄 换一批'}
            </button>
          </div>

          {baziWx && (
            <div className="ming-block ming-bazi-card">
              <div className="ming-block-label">八字五行 · 补缺依据</div>
              <div className="ming-bazi-dist">
                {FIVE_ELEMENTS.map((e) => (
                  <span
                    key={e}
                    className={'ming-bazi-item' + (baziWx.lacking.includes(e) ? ' lacking' : '')}
                    style={{ color: ELEMENT_COLOR[e] }}
                    title={baziWx.lacking.includes(e) ? `${e}：八字所缺，推荐优先补` : `${e}：八字已有`}
                  >
                    {e} {baziWx.map[e] ?? 0}
                  </span>
                ))}
              </div>
              <div className="ming-block-text">
                {baziWx.lacking.length > 0
                  ? `八字缺${baziWx.lacking.join('、')}，下列候选名中带「补X」标记者优先补所缺五行。`
                  : '八字五行俱全，无明显偏缺，可按风格与音律自由挑选。'}
              </div>
            </div>
          )}

          <NameFilterBar type={filterType} el={filterEl} hasEl onType={setFilterType} onEl={setFilterEl} />
          <div className="ming-name-grid">
            {dictFiltered.map((n) => (
              <NameCard
                key={n.full}
                full={n.full}
                given={n.given}
                surname={surname}
                gender={gender}
                score={nameScores[n.full]}
                isFav={favApi.has(n.full, 'dict')}
                onToggleFav={() => favApi.toggle({ full: n.full, given: n.given, surname, gender, mode: 'dict', py: [...n.full].map((c) => charToPinyin(c)).filter(Boolean).join(' ') })}
                inCompare={isInCompare(n.full)}
                onToggleCompare={() => toggleCompare(toCompare(n, 'dict'))}
                compareDisabled={compareDisabled}
                onJump={onJump ?? (() => {})}
              >
                <div className="ming-name-chars">
                  {n.chars.map((c) => (
                    <span
                      className="ming-badge"
                      key={c.char}
                      style={{ color: c.char === mustChar ? 'var(--accent-gold, #d4a853)' : 'var(--primary-light)' }}
                    >
                      {c.char === mustChar ? `「${c.char}」定字` : `${c.char} · ${c.element}`}
                    </span>
                  ))}
                  {baziWx?.lacking.some((e) => n.chars.some((c) => c.element === e)) && (
                    <span className="ming-badge ming-bazi-fix">
                      补{n.chars.find((c) => baziWx.lacking.includes(c.element))!.element}
                    </span>
                  )}
                </div>
                <div className="ming-name-chars-mean">
                  {n.chars.map((c) => (
                    <span key={c.char} className="ming-char-mean">{c.char}：{c.meaning}</span>
                  ))}
                </div>
                <div className="ming-name-reason">{n.reason}</div>
                {nameScores[n.full] && (
                  <div className="ming-name-yxy">
                    <span className="ming-yxy-mini">🎵 {nameScores[n.full].phoneticNote}</span>
                    <span className="ming-yxy-mini">✍️ {nameScores[n.full].formNote}</span>
                    <span className="ming-yxy-mini">📖 {nameScores[n.full].meaningNote}</span>
                  </div>
                )}
              </NameCard>
            ))}
            {dictFiltered.length === 0 && <div className="ming-empty-hint">没有符合筛选条件的名字，换一批或调整筛选。</div>}
          </div>

          <div className="ming-block ming-tip-card">
            <div className="ming-block-label">字典起名小贴士</div>
            <div className="ming-block-text">
              字典起名以「定字」为核心：先选一个中意的字，再以此为纲搭配成双字名，重意蕴连贯与音律和谐。可结合八字所缺五行，让定字与配字互补生旺。本工具结果为趣味推演，正式取名建议多方查证。
            </div>
          </div>

          {aiMessage && (
            <>
              <MingAIPanel
                cacheKey={`qiming:dict:v3:${surname}:${mustChar}:${dictNames.map((n) => n.full).join(',')}:${aiCacheSuffix}`}
                message={aiMessage}
                title="小玄帮你取个好名字"
                chips={['定字还能怎么搭配？', '这名和生辰八字搭吗？', '换几个更文雅的']}
                birthHint={birthHintForAI}
                orderedNames={dictNames.slice(0, 5).map((n) => n.full)}
              />
              <MingActions
                title={`玄镜字典起名 · ${surname}（定字「${mustChar}」）`}
                markdown={buildQimingReport(surname, gender, 'dict', dictNames, [], styleLabel, zodiac)}
                posterKeyword={`起名 · ${surname}`}
                posterContext={`为姓${surname}的${gender}宝宝以「${mustChar}」为定字起名：${dictNames.slice(0, 5).map((n) => n.full).join('、')}`}
              />
            </>
          )}

          <div className="ming-disclaimer">{DISCLAIMER}</div>
        </div>
      )}

      {/* 历史弹层：此前只有「历史 N」入口却没挂载弹层，点了没反应 */}
      <MingHistoryModal
        open={histOpen}
        onClose={() => setHistOpen(false)}
        history={history}
        activeTab="qiming"
        onPick={(it) => {
          const args: QimingArgs = {
            surname: it.params.s || '',
            gender: it.params.g || '男',
            mode: (it.params.m as QimingArgs['mode']) || 'style',
            styleKey: it.params.k || 'poetic',
            useBazi: it.params.bz === '1',
            date: it.params.d || '',
            shichen: it.params.sc || '不详',
            poetrySource: it.params.ps || 'all',
            zodiac: it.params.z || '龙',
            must: it.params.mc || '',
            generation: false,
            twin: false,
            seed: Number(it.params.nz) || 0,
          };
          setSurname(args.surname);
          setGender(args.gender);
          setMode(args.mode);
          setStyleKey(args.styleKey);
          setUseBazi(args.useBazi);
          setDate(args.date);
          setShichen(args.shichen);
          setPoetrySource(args.poetrySource);
          setZodiac(args.zodiac);
          setMustChar(args.must);
          setNonce(args.seed);
          void run(args);
        }}
        onRemove={onRemove}
        onClear={onClearTab}
      />

      {/* M25：我的收藏弹层 */}
      <MingFavoritesModal
        open={favOpen}
        onClose={() => setFavOpen(false)}
        favs={favApi.favs}
        onClear={favApi.clear}
        onApply={(f) => {
          const m = (f.mode === 'poetry' || f.mode === 'zodiac' || f.mode === 'dict' ? f.mode : 'style') as QimingArgs['mode'];
          setSurname(f.surname);
          setGender(f.gender);
          setMode(m);
          void run({ surname: f.surname, gender: f.gender, mode: m });
        }}
      />
      {/* M26：多名字横向对比弹层 */}
      <MingCompareModal open={cmpOpen} onClose={() => setCmpOpen(false)} items={compare} />

    </div>
  );
}

/* ============================ 字典 · 起名辅助弹窗 ============================ */
const ZIDIAN_HISTORY_KEY = 'om_zidian_history';
const ZIDIAN_HISTORY_LIMIT = 8;

interface ZidianHistoryItem {
  char: string;
  summary: string;
  time: number;
}

function readZidianHistory(): ZidianHistoryItem[] {
  try {
    const raw = storage.getItem(ZIDIAN_HISTORY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ZidianHistoryItem[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeZidianHistory(list: ZidianHistoryItem[]): void {
  try {
    storage.setItem(ZIDIAN_HISTORY_KEY, JSON.stringify(list.slice(0, ZIDIAN_HISTORY_LIMIT)));
  } catch {
    /* ignore */
  }
}

function ZidianModal({
  open,
  char,
  onClose,
  onJump,
}: {
  open: boolean;
  char: string;
  onClose: () => void;
  onJump?: (tab: MingTab, params?: Record<string, string>) => void;
}) {
  const [input, setInput] = useState('');
  const [res, setRes] = useState<CharDictResult | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ZidianHistoryItem[]>([]);

  // 弹窗挂载后读本地最近查字历史
  useEffect(() => {
    setHistory(readZidianHistory());
  }, []);

  // 弹窗打开且带初始字时自动查询
  useEffect(() => {
    if (!open) return;
    if (char) {
      setInput(char);
      void run(char);
    }
  }, [open, char]);

  // 弹窗关闭时清空结果，避免下次打开先闪旧内容
  useEffect(() => {
    if (!open) {
      setRes(null);
      setErr('');
      setInput('');
    }
  }, [open]);

  const run = async (charOverride?: string) => {
    const target = (charOverride ?? input).trim();
    setErr('');
    if (!/[㐀-鿿]/.test(target)) {
      setErr('请输入一个汉字');
      return;
    }
    setLoading(true);
    const t0 = performance.now();
    try {
      const r = await lookupCharDict(target);
      setRes(r);
      setInput(r.char);
      setHistory((prev) => {
        const next = [
          { char: r.char, summary: `${r.element}行 ${r.strokes}画`, time: Date.now() },
          ...prev.filter((h) => h.char !== r.char),
        ].slice(0, ZIDIAN_HISTORY_LIMIT);
        writeZidianHistory(next);
        return next;
      });
      track('ming', 'zidian.run', {
        ok: true, char: r.char, element: r.element,
        latencyMs: Math.round(performance.now() - t0),
      });
    } catch (e: any) {
      setErr(e?.message || '查询失败');
      track('ming', 'zidian.run', { ok: false, reason: e?.message || 'unknown' });
    } finally {
      setLoading(false);
    }
  };

  const sameChars = res ? pickSameElementChars(res.element, res.char, 3) : [];

  const content = (
    <div className="ming-panel ming-modal-panel">
      <div className="ming-zidian-search">
        <p className="dream-search-hint">输入汉字查询笔画、五行属性、字义释义与同字名人参考。</p>
        <div className="ming-row">
          <input
            className="form-input ming-input field-pill"
            maxLength={4}
            placeholder="如：瑞 / 涵 / 梓"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
          <button className="btn-submit ming-btn" onClick={() => run()} disabled={loading}>
            {loading ? '查询中…' : '查字'}
          </button>
        </div>
        <SamplesRow
          items={ZIDIAN_SAMPLES}
          onPick={(p) => {
            track('ming', 'sample.use', { tab: 'zidian' });
            setInput(p.c);
            void run(p.c);
          }}
        />
        {err && <div className="ming-err">{err}</div>}

        {history.length > 0 && (
          <div className="ming-history-bar">
            <span className="ming-history-label">最近查字</span>
            <div className="ming-history-scroll">
              {history.slice(0, ZIDIAN_HISTORY_LIMIT).map((h) => (
                <button
                  key={h.time}
                  className="ming-history-chip"
                  onClick={() => {
                    setInput(h.char);
                    void run(h.char);
                  }}
                  title={h.summary}
                >
                  <span className="ming-history-char">{h.char}</span>
                  <span className="ming-history-sum">{h.summary}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && !res && <OmLoading label="正在查字…" mode="inline" />}

      {res && (
        <div className="ming-zidian-result">
          <div className="ming-dict-head">
            <div className="ming-dict-char">{res.char}</div>
            <div className="ming-dict-meta">
              <span className="ming-badge" style={{ color: 'var(--primary-light)' }}>{res.element} 行</span>
              <span className="ming-badge muted">{res.strokes} 画</span>
              {res.pinyin && <span className="ming-badge muted">拼音 {res.pinyin}</span>}
              {res.gender && <span className="ming-badge muted">宜{res.gender}</span>}
            </div>
          </div>

          {/* 字义详解 */}
          <div className="ming-block ming-detail-card">
            <div className="ming-block-label">字义详解</div>
            <div className="ming-block-text">
              {res.meaning
                ? `「${res.char}」：${res.meaning}。此字${res.strokes}画，属${res.element}行；${res.wxNote || '于姓名学中寓意温和，宜搭配音律和谐之字取名。'}`
                : `「${res.char}」字义暂未收录，按${res.strokes}画、${res.element}行推演。${res.wxNote || ''}`}
            </div>
          </div>

          <div className="ming-block">
            <div className="ming-block-label">五行属性</div>
            <div className="ming-block-text">{res.wxNote || '（暂无补注）'}</div>
          </div>

          {/* 文化延展：组词 / 成语 / 典故 */}
          {(res.words.length > 0 || res.idiom || res.allusion) && (
            <div className="ming-block ming-culture-card">
              <div className="ming-block-label">文化延展</div>
              {res.words.length > 0 && (
                <div className="ming-culture-row">
                  <span className="ming-culture-key">组词</span>
                  <span className="ming-culture-val">{res.words.join('、')}</span>
                </div>
              )}
              {res.idiom && (
                <div className="ming-culture-row">
                  <span className="ming-culture-key">成语</span>
                  <span className="ming-culture-val">{res.idiom}</span>
                </div>
              )}
              {res.allusion && (
                <div className="ming-culture-row">
                  <span className="ming-culture-key">典故</span>
                  <span className="ming-culture-val ming-culture-allusion">{res.allusion}</span>
                </div>
              )}
            </div>
          )}

          {/* 入名宜忌 */}
          {res.nameFit && (
            <div className="ming-block ming-namefit-card">
              <div className="ming-block-label">入名宜忌</div>
              <div className="ming-block-text">
                <span className="ming-badge" style={{ color: JI_COLOR[res.nameFit.fit === '宜' ? '吉' : res.nameFit.fit === '中性' ? '半吉' : '凶'] }}>
                  {res.nameFit.fit}入名
                </span>
                <span style={{ marginLeft: 8 }}>{res.nameFit.text}</span>
              </div>
            </div>
          )}

          {/* 同五行字推荐 */}
          {sameChars.length > 0 && (
            <div className="ming-block ming-extend-card">
              <div className="ming-block-label">同五行好字推荐</div>
              <div className="ming-extend-list">
                {sameChars.map((c) => (
                  <span className="ming-badge ming-extend-chip" key={c.char} style={{ color: ELEMENT_COLOR[res.element] }}>
                    {c.char} · {c.meaning}
                  </span>
                ))}
              </div>
            </div>
          )}

          {res.famous.length > 0 && (
            <div className="ming-block">
              <div className="ming-block-label">同字名人</div>
              <div className="ming-dict-famous">
                {res.famous.map((f) => (
                  <span className="ming-badge" key={f}>{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* 跨模块联动：查到一个好字，测它的象 / 直接拿去起名 */}
          <div className="ming-jump-row">
            <span className="ming-jump-label">接着做：</span>
            <button type="button" className="ming-jump-btn" onClick={() => { onClose(); onJump?.('cezi', { c: res.char }); }}>
              测「{res.char}」字象
            </button>
            <button type="button" className="ming-jump-btn" onClick={() => { onClose(); onJump?.('qiming', { m: 'dict', mc: res.char }); }}>
              用「{res.char}」起名（字典）
            </button>
            <button type="button" className="ming-jump-btn" onClick={() => { const c = pickRandomChar(res.char); void run(c); }} disabled={loading}>
              🎲 换一个字
            </button>
          </div>

          <MingAIPanel
            cacheKey={`zidian:${res.char}`}
            message={`请解读汉字「${res.char}」的字义、五行属性（${res.element}行，${res.strokes}画）及在姓名学中的寓意和适用性。`}
            title="小玄帮你查字典"
            chips={['这个字适合给男孩还是女孩取名？', '有没有更好的同义字推荐？', '它和哪些字搭配成好名？']}
          />

          <MingActions
            title={`玄镜字典 · ${res.char}`}
            markdown={buildZidianReport(res)}
            posterKeyword={`字典 · ${res.char}`}
            posterContext={`「${res.char}」：${res.element}行，${res.strokes}画。${res.meaning || ''}`}
          />

          <div className="ming-disclaimer">{DISCLAIMER}</div>
        </div>
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} icon="📖" title="起名字典" variant="default">
      <div className="ming-zidian-modal-body">{content}</div>
    </Modal>
  );
}

/* ============================ 测字起名小知识卡片 ============================ */
const KNOWLEDGE_CARDS = [
  {
    title: '五格剖象法',
    body: '五格剖象法由日本熊崎健翁所创，以姓名笔画推演天格、人格、地格、外格、总格五格数理（1-81），再配三才五行，论一生运势。人格为核心主轴，总格主中晚年。其说源自易理数术，流传甚广，理应辩证取信。',
  },
  {
    title: '五行起名原理',
    body: '五行起名以汉字五行（金木水火土）配八字所缺，补偏救弊。常用之法：八字缺水者取「氵」「雨」字，缺木者取「木」「艹」字；亦可按字形字义归类。重在五行流通、生生不息，非一味堆砌。',
  },
  {
    title: '生肖喜忌用字',
    body: '十二生肖各有习性，传统起名据其喜忌取字根。如鼠喜「宀」覆护、喜五谷「禾米豆」；虎为山君宜「山木」；兔为月精宜「月」；龙喜「水日月」；蛇喜「宀」隐栖。意在图吉利、合习性，民俗趣味为多。',
  },
  {
    title: '诗词起名典故',
    body: '诗词起名取自《诗经》《楚辞》、唐诗宋词，以原句佳字入名，自带文化底蕴。如「蒹葭」取「露」、「采薇」取「依」、「离骚」取「正则」。宜辨性别与寓意，忌断章取义、避悲苦之句，方称雅驯。',
  },
];

/* ============================ 主页面 ============================ */
const MING_TABS: { key: MingTab; label: string; icon: string }[] = [
  { key: 'cezi', label: '测字', icon: 'type' },
  { key: 'name', label: '姓名', icon: 'user' },
  { key: 'qiming', label: '起名', icon: 'pen-tool' },
  { key: 'hehun', label: '合婚', icon: 'heart-handshake' },
];

export default function MingPage() {
  /** 初始固定为 'cezi'：SSR 与 CSR 首屏必须一致，否则触发 hydration 报错。
   *  真正的 URL 深链（?t=qiming 等）放到挂载后的 useEffect 里同步，
   *  这样服务端无 window 时也能渲染出稳定首屏，客户端挂载后再切到目标 tab。 */
  const [tab, setTab] = useState<MingTab>('cezi');
  useEffect(() => {
    const t = readMingUrl().get('t');
    if (t && MING_TABS.some((x) => x.key === t)) setTab(t as MingTab);
  }, []);
  /**
   * 跨 Tab 跳转的预填参数。
   * 面板按 Tab 卸载/挂载，无法直接 setXxx，因此由页面层保存「种子」，
   * 目标面板挂载时读取并优先于本地存档恢复。
   */
  const [pending, setPending] = useState<{ tab: MingTab; params: Record<string, string> } | null>(null);
  const { history, add, remove, clearTab } = useMingHistory();

  /** 字典：从顶部 Tab 改为起名流程内的辅助弹窗 */
  const [zidianOpen, setZidianOpen] = useState(false);
  const [zidianChar, setZidianChar] = useState('');
  const openZidian = useCallback((char: string) => {
    track('ming', 'zidian.open', { char });
    setZidianChar(char);
    setZidianOpen(true);
  }, []);
  const closeZidian = useCallback(() => {
    setZidianOpen(false);
    setZidianChar('');
  }, []);

  const jump = useCallback((to: MingTab, params: Record<string, string> = {}) => {
    track('ming', 'cross_jump', { to, keys: Object.keys(params).join(',') || '-' });
    setPending({ tab: to, params });
    setTab(to);
  }, []);

  const switchTab = (t: MingTab) => {
    if (t !== tab) track('ming', 'tab.switch', { tab: t });
    // 用户手动切 Tab 就作废跳转种子：否则回到目标 Tab 会一直被旧种子覆盖
    setPending(null);
    setTab(t);
  };

  /** 只有目标 Tab 才拿得到种子，避免串台 */
  const seedOf = (t: MingTab): Record<string, string> | undefined =>
    pending?.tab === t ? pending.params : undefined;

  return (
    <div className="page active ming-page-wrap" id="page-ming">
      {/* 八卦纹样背景装饰 */}
      <div className="ming-bagua-bg" aria-hidden>
        {BAGUA_SYMBOLS.map((s, i) => (
          <span key={i}>{s}</span>
        ))}
        {BAGUA_SYMBOLS.map((s, i) => (
          <span key={`b-${i}`}>{s}</span>
        ))}
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">🔮 测字 · 姓名 · 起名 · 合婚</div>
          <div className="page-subtitle">一字观象、五格测名、智能起名、八字合婚——传统民俗文化的一站式趣味推演</div>
        </div>
      </div>

      <div className="ming-tabs">
        {MING_TABS.map((t) => (
          <button
            key={t.key}
            className={'ming-tab' + (tab === t.key ? ' active' : '')}
            onClick={() => switchTab(t.key)}
          >
            <SectionIcon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      <IntroCard />

      <MingPageChat tab={tab} />

      {tab === 'cezi' && <CeziPanel active={tab === 'cezi'} history={history} onAdd={add} onRemove={remove} onClearTab={() => clearTab('cezi')} onJump={jump} seed={seedOf('cezi')} onZidian={openZidian} />}
      {tab === 'name' && <NamePanel active={tab === 'name'} history={history} onAdd={add} onRemove={remove} onClearTab={() => clearTab('name')} onJump={jump} seed={seedOf('name')} onZidian={openZidian} />}
      {tab === 'qiming' && <QimingPanel active={tab === 'qiming'} history={history} onAdd={add} onRemove={remove} onClearTab={() => clearTab('qiming')} onJump={jump} onZidian={openZidian} seed={seedOf('qiming')} />}
      {tab === 'hehun' && <HehunPanel active={tab === 'hehun'} history={history} onAdd={add} onRemove={remove} onClearTab={() => clearTab('hehun')} onJump={jump} seed={seedOf('hehun')} />}

      <ZidianModal open={zidianOpen} char={zidianChar} onClose={closeZidian} onJump={jump} />

      {/* 页面底部 · 测字起名小知识 */}
      <div className="mood-tracker ming-knowledge-section">
        <div className="result-card-title">测字起名小知识</div>
        <div className="ming-knowledge-grid">
          {KNOWLEDGE_CARDS.map((k) => (
            <div className="ming-knowledge-card" key={k.title}>
              <div className="ming-knowledge-title">{k.title}</div>
              <div className="ming-knowledge-body">{k.body}</div>
            </div>
          ))}
        </div>
      </div>

      <CrossPageLink
        links={[
          { icon: '☯️', label: '前往卜卦排盘', href: '/bugua' },
          { icon: '📋', label: '生成综合报告', href: '/report', variant: 'primary' },
        ]}
      />
    </div>
  );
}
