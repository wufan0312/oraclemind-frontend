'use client';

import '@/styles/horoscope.scss';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
// 逐文件导入，不走 components/ui/index.ts 这个 barrel：
// 否则只需 7 个组件却要把全部 14 个组件（含 RegionPicker 等）拖进本路由
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import OmLoading from '@/components/ui/OmLoading';
import CrossPageLink from '@/components/ui/CrossPageLink';
import SectionIcon from '@/components/ui/SectionIcon';
import { DatePicker, TimePicker } from '@/components/ui/DateTimePicker';
import BirthDatePicker from '@/components/ui/BirthDatePicker';
import type { BirthValue } from '@/components/ui/BirthDatePicker';
import Cascader from '@/components/ui/Cascader';
import Select from '@/components/ui/Select';
import { StreamingText } from '@/components/ui/StreamingText';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import NatalChart from '@/components/NatalChart';
import LightFollowUp from '@/components/ai-chat/LightFollowUp';
import PremiumUnlockButton from '@/components/premium/PremiumUnlockButton';
import {
  requestNatalChart,
  requestNatalReport,
  requestAstroForecast,
  requestSynastry,
  requestTransits,
  requestSolarReturn,
  requestSolarReturnReport,
  type AstroBirth,
  type NatalChart as NatalChartData,
  type AstroReportData,
  type AstroForecastData,
  type SynastryData,
  type AstroTransit,
  type AstroComposite,
  type AstroMeta,
} from '@/lib/api';
import { shichenToHHmm, hhmmToShichen } from '@/lib/shichen';
import { getAstroCache, setAstroCache } from '@/lib/astroCache';
import { pushCrossReading } from '@/lib/crossReadings';
import { mdToHtml } from '@/lib/markdown';
import { printDocument } from '@/lib/print';
import { ZODIAC_SIGNS, QUICK_HOROSCOPES, getSunSign, type ZodiacSign } from '@/data/zodiacData';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';
type Tab = 'report' | Period;

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'report', label: '本命盘解读', icon: '🌟' },
  { key: 'daily', label: '每日运势', icon: '📅' },
  { key: 'weekly', label: '每周运势', icon: '📆' },
  { key: 'monthly', label: '每月运势', icon: '🗓️' },
  { key: 'yearly', label: '年度运势', icon: '🎆' },
];

const PERIOD_LABEL: Record<Period, string> = { daily: '今日', weekly: '本周', monthly: '本月', yearly: '本年' };

/**
 * 出生地时区偏移（小时）。
 * 本页出生地选择器覆盖中国 34 个省级行政区，全境采用北京时间（东八区），故恒为 8。
 * 占星计算必须把本地时间按此偏移换算为 UT，否则上升点与宫位会整体偏移约 120°。
 * 注意：中国已于 1991 年后停止实行夏令时；1986-1991 期间出生的用户需自行将时间减去 1 小时。
 */
const BIRTH_UTC_OFFSET = 8;

const ELEMENT_COLOR: Record<string, string> = { '火': '#E24B4A', '土': '#BA7517', '风': '#5CE1E6', '水': '#378ADD' };
/** 相位列表默认展示条数，超出部分可展开（此前硬截 16 条且无入口） */
const ASPECT_PREVIEW = 8;
/** 庙旺落陷简写（用于行星表角标） */
const DIGNITY_SHORT: Record<string, string> = { ruler: '庙', exalt: '旺', detriment: '弱', fall: '陷' };
const DIGNITY_FULL: Record<string, string> = { ruler: '入庙', exalt: '曜升', detriment: '失势', fall: '落陷' };

/** 每日轮转种子（让速选运势每日微调） */
function getDailySeed(signKey: string): number {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const seedMap: Record<string, number> = {
    aries: 1, taurus: 2, gemini: 3, cancer: 4, leo: 5, virgo: 6,
    libra: 7, scorpio: 8, sagittarius: 9, capricorn: 10, aquarius: 11, pisces: 12,
  };
  // 括号不能省：`??` 优先级低于 `+`，写成 `seedMap[k] ?? 1 + dayOfYear` 会被解析为
  // `seedMap[k] ?? (1 + dayOfYear)`，而 seedMap 恒命中 → dayOfYear 永远不参与，
  // 12 星座每日评分变成固定值，「每日轮转」名存实亡。
  return ((seedMap[signKey] ?? 1) + dayOfYear) % 5;
}

/**
 * 解读来源标签：让用户知道当前这段文字是 AI 生成的、缓存的，还是本地模板降级的。
 * 后端 meta 一直返回这些字段，但前端从未渲染 —— LLM 不可用时用户会以为看到的是
 * AI 为自己算的命盘，实际只是通用套话。
 */
function MetaBadge({ meta }: { meta: AstroMeta | null }) {
  // 产品要求：全站不再展示「AI 生成 / 缓存命中 / 本地降级」等来源标签
  return null;
}

/**
 * 星盘明细手风琴：把「十大星体落座落宫 / 主要相位 / 小行星虚点 / 十二宫位」等
 * 区块统一为可折叠分组。一次只展开一个（经典手风琴），默认展开首项。
 * 内容始终挂载（仅用 grid-template-rows 做高度过渡），便于平滑展开/收起。
 */
type AccSection = { key: string; title: ReactNode; content: ReactNode };
function AstroAccordion({ sections, defaultKey }: { sections: AccSection[]; defaultKey?: string }) {
  const [openKey, setOpenKey] = useState(defaultKey ?? sections[0]?.key ?? '');
  if (sections.length === 0) return null;
  return (
    <div className="astro-accordion">
      {sections.map((s) => {
        const open = openKey === s.key;
        return (
          <div className={`acc-item${open ? ' open' : ''}`} key={s.key}>
            <button
              type="button"
              className="acc-header"
              onClick={() => setOpenKey(open ? '' : s.key)}
              aria-expanded={open}
            >
              <span className="acc-title">{s.title}</span>
              <span className="acc-chevron" aria-hidden>▾</span>
            </button>
            <div className="acc-body">
              <div className="acc-body-inner">{s.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 星盘 / 返照盘「综述」一栏 —— 后端 \n 分行（astro._build_natal_summary）。
 * 后端把每项独立一行（共 ~16 行），这里默认折叠前 N 行 + 「展开全文」按钮，
 * 避免一坨看不出层次。展开时再保留 \n。
 *
 * 每行后面挂一句「简短解说」，基于 SUMMARY_NOTES 行首关键词匹配：
 *   「上升星座：天秤座（27°41'）」→「—— 外在形象 · 第一印象的投射」
 * 解说基于全占星共识（占星通用词典），不依赖 LLM，可即时生效。
 */
const SUMMARY_NOTES: ReadonlyArray<{ re: RegExp; note: string }> = [
  { re: /^上升星座[：:]/,        note: '外在形象 · 第一印象的投射' },
  { re: /^中天（MC）[：:]/,      note: '事业顶点 · 社会形象的取向' },
  { re: /^天底（IC）[：:]/,      note: '内在根基 · 家庭与私密自我' },
  { re: /^下降（DSC）[：:]/,     note: '亲密关系 · 合作与伴侣镜像' },
  // 「太阳：白羊座　月亮：射手座」合并行 —— 行首匹配
  { re: /^太阳[：:]/,            note: '核心自我 · 生命力与意志' },
  { re: /^月亮[：:]/,            note: '情绪本能 · 内在需求' },
  // 星体行：带 glyph 的「太阳（☉）落XX座 第N宫」
  { re: /^太阳（☉）/,            note: '核心自我 · 生命力与意志' },
  { re: /^月亮（☽）/,            note: '情绪本能 · 内在需求' },
  { re: /^水星（☿）/,            note: '思维与沟通的方式' },
  { re: /^金星（♀）/,            note: '爱、审美、价值观与社交' },
  { re: /^火星（♂）/,            note: '行动力、欲望与攻击性' },
  { re: /^木星（♃）/,            note: '信念、扩展与机遇' },
  { re: /^土星（♄）/,            note: '纪律、责任与长期考验' },
  { re: /^天王星（♅）/,          note: '革新、个性与突变' },
  { re: /^海王星（♆）/,          note: '灵感、梦境与灵性' },
  { re: /^冥王星（♇）/,          note: '深层转化与权力' },
  { re: /^北交点（☊）/,          note: '今生走向的方向 · 灵魂功课' },
  { re: /^南交点（☋）/,          note: '前世熟悉的模式 · 舒适圈' },
  { re: /^莉莉丝（⚸）/,          note: '被压抑的暗面力量' },
  { re: /^凯龙（⚷）/,            note: '核心创伤与疗愈' },
  { re: /^主要相位[：:]/,        note: '行星间能量交织的关键节点' },
];

function pickSummaryNote(line: string): string | null {
  for (const item of SUMMARY_NOTES) {
    if (item.re.test(line)) return item.note;
  }
  return null;
}

function AstroSummary({
  text,
  expanded,
  onToggle,
  preview = 4,
}: {
  text: string;
  expanded: boolean;
  onToggle: () => void;
  preview?: number;
}) {
  const lines = useMemo(() => text.split('\n').map((s) => s.trim()).filter(Boolean), [text]);
  if (lines.length === 0) return null;
  const visible = expanded ? lines : lines.slice(0, preview);
  return (
    <>
      <p className="chart-summary">
        {visible.map((line, i) => {
          const note = pickSummaryNote(line);
          return (
            <span key={i} className="cs-line">
              <span className="cs-text">{line}</span>
              {note && <em className="cs-note">— {note}</em>}
              {i < visible.length - 1 && '\n'}
            </span>
          );
        })}
      </p>
      {lines.length > preview && (
        <button
          type="button"
          className="aspect-toggle cs-toggle"
          onClick={onToggle}
          aria-label={expanded ? '收起综述' : '展开全部综述'}
          title={expanded ? '收起' : `展开全文 ${lines.length} 条`}
        >
          {expanded ? `收起（${lines.length} 条）` : `展开全文（${lines.length} 条）`}
        </button>
      )}
    </>
  );
}

export default function HoroscopePage() {
  const router = useRouter();
  const { birth: visitorBirth, setBirth } = useVisitor();

  // ===== 出生信息表单（从缓存读取） =====
  // 默认留空：用户没填过就显示占位符，不塞示例值（示例值删掉刷新后又会回来）
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [province, setProvince] = useState('上海市');
  const [cityName, setCityName] = useState('黄浦区');
  const [cityLat, setCityLat] = useState(31.2304);
  const [cityLng, setCityLng] = useState(121.4737);

  const birthSyncedRef = useRef(false);
  useEffect(() => {
    if (visitorBirth && !birthSyncedRef.current) {
      birthSyncedRef.current = true;
      if (visitorBirth.date) setBirthDate(visitorBirth.date);
      if (visitorBirth.time) setBirthTime(shichenToHHmm(visitorBirth.time));
      if (visitorBirth.province) setProvince(visitorBirth.province);
      if (visitorBirth.city) setCityName(visitorBirth.city);
      if (typeof visitorBirth.lat === 'number') setCityLat(visitorBirth.lat);
      if (typeof visitorBirth.lng === 'number') setCityLng(visitorBirth.lng);
    }
  }, [visitorBirth]);

  const [houseSystem, setHouseSystem] = useState<'equal' | 'whole'>('equal');
  const [birthTimeUnknown, setBirthTimeUnknown] = useState(false);

  const birth: AstroBirth = useMemo(
    () => ({
      birthDate,
      birthTime,
      latitude: cityLat,
      longitude: cityLng,
      houseSystem,
      unknownTime: birthTimeUnknown,
      utcOffset: BIRTH_UTC_OFFSET,
    }),
    [birthDate, birthTime, cityLat, cityLng, houseSystem, birthTimeUnknown]
  );

  /**
   * 已生成结果所用的参数快照。
   * 宫制、出生时间未知这类参数不改变「是谁」却改变「算出来是什么」，
   * 若不在参数变化时提醒用户，屏幕上会一直挂着旧盘且毫无提示。
   */
  const birthKey = useMemo(() => JSON.stringify(birth), [birth]);
  const generatedKeyRef = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!generatedKeyRef.current) return;   // 尚未生成过任何结果
    setDirty(generatedKeyRef.current !== birthKey);
  }, [birthKey]);

  /** 返照年份；缺省由后端取当前年（旧版前端无法选择，后端又恒返回「出生年+1」） */
  const [srYear, setSrYear] = useState<number>(new Date().getFullYear());

  /** 可选返照年份：出生次年 ~ 当前年 +5，倒序。引擎支持 1885-2098 */
  const srYearOptions = useMemo(() => {
    const by = Number(birthDate.slice(0, 4)) || new Date().getFullYear() - 30;
    const now = new Date().getFullYear();
    const from = Math.max(by + 1, 1885);
    const to = Math.min(now + 5, 2098);
    const out: number[] = [];
    for (let y = to; y >= from; y--) out.push(y);
    return out;
  }, [birthDate]);

  // 返照年份随出生年份变化后需钳制回合法区间
  useEffect(() => {
    if (srYearOptions.length && !srYearOptions.includes(srYear)) {
      setSrYear(srYearOptions[0]);
    }
  }, [srYearOptions, srYear]);

  // 统一保存出生信息（含地址）到访客缓存
  const syncBirthToVisitor = useCallback((overrides: Partial<{ date: string; time: string; gender: string; province: string; city: string; lat: number; lng: number }> = {}) => {
    const next = {
      date: overrides.date ?? birthDate,
      time: hhmmToShichen(overrides.time ?? birthTime),
      gender: visitorBirth?.gender,
      province: overrides.province ?? province,
      city: overrides.city ?? cityName,
      lat: overrides.lat ?? cityLat,
      lng: overrides.lng ?? cityLng,
    };
    setBirth(next);
  }, [birthDate, birthTime, province, cityName, cityLat, cityLng, visitorBirth, setBirth]);

  const onBirthDateChange = (v: string) => {
    setBirthDate(v);
    syncBirthToVisitor({ date: v });
  };
  /** 出生日期统一入口（BirthDatePicker）：产出 {date(公历), lunarYear/Month/Day, mode}。
   *  西方占星本命盘必须按公历排盘，故只取 v.date；农历分量一并落库便于其他模块复用。 */
  const onBirthValueChange = (v: BirthValue) => {
    setBirthDate(v.date);
    syncBirthToVisitor({
      date: v.date,
      ...(v.lunarYear ? { lunarYear: v.lunarYear, lunarMonth: v.lunarMonth, lunarDay: v.lunarDay } : {}),
    } as Parameters<typeof syncBirthToVisitor>[0]);
  };
  const onBirthTimeChange = (v: string) => {
    setBirthTime(v);
    syncBirthToVisitor({ time: v });
  };

  // ===== 访客太阳星座 =====
  const visitorSign = useMemo(() => {
    if (!birthDate) return null;
    const [y, m, d] = birthDate.split('-').map(Number);
    if (!m || !d) return null;
    return getSunSign(m, d);
  }, [birthDate]);

  // ===== 12 星座速选：用户可切换查看任意星座，默认选中访客星座 =====
  const [selectedSign, setSelectedSign] = useState<ZodiacSign | null>(null);
  const syncedVisitorKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visitorSign) return;
    // 当访客星座首次确定或发生变化时，自动将选中重置为访客星座
    if (syncedVisitorKeyRef.current !== visitorSign.key) {
      syncedVisitorKeyRef.current = visitorSign.key;
      setSelectedSign(visitorSign);
    }
  }, [visitorSign]);

  // ===== 配对合盘 =====
  // 配对合盘 B 方信息：默认留空，用户自己填
  const [synDate2, setSynDate2] = useState('');
  const [synTime2, setSynTime2] = useState('');
  const [synProvince2, setSynProvince2] = useState('');
  const [synCity2, setSynCity2] = useState('');
  const [synLat2, setSynLat2] = useState(0);
  const [synLng2, setSynLng2] = useState(0);
  const [synUnknownTime2, setSynUnknownTime2] = useState(false);
  const [synastry, setSynastry] = useState<SynastryData | null>(null);
  const [synLoading, setSynLoading] = useState(false);
  const [synError, setSynError] = useState<string | null>(null);

  // ===== 本命盘 =====
  const [chart, setChart] = useState<NatalChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // ===== 真实天象交相（按周期） =====
  const [transits, setTransits] = useState<Record<Period, AstroTransit[] | null>>({
    daily: null, weekly: null, monthly: null, yearly: null,
  });
  // ===== 太阳返照盘 =====
  const [solarReturn, setSolarReturn] = useState<NatalChartData | null>(null);
  const [srLoading, setSrLoading] = useState(false);

  // ===== 解读来源标注（是否 AI 生成 / 是否降级 / 是否缓存） =====
  // 后端 meta 一直有这些字段，但前端从未渲染，导致 LLM 降级成模板文案时用户毫无察觉
  const [reportMeta, setReportMeta] = useState<AstroMeta | null>(null);
  const [forecastMeta, setForecastMeta] = useState<Record<Period, AstroMeta | null>>({
    daily: null, weekly: null, monthly: null, yearly: null,
  });
  const [synMeta, setSynMeta] = useState<AstroMeta | null>(null);

  /** 相位列表是否展开（此前硬截 16 条且无入口） */
  const [aspectsExpanded, setAspectsExpanded] = useState(false);
  /** 综述（chart.summary / solarReturn.summary）是否展开，默认折叠前 4 行 */
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const SUMMARY_PREVIEW = 4;

  // ===== 本命盘导出 / 太阳返照 =====
  const exportChartReport = useCallback(() => {
    if (!chart) return;
    const ASTRO_DISCLAIMER = '以上内容由 AI 生成，仅供娱乐与传统文化参考，不构成任何决策、医疗或投资依据。';
    const lines: string[] = [];
    lines.push('# 本命星盘报告');
    lines.push('');
    lines.push(`出生：${chart.birth.birthDate} ${chart.birth.unknownTime ? '(时间未知)' : chart.birth.birthTime}　${cityName}`);
    lines.push(`宫制：${chart.houseSystem === 'whole' ? '整宫制' : '等宫制'}`);
    if (chart.ascendant) {
      lines.push(`上升：${chart.ascendant.sign}　中天：${chart.midheaven?.sign}　天底：${chart.immc?.sign}　下降：${chart.descendant?.sign}`);
    }
    lines.push(`太阳：${chart.sunSign.sign}　月亮：${chart.moonSign.sign}`);
    lines.push('');
    lines.push('## 十大星体');
    chart.planets.forEach((p) => lines.push(`- ${p.glyph} ${p.label}：${p.sign} ${p.degreeInSign}　第${p.house}宫${p.dignity ? '（' + DIGNITY_FULL[p.dignity] + '）' : ''}${p.retrograde ? ' 逆行' : ''}`));
    if (chart.extraPoints?.length) {
      lines.push('');
      lines.push('## 小行星 / 虚点');
      chart.extraPoints.forEach((p) => lines.push(`- ${p.glyph} ${p.label}：${p.sign} ${p.degreeInSign}　第${p.house}宫`));
    }
    if (chart.houses?.length) {
      lines.push('');
      lines.push(`## 十二宫位（共 ${chart.houses.length} 宫）`);
      chart.houses.forEach((h) => {
        const theme = h.theme ? `（${h.theme}）` : '';
        lines.push(`- 第${h.num}宫 ${h.name}${theme}：宫头 ${h.sign} ${h.cusp}°`);
      });
    }
    if (chart.aspects.length) {
      lines.push('');
      lines.push(`## 主要相位（共 ${chart.aspects.length} 条）`);
      chart.aspects.forEach((a) => lines.push(`- ${a.p1} ${a.type} ${a.p2}（${a.orb}°）`));
    }
    if (chart.summary) {
      lines.push('');
      lines.push('## 星盘综述');
      lines.push(chart.summary);
    }
    lines.push('');
    lines.push('> ' + ASTRO_DISCLAIMER);
    printDocument({ title: `本命星盘报告 · ${chart.birth.birthDate}`, html: mdToHtml(lines.join('\n')) });
  }, [chart, cityName]);

  // 太阳返照盘导出（结构与本命盘一致，年份区分文件名）
  const exportSrReport = useCallback(() => {
    if (!solarReturn) return;
    const ASTRO_DISCLAIMER = '以上内容由 AI 生成，仅供娱乐与传统文化参考，不构成任何决策、医疗或投资依据。';
    const lines: string[] = [];
    lines.push(`# 太阳返照盘报告 · ${solarReturn.solarReturnYear} 年`);
    lines.push('');
    lines.push(`出生：${solarReturn.birth.birthDate} ${solarReturn.birth.unknownTime ? '(时间未知)' : solarReturn.birth.birthTime}　${cityName}`);
    lines.push(`返照时刻：${solarReturn.solarReturnTime ?? '—'}`);
    lines.push(`宫制：${solarReturn.houseSystem === 'whole' ? '整宫制' : '等宫制'}`);
    if (solarReturn.ascendant) {
      lines.push(`上升：${solarReturn.ascendant.sign}　中天：${solarReturn.midheaven?.sign}　天底：${solarReturn.immc?.sign}　下降：${solarReturn.descendant?.sign}`);
    }
    lines.push(`太阳：${solarReturn.sunSign.sign}　月亮：${solarReturn.moonSign.sign}`);
    lines.push('');
    lines.push('## 十大星体');
    solarReturn.planets.forEach((p) => lines.push(`- ${p.glyph} ${p.label}：${p.sign} ${p.degreeInSign}　第${p.house}宫${p.dignity ? '（' + DIGNITY_FULL[p.dignity] + '）' : ''}${p.retrograde ? ' 逆行' : ''}`));
    if (solarReturn.extraPoints?.length) {
      lines.push('');
      lines.push('## 小行星 / 虚点');
      solarReturn.extraPoints.forEach((p) => lines.push(`- ${p.glyph} ${p.label}：${p.sign} ${p.degreeInSign}　第${p.house}宫`));
    }
    if (solarReturn.houses?.length) {
      lines.push('');
      lines.push(`## 十二宫位（共 ${solarReturn.houses.length} 宫）`);
      solarReturn.houses.forEach((h) => {
        const theme = h.theme ? `（${h.theme}）` : '';
        lines.push(`- 第${h.num}宫 ${h.name}${theme}：宫头 ${h.sign} ${h.cusp}°`);
      });
    }
    if (solarReturn.aspects.length) {
      lines.push('');
      lines.push(`## 主要相位（共 ${solarReturn.aspects.length} 条）`);
      solarReturn.aspects.forEach((a) => lines.push(`- ${a.p1} ${a.type} ${a.p2}（${a.orb}°）`));
    }
    if (solarReturn.summary) {
      lines.push('');
      lines.push('## 年度主题综述');
      lines.push(solarReturn.summary);
    }
    lines.push('');
    lines.push('> ' + ASTRO_DISCLAIMER);
    printDocument({ title: `太阳返照盘报告 · ${solarReturn.solarReturnYear} 年`, html: mdToHtml(lines.join('\n')) });
  }, [solarReturn, cityName]);

  const exportChartSvg = useCallback(() => {
    const svg = document.querySelector('.natal-chart-svg') as SVGSVGElement | null;
    if (!svg) return;
    const src = new XMLSerializer().serializeToString(svg);
    printDocument({
      title: `本命星盘图 · ${chart?.birth.birthDate || 'natal'}`,
      html: `<div class="chart-wrap">${src}</div>`,
    });
  }, [chart]);

  const loadSolarReturn = useCallback(async () => {
    setSrLoading(true);
    setSrError(null);
    try {
      const c = await requestSolarReturn(birth, srYear);
      setSolarReturn(c);
      // 返照盘生成后顺带拉取 AI 年度解读（此前完全缺失）
      loadSrReport(c);
      // 自动切到返照 tab 展示结果（已整合进本命盘卡片内，不再独立滚动）
      setChartViewTab('return');
    } catch (e: any) {
      setSrError(e?.message || '太阳返照计算失败');
    } finally {
      setSrLoading(false);
    }
  }, [birth, srYear]);

  // 太阳返照盘 AI 解读（年度主题）
  const [srReport, setSrReport] = useState<AstroReportData | null>(null);
  const [srReportLoading, setSrReportLoading] = useState(false);
  const [srReportMeta, setSrReportMeta] = useState<AstroMeta | null>(null);

  const loadSrReport = useCallback(async (sr?: NatalChartData | null) => {
    const target = sr ?? solarReturn;
    if (!target) return;
    setSrReportLoading(true);
    setSrReportMeta(null);
    try {
      const r = await requestSolarReturnReport(birth, target.solarReturnYear ?? srYear);
      setSrReport(r.data);
      setSrReportMeta(r.meta ?? null);
    } catch (e: any) {
      // 解读失败不影响盘本身，仅提示
      setSrReportError(e?.message || '返照盘解读生成失败');
    } finally {
      setSrReportLoading(false);
    }
  }, [birth, solarReturn, srYear]);

  const [srReportError, setSrReportError] = useState<string | null>(null);
  // 返照盘「计算」错误（独立于本命盘，原先误用 chartError 弹在页面顶部）
  const [srError, setSrError] = useState<string | null>(null);

  // ===== Tab 与解读数据 =====
  const [tab, setTab] = useState<Tab>('report');
  // 顶部主导航：本命星盘 / 星座配对 / 今日运势
  const [mode, setMode] = useState<'natal' | 'synastry' | 'daily'>('natal');
  // 本命盘 / 太阳返照 视图切换（同一张星盘卡片内 tab 切换）
  const [chartViewTab, setChartViewTab] = useState<'natal' | 'return'>('natal');
  const [report, setReport] = useState<AstroReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [forecast, setForecast] = useState<Record<Period, AstroForecastData | null>>({
    daily: null, weekly: null, monthly: null, yearly: null,
  });
  const [forecastLoading, setForecastLoading] = useState<Record<Period, boolean>>({
    daily: false, weekly: false, monthly: false, yearly: false,
  });
  const [forecastError, setForecastError] = useState<Record<Period, string | null>>({
    daily: null, weekly: null, monthly: null, yearly: null,
  });

  // ===== 流式输出控制 =====
  // report 流式：依次显示 overview → personality → love → career → health → advice
  const [reportStreamIdx, setReportStreamIdx] = useState(0);
  // forecast 流式
  const [forecastStreamIdx, setForecastStreamIdx] = useState(0);
  // synastry 流式
  const [synStreamIdx, setSynStreamIdx] = useState(0);
  // 命中缓存时跳过流式动画，直接显示
  const [reportSkipStream, setReportSkipStream] = useState(false);
  const [forecastSkipStream, setForecastSkipStream] = useState(false);
  const [synSkipStream, setSynSkipStream] = useState(false);
  // 合盘相位列表展开（此前硬截 10/6 条且无入口）
  const [synAspectsExpanded, setSynAspectsExpanded] = useState(false);
  const [synCompAspectsExpanded, setSynCompAspectsExpanded] = useState(false);

  // 首页小玄引导跳转：?q= 带来的问题，顶部提示条承接
  const [incomingQ, setIncomingQ] = useState('');
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get('q');
    if (q) {
      setIncomingQ(q);
      // 清掉地址栏参数，刷新时不再重复弹出
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const generateChart = useCallback(async () => {
    if (!birthDate) {
      setChartError('请先选择出生日期');
      return;
    }
    if (!birthTime && !birthTimeUnknown) {
      setChartError('请填写出生时间，或勾选「未知」');
      return;
    }
    // 记录本次生成所用的参数快照，并解除脏状态
    generatedKeyRef.current = birthKey;
    setDirty(false);

    setChartLoading(true);
    setChartError(null);
    setReport(null);
    setReportMeta(null);
    setForecastMeta({ daily: null, weekly: null, monthly: null, yearly: null });
    setReportStreamIdx(0);
    setReportSkipStream(false);
    setForecast({ daily: null, weekly: null, monthly: null, yearly: null });
    setForecastStreamIdx(0);
    setForecastSkipStream(false);
    setAspectsExpanded(false);
    setSummaryExpanded(false);

    // 只算盘：AI 解读（report）交给下方 useEffect 在用户切到 AI 解读 tab 时再懒加载，
    // 避免 generateChart 与 tab 切换的 useEffect 双发同一请求、白白烧一次 LLM token。
    const cachedChart = getAstroCache<NatalChartData>('chart', birth);

    if (cachedChart) {
      setChart(cachedChart);
      setChartLoading(false);
      return;
    }

    // chart 请求
    requestNatalChart(birth).then(c => {
      setChart(c);
      setAstroCache('chart', birth, c);
    }).catch(e => {
      setChartError(e?.message || '本命盘计算失败，请稍后重试');
    }).finally(() => setChartLoading(false));
  }, [birth, birthKey, birthDate, birthTime, birthTimeUnknown]);

  /**
   * 首次进入自动出盘（沿用旧行为）。
   * 出生信息可能由访客档案异步回填，所以要在信息齐全后才触发，且只触发一次；
   * 否则空日期会直接打后端报错。
   */
  const autoChartTriedRef = useRef(false);
  useEffect(() => {
    if (autoChartTriedRef.current) return;
    if (!birthDate || (!birthTime && !birthTimeUnknown)) return;
    if (chart || chartLoading) return;
    autoChartTriedRef.current = true;
    generateChart();
  }, [birthDate, birthTime, birthTimeUnknown, chart, chartLoading, generateChart]);

  const loadReport = useCallback(async () => {
    if (report || reportLoading) return;
    // 查缓存
    const cached = getAstroCache<AstroReportData>('report', birth);
    if (cached) {
      setReport(cached);
      setReportStreamIdx(99);
      setReportSkipStream(true);
      return;
    }
    setReportLoading(true);
    setReportError(null);
    setReportStreamIdx(0);
    setReportSkipStream(false);
    try {
      const r = await requestNatalReport(birth);
      setReport(r.data);
      setReportMeta(r.meta ?? null);
      setAstroCache('report', birth, r.data);
    } catch (e: any) {
      setReportError(e?.message || '解读生成失败');
    } finally {
      setReportLoading(false);
    }
  }, [birth, report, reportLoading]);

  /** 「换一版解读」：随机盐值绕开后端同 prompt 缓存，重新生成一份 */
  const regenerateReport = useCallback(async () => {
    if (tab !== 'report') setTab('report');
    setReportLoading(true);
    setReportError(null);
    setReportStreamIdx(0);
    setReportSkipStream(false);
    try {
      const salt = Math.random().toString(36).slice(2, 10);
      const r = await requestNatalReport(birth, salt);
      setReport(r.data);
      setReportMeta(r.meta ?? null);
      // 覆盖本地缓存：用户看到的「最新一版」成为下次默认
      setAstroCache('report', birth, r.data);
    } catch (e: any) {
      setReportError(e?.message || '解读生成失败');
    } finally {
      setReportLoading(false);
    }
  }, [birth, tab]);

  const loadForecast = useCallback(async (p: Period) => {
    if (forecast[p] || forecastLoading[p]) return;
    // 查缓存
    const cached = getAstroCache<AstroForecastData>('forecast', birth, p);
    if (cached) {
      setForecast((s) => ({ ...s, [p]: cached }));
      setForecastStreamIdx(99);
      setForecastSkipStream(true);
      return;
    }
    setForecastLoading((s) => ({ ...s, [p]: true }));
    setForecastError((s) => ({ ...s, [p]: null }));
    setForecastStreamIdx(0);
    setForecastSkipStream(false);
    try {
      const r = await requestAstroForecast(birth, p);
      setForecast((s) => ({ ...s, [p]: r.data }));
      setForecastMeta((s) => ({ ...s, [p]: r.meta ?? null }));
      setAstroCache('forecast', birth, r.data, p);
      // 真实天象交相（流年对本命盘）
      try {
        const t = await requestTransits(birth, p);
        setTransits((s) => ({ ...s, [p]: t.transits }));
      } catch { /* 天象非阻断 */ }
    } catch (e: any) {
      setForecastError((s) => ({ ...s, [p]: e?.message || '运势生成失败' }));
    } finally {
      setForecastLoading((s) => ({ ...s, [p]: false }));
    }
  }, [birth, forecast, forecastLoading]);

  useEffect(() => {
    if (!chart) return;
    if (tab === 'report') loadReport();
    else loadForecast(tab);
  }, [tab, chart, loadReport, loadForecast]);

  // 跨页融合：把本命盘概述写入共享池，供综合运势模块读取
  useEffect(() => {
    if (report?.overview) {
      pushCrossReading({ type: 'horoscope', label: '星座', summary: report.overview });
    }
  }, [report]);

  // ===== 配对合盘 =====
  const generateSynastry = useCallback(async () => {
    if (!birthDate) { setSynError('请先在上方完成你的出生信息'); return; }
    if (!synDate2) { setSynError('请选择 TA 的出生日期'); return; }
    if (!synTime2 && !synUnknownTime2) { setSynError('请填写 TA 的出生时间，或勾选「出生时间未知」'); return; }
    if (!synProvince2 || !synCity2) { setSynError('请选择 TA 的出生地区'); return; }
    setSynLoading(true);
    setSynError(null);
    setSynastry(null);
    setSynStreamIdx(0);
    setSynSkipStream(false);
    setSynAspectsExpanded(false);
    setSynCompAspectsExpanded(false);

    const birth2: AstroBirth = {
      birthDate: synDate2,
      birthTime: synUnknownTime2 ? '' : synTime2,
      latitude: synLat2,
      longitude: synLng2,
      houseSystem,
      unknownTime: synUnknownTime2 || undefined,
      utcOffset: BIRTH_UTC_OFFSET,
    };
    const cacheKey = `${birth.birthDate}_${synDate2}_${synUnknownTime2 ? 'unk' : synTime2}`;
    // 查缓存
    const cached = getAstroCache<SynastryData>('synastry', birth, cacheKey);
    if (cached) {
      setSynastry(cached);
      setSynStreamIdx(99);
      setSynSkipStream(true);
      setSynLoading(false);
      return;
    }
    try {
      const r = await requestSynastry(birth, birth2);
      setSynastry(r.data);
      setSynMeta(r.meta ?? null);
      setAstroCache('synastry', birth, r.data, cacheKey);
    } catch (e: any) {
      setSynError(e?.message || '合盘分析失败，请稍后重试');
    } finally {
      setSynLoading(false);
    }
  }, [birth, birthDate, synDate2, synTime2, synProvince2, synCity2, synLat2, synLng2, synUnknownTime2, houseSystem]);

  const quickData = selectedSign ? QUICK_HOROSCOPES[selectedSign.key] : null;
  const dailyOffset = selectedSign ? getDailySeed(selectedSign.key) : 0;

  // 星盘中出现的星座
  const chartSigns = useMemo(() => {
    if (!chart) return [];
    const signSet = new Set<string>();
    signSet.add(chart.sunSign.sign);
    signSet.add(chart.moonSign.sign);
    if (chart.ascendant) signSet.add(chart.ascendant.sign);
    chart.planets.forEach((p) => signSet.add(p.sign));
    return ZODIAC_SIGNS.filter((s) => signSet.has(s.name));
  }, [chart]);

  // 返照盘出现的星座（对齐本命盘的 chart-signs-row）
  const srChartSigns = useMemo(() => {
    if (!solarReturn) return [];
    const signSet = new Set<string>();
    signSet.add(solarReturn.sunSign.sign);
    signSet.add(solarReturn.moonSign.sign);
    if (solarReturn.ascendant) signSet.add(solarReturn.ascendant.sign);
    solarReturn.planets.forEach((p) => signSet.add(p.sign));
    return ZODIAC_SIGNS.filter((s) => signSet.has(s.name));
  }, [solarReturn]);

  // report 流式段落定义
  const reportSections = useMemo(() => {
    if (!report) return [];
    return [
      { title: '整体命格', text: report.overview },
      { title: '性格与天赋', text: report.personality },
      { title: '💕 情感与亲密关系', text: report.love },
      { title: '💼 事业与财富', text: report.career },
      { title: '🏃 健康与身心', text: report.health },
    ];
  }, [report]);

  // forecast 流式段落
  const forecastSections = useMemo(() => {
    if (tab === 'report') return [];
    const f = forecast[tab as Period];
    if (!f) return [];
    return [
      { title: `${PERIOD_LABEL[tab as Period]}整体基调`, text: f.overview },
      { title: '💕 爱情', text: f.love },
      { title: '💼 事业', text: f.career },
      { title: '🏃 健康', text: f.health },
    ];
  }, [forecast, tab]);

  // synastry 流式段落
  const synSections = useMemo(() => {
    if (!synastry) return [];
    return [
      { title: '💫 整体契合度', text: synastry.compatibility },
      { title: '💕 爱情模式', text: synastry.love },
      { title: '🗣️ 沟通互动', text: synastry.communication },
      { title: '⚡ 冲突与化解', text: synastry.conflict },
    ];
  }, [synastry]);

  // 当前解读纯文本（轻量追问上下文）：本命报告 + 当前运势 tab + 合盘
  const reportPlain = useMemo(() => {
    if (!report) return '';
    const parts = reportSections.map((s) => `【${s.title}】\n${s.text || ''}`);
    if (tab !== 'report') {
      parts.push(...forecastSections.map((s) => `【${s.title}】\n${s.text || ''}`));
    }
    if (synastry) {
      parts.push(...synSections.map((s) => `【${s.title}】\n${s.text || ''}`));
    }
    return parts
      .filter((p) => (p.split('\n')[1] || '').trim())
      .join('\n\n');
  }, [report, reportSections, forecastSections, synSections, tab, synastry]);

  return (
    <div className="page active" id="page-horoscope">
      <div className="page-header">
        <div>
          <div className="page-title">⭐ 星座 · 专业本命盘占星</div>
          <div className="page-subtitle">
            真实天文计算的本命星盘、运势预测、配对合盘
          </div>
        </div>
      </div>

      {incomingQ && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent-gold)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 20, lineHeight: 1.2 }}>🌟</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>小玄为你带来了一个问题</div>
            <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{incomingQ}</div>
          </div>
          <button onClick={() => setIncomingQ('')} aria-label="关闭" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* 顶部模式导航 */}
      <div className="mode-nav">
        <button className={`mode-tab${mode === 'natal' ? ' active' : ''}`} onClick={() => setMode('natal')}>
          <span className="mode-icon">★</span> 本命星盘
        </button>
        <button className={`mode-tab${mode === 'synastry' ? ' active' : ''}`} onClick={() => setMode('synastry')}>
          <span className="mode-icon">♊</span> 星座配对
        </button>
        <button className={`mode-tab${mode === 'daily' ? ' active' : ''}`} onClick={() => setMode('daily')}>
          <span className="mode-icon">☀</span> 今日运势
        </button>
      </div>

      {/* ===== 模式：今日运势（速选，无需出生信息） ===== */}
      {mode === 'daily' && (
      <div className="mode-panel">
      <section className="horo-section">
        {/* <div className="section-head"> 今日星座运势</div> */}
      {/* ===== 1. 今日星座速选（12 星座网格 + 选中星座详情） ===== */}
      <Card className="quick-horo-card">
        <div className="quick-horo-head">
          <div className="quick-horo-title"><svg className="iconfont" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> 今日星座运势</div>
          <div className="quick-horo-sub">
            {visitorSign
              ? `你的星座：${visitorSign.glyph} ${visitorSign.name} · ${visitorSign.dateRange}`
              : '请在下方填写出生日期以识别你的星座'}
          </div>
        </div>

        {/* 12 星座网格 */}
        <div className="quick-sign-grid">
          {ZODIAC_SIGNS.map((sign) => {
            const isVisitor = visitorSign?.key === sign.key;
            const isActive = selectedSign?.key === sign.key;
            return (
              <button
                key={sign.key}
                className={`qs-btn ${isActive ? 'active' : ''} ${isVisitor ? 'qs-visitor' : ''}`}
                onClick={() => setSelectedSign(sign)}
              >
                <span className="qs-glyph" style={{ color: sign.luckyColorHex }}>{sign.glyph}</span>
                <span className="qs-name">{sign.name}</span>
                <span className="qs-month">{sign.dateRange.split('月')[0]}月</span>
                {isVisitor && <span className="qs-badge">你的</span>}
              </button>
            );
          })}
        </div>

        {/* 选中星座的运势 + 百科详情 */}
        {selectedSign && quickData && (
          <div className="visitor-sign-panel" style={{ borderColor: selectedSign.luckyColorHex }}>
            <div className="vsp-glyph" style={{ color: selectedSign.luckyColorHex }}>{selectedSign.glyph}</div>
            <div className="vsp-body">
              <div className="vsp-head">
                <span className="vsp-name">{selectedSign.name}</span>
                <span className="vsp-keyword">{quickData.keyword}</span>
                <span className="vsp-element" style={{ color: ELEMENT_COLOR[selectedSign.element] }}>
                  {selectedSign.element}象 · {selectedSign.ruler}
                </span>
              </div>
              <div className="vsp-summary">{quickData.summary}</div>
              <div className="vsp-stars">
                <ScoreItem icon="💕" label="爱情" value={Math.min(5, quickData.love + (dailyOffset > 2 ? 1 : 0))} />
                <ScoreItem icon="💼" label="事业" value={Math.min(5, quickData.career + (dailyOffset > 1 && dailyOffset < 4 ? 1 : 0))} />
                <ScoreItem icon="💰" label="财运" value={quickData.wealth} />
                <ScoreItem icon="🏃" label="健康" value={Math.min(5, quickData.health + (dailyOffset > 3 ? 1 : 0))} />
              </div>
              <div className="vsp-lucky">
                <span className="vsl-item">🎲 幸运数字 <b>{quickData.luckyNumber}</b></span>
                <span className="vsl-item">🎨 幸运颜色 <b>{quickData.luckyColor}</b></span>
                <span className="vsl-item">🧭 幸运方位 <b>{quickData.luckyDirection}</b></span>
              </div>

              {/* 百科信息 */}
              <div className="vsp-wiki">
                <div className="vsp-wiki-section">
                  <div className="vsp-wiki-label">性格特质</div>
                  <div className="vsp-wiki-text">{selectedSign.personality}</div>
                </div>
                <div className="vsp-wiki-row">
                  <div className="vsp-wiki-half">
                    <div className="vsp-wiki-label">✨ 优点</div>
                    <div className="vsp-wiki-tags">
                      {selectedSign.strengths.map((t, i) => <span key={i} className="vsp-tag good">{t}</span>)}
                    </div>
                  </div>
                  <div className="vsp-wiki-half">
                    <div className="vsp-wiki-label">⚠️ 缺点</div>
                    <div className="vsp-wiki-tags">
                      {selectedSign.weaknesses.map((t, i) => <span key={i} className="vsp-tag weak">{t}</span>)}
                    </div>
                  </div>
                </div>
                <div className="vsp-wiki-grid">
                  <div className="vsp-wiki-cell"><span className="vsp-wk-k">守护星</span><span>{selectedSign.symbol} {selectedSign.ruler}</span></div>
                  <div className="vsp-wiki-cell"><span className="vsp-wk-k">属性</span><span>{selectedSign.element}象 · {selectedSign.quality}宫</span></div>
                  <div className="vsp-wiki-cell"><span className="vsp-wk-k">幸运色</span><span style={{ color: selectedSign.luckyColorHex }}>{selectedSign.luckyColor}</span></div>
                  <div className="vsp-wiki-cell"><span className="vsp-wk-k">幸运数字</span><span>{selectedSign.luckyNumbers.join(' · ')}</span></div>
                  <div className="vsp-wiki-cell"><span className="vsp-wk-k">幸运宝石</span><span>{selectedSign.luckyGem}</span></div>
                  <div className="vsp-wiki-cell"><span className="vsp-wk-k">幸运方位</span><span>{selectedSign.luckyDirection}</span></div>
                </div>
                <div className="vsp-wiki-section">
                  <div className="vsp-wiki-label">💕 最佳配对</div>
                  <div className="vsp-wiki-tags">
                    {selectedSign.bestMatch.map((m, i) => <span key={i} className="vsp-tag match">{m}</span>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
      </section>
      </div>
      )}
      {/* ===== 模式：本命星盘 ===== */}
      {mode === 'natal' && (
      <div className="mode-panel">
      
      {/* ===== 2. 出生信息录入（常驻显示：未生成星盘时也必须能填） ===== */}
      <Card className="natal-combined-card">
          <div className="birth-form antd-form">
            <div className="birth-field">
              <label>出生日期</label>
              <BirthDatePicker value={{ date: birthDate }} onChange={onBirthValueChange} placeholder="请选择出生日期" />
            </div>
            <div className="birth-field">
              <div className="label-box">
                <label>出生时间</label>
                <label className="birth-unknown-toggle form-check">
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={birthTimeUnknown}
                    onChange={(e) => setBirthTimeUnknown(e.target.checked)}
                  />
                  未知
                </label>
              </div>
              <div className="birth-time-row">
                <div className="birth-time-input">
                  {birthTimeUnknown ? (
                    <div className="birth-time-unknown">🕓 时间未知 · 日间盘</div>
                  ) : (
                    <TimePicker value={birthTime} onChange={onBirthTimeChange} placeholder="请选择出生时间" />
                  )}
                </div>
                
              </div>
            </div>
            <div className="birth-field">
              <label>宫制</label>
              <Select
                value={houseSystem}
                options={[
                  { value: 'equal', label: '等宫制（Equal）' },
                  { value: 'whole', label: '整宫制（Whole Sign）' },
                ]}
                onChange={(v) => setHouseSystem(v as 'equal' | 'whole')}
              />
            </div>
            <div className="birth-field">
              <label>出生地区（省份 / 城市）</label>
              <Cascader
                value={[province, cityName]}
                onChange={(prov, city, lat, lng) => {
                  setProvince(prov);
                  setCityName(city);
                  setCityLat(lat);
                  setCityLng(lng);
                  syncBirthToVisitor({ province: prov, city, lat, lng });
                }}
                placeholder="请选择出生地区"
              />
            </div>
            <div className="birth-submit">
              <Button variant="submit" onClick={generateChart} disabled={chartLoading}>
                {chartLoading ? '计算中…' : chart ? '重新生成星盘' : '生成我的本命盘'}
              </Button>
              <div className="birth-hint">
                出生时间越精确，上升星座与宫位越准确（误差 4 分钟约偏移 1°）
              </div>
              {dirty && (
                <div className="dirty-banner">
                  ⚠️ 出生信息已变更，当前星盘基于旧参数，请点击「重新生成星盘」更新。
                </div>
              )}
            </div>
          </div>
          {chartError && <div className="form-error">⚠️ {chartError}</div>}
      </Card>

      {/* ===== 3. 本命星盘综合模块（左右布局：星盘+星体在左，相位在右） ===== */}
      {chart && (
        <Card className="natal-combined-card natal-lr-layout chart-view-card">
          <div className="chart-view-header">
            <div className="chart-view-tabs">
              <button type="button" className={`cv-tab${chartViewTab === 'natal' ? ' active' : ''}`} onClick={() => setChartViewTab('natal')}>☉ 本命星盘</button>
              <button type="button" className={`cv-tab${chartViewTab === 'return' ? ' active' : ''}`} onClick={() => setChartViewTab('return')}>☀️ 太阳返照{solarReturn ? ` · ${solarReturn.solarReturnYear}` : ''}</button>
            </div>
            <div className="chart-export-row chart-export-top">
              {chartViewTab === 'natal' ? (
                <>
                  <Button variant="ghost" className="chart-export-btn" onClick={exportChartReport}>📄 导出 PDF</Button>
                  <Button variant="ghost" className="chart-export-btn" onClick={exportChartSvg}>📄 导出星盘 PDF</Button>
                  {/* 付费进阶：本命盘+返照完整解读（支付通道未配置时为占位，可免费继续查看） */}
                  <PremiumUnlockButton
                    item="astro_full"
                    label="🔓 完整版解读报告"
                    unlockedLabel="✅ 完整解读已解锁"
                    className="chart-export-btn"
                  />
                </>
              ) : solarReturn ? (
                <Button variant="ghost" className="chart-export-btn" onClick={exportSrReport}>📄 导出返照 PDF</Button>
              ) : null}
            </div>
          </div>
          {chartViewTab === 'natal' && (
          <div className="chart-view-panel">
          <div className="result-card-title chart-title-center">
            <SectionIcon name="orbit" /> {cityName} · 本命星盘
            <span className="chart-sub">
              {birthDate} {birthTimeUnknown ? '时间未知' : birthTime} · {chart.houseSystem === 'whole' ? '整宫制' : '等宫制'}
            </span>
          </div>

          {chart.ascendant ? (
          <>
          <div className="natal-chart-wrap chart-chart-top">
            <NatalChart chart={chart} />
            <div className="chart-legend">
              <div>
                <span className="lg-asc">▲</span> 上升 {chart.ascendant.signGlyph} {chart.ascendant.sign}（{chart.ascendant.degreeInSign}）
              </div>
              <div>
                <span className="lg-mc">▲</span> 中天 {chart.midheaven?.signGlyph} {chart.midheaven?.sign}（{chart.midheaven?.degreeInSign}）
              </div>
              <div>
                <span className="lg-ic">▼</span> 天底 {chart.immc?.signGlyph} {chart.immc?.sign}（{chart.immc?.degreeInSign}）
              </div>
              <div>
                <span className="lg-dsc">▼</span> 下降 {chart.descendant?.signGlyph} {chart.descendant?.sign}（{chart.descendant?.degreeInSign}）
              </div>
              <div>
                太阳 {chart.sunSign.signGlyph} {chart.sunSign.sign} ｜ 月亮 {chart.moonSign.signGlyph} {chart.moonSign.sign}
              </div>
            </div>
            {chartSigns.length > 0 && (
              <div className="chart-signs-row">
                <div className="chart-signs-label">星盘主要星座</div>
                <div className="chart-signs-list">
                  {chartSigns.map((s) => (
                    <span key={s.key} className="chart-sign-chip" style={{ borderColor: s.luckyColorHex, background: `${s.luckyColorHex}1f`, color: 'var(--text-primary)' }}>
                      {s.glyph} {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="natal-cols">
            <div className="natal-cols-left">
              <AstroAccordion
                sections={[
                  {
                    key: 'planets',
                    title: <>🪐 十大星体 · 落座与落宫</>,
                    content: (
                      <div className="planet-table">
                        <div className="pt-head">
                          <span>星体</span><span>星座</span><span>度数</span><span>宫位</span>
                        </div>
                        {chart.planets.map((p) => (
                          <div className="pt-row" key={p.key}>
                            <span className="pt-planet">{p.glyph} {p.label}</span>
                            <span>{p.signGlyph} {p.sign}</span>
                            <span className="pt-deg">{p.degreeInSign}</span>
                            <span className="pt-house">
                              第{p.house ?? '–'}宫
                              {p.dignity && <em className={`dignity dignity-${p.dignity}`} title={DIGNITY_FULL[p.dignity]}>{DIGNITY_SHORT[p.dignity]}</em>}
                              {p.retrograde && <em className="retro">℞</em>}
                            </span>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: 'aspects',
                    title: <>🔗 主要相位（{chart.aspects.length}）</>,
                    content: (
                      <div className="aspect-list">
                        {(aspectsExpanded ? chart.aspects : chart.aspects.slice(0, ASPECT_PREVIEW)).map((a, i) => (
                          <div className="aspect-item" key={i}>
                            <span className="asp-p1">{a.p1}</span>
                            <span className="asp-type">{a.type}</span>
                            <span className="asp-p2">{a.p2}</span>
                            <span className="asp-orb">{a.orb}°</span>
                          </div>
                        ))}
                        {chart.aspects.length === 0 && <div className="asp-empty">无主要相位</div>}
                        {chart.aspects.length > ASPECT_PREVIEW && (
                          <button
                            type="button"
                            className="aspect-toggle"
                            onClick={() => setAspectsExpanded((v) => !v)}
                            aria-label={aspectsExpanded ? '收起相位' : '展开全部相位'}
                          >
                            {aspectsExpanded ? '收起' : `展开剩余 ${chart.aspects.length - ASPECT_PREVIEW} 条`}
                          </button>
                        )}
                      </div>
                    ),
                  },

                  ...(chart.extraPoints?.length > 0 ? [{
                    key: 'extra',
                    title: <>☄️ 小行星 / 虚点</>,
                    content: (
                      <div className="planet-table">
                        <div className="pt-head"><span>虚点</span><span>星座</span><span>度数</span><span>宫位</span></div>
                        {chart.extraPoints.map((p) => (
                          <div className="pt-row pt-row-extra" key={p.key}>
                            <span className="pt-planet">{p.glyph} {p.label}</span>
                            <span>{p.signGlyph} {p.sign}</span>
                            <span className="pt-deg">{p.degreeInSign}</span>
                            <span className="pt-house">第{p.house ?? '–'}宫</span>
                          </div>
                        ))}
                      </div>
                    ),
                  }] : []),
                  ...(chart.houses?.length > 0 ? [{
                    key: 'houses',
                    title: <>🏛️ 十二宫位</>,
                    content: (
                      <div className="house-table">
                        <div className="ht-head"><span>宫</span><span>宫名 / 主题</span><span>宫头星座</span><span>宫头度数</span></div>
                        {chart.houses.map((h) => (
                          <div className="ht-row" key={h.num}>
                            <span className="ht-num">第{h.num}宫</span>
                            <span className="ht-info"><b>{h.name}</b>{h.theme && <em className="ht-theme">{h.theme}</em>}</span>
                            <span className="ht-sign">{h.signGlyph} {h.sign}</span>
                            <span className="ht-cusp">{h.cusp}°</span>
                          </div>
                        ))}
                      </div>
                    ),
                  }] : []),
                ]}
              />
            </div>

            <div className="natal-cols-right">
              <div className="combined-sub-section">
                <div className="combined-sub-title">🔥 四象元素分布</div>
                <div className="element-bar">
                  {(['火', '土', '风', '水'] as const).map((el) => {
                    const count = chart.elements?.[el] ?? 0;
                    return (
                      <div
                        key={el}
                        className="element-seg"
                        style={{ flexGrow: count || 0.001, background: ELEMENT_COLOR[el] }}
                        title={`${el}象 ${count}`}
                      >
                        {count > 0 && <span>{el}{count}</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="element-legend">
                  {(['火', '土', '风', '水'] as const).map((el) => (
                    <span key={el} className="element-dot" style={{ color: ELEMENT_COLOR[el] }}>
                      ● {el} {chart.elements?.[el] ?? 0}
                    </span>
                  ))}
                </div>
              </div>

              {chart.summary && (
                <div className="combined-sub-section">
                  <div className="combined-sub-title">📜 星盘综述</div>
                  <AstroSummary
                    text={chart.summary}
                    expanded={summaryExpanded}
                    onToggle={() => setSummaryExpanded((v) => !v)}
                    preview={SUMMARY_PREVIEW}
                  />
                </div>
              )}

              <div className="sr-row">
                <span className="sr-label">☀️ 太阳返照年份</span>
                <select
                  className="sr-select"
                  value={srYear}
                  onChange={(e) => setSrYear(Number(e.target.value))}
                >
                  {srYearOptions.map((y) => <option key={y} value={y}>{y} 年</option>)}
                </select>
                <Button
                  variant="primary"
                  className="sr-submit"
                  onClick={loadSolarReturn}
                  disabled={srLoading}
                >
                  {srLoading ? '计算中…' : '生成返照盘'}
                </Button>
                <span className="sr-hint">
                  {srYearOptions.length > 0
                    ? `返照年份从出生次年（${srYearOptions[srYearOptions.length - 1]}）起可选；出生当年没有返照。`
                    : '请选择返照年份'}
                </span>
              </div>
            </div>
          </div>
          </>

          ) : (
            <div className="natal-cols">
              <div className="natal-cols-left">
                <AstroAccordion
                  sections={[
                    {
                      key: 'planets',
                      title: <>🪐 星体落座</>,
                      content: (
                        <div className="planet-table">
                          <div className="pt-head"><span>星体</span><span>星座</span><span>度数</span></div>
                          {chart.planets.map((p) => (
                            <div className="pt-row" key={p.key}>
                              <span className="pt-planet">{p.glyph} {p.label}</span>
                              <span>{p.signGlyph} {p.sign}</span>
                              <span className="pt-deg">{p.degreeInSign}</span>
                            </div>
                          ))}
                        </div>
                      ),
                    },
                    ...(chart.extraPoints?.length > 0 ? [{
                      key: 'extra',
                      title: <>☄️ 小行星 / 虚点</>,
                      content: (
                        <div className="planet-table">
                          <div className="pt-head"><span>虚点</span><span>星座</span><span>度数</span></div>
                          {chart.extraPoints.map((p) => (
                            <div className="pt-row pt-row-extra" key={p.key}>
                              <span className="pt-planet">{p.glyph} {p.label}</span>
                              <span>{p.signGlyph} {p.sign}</span>
                              <span className="pt-deg">{p.degreeInSign}</span>
                            </div>
                          ))}
                        </div>
                      ),
                    }] : []),
                  ]}
                />
              </div>
              <div className="natal-cols-right">
                <div className="day-chart-banner">🕓 出生时间未知 · 日间盘（仅太阳、月亮与星体落座有效，宫位与四轴隐藏）</div>
              </div>
            </div>
          )}
          </div>
          )}
          {chartViewTab === 'return' && (
          <div className="chart-view-panel">
          {solarReturn ? (
            <>
              <div className="result-card-title chart-title-center">
                <SectionIcon name="orbit" /> 太阳返照盘 · {solarReturn.solarReturnYear} 年
                <span className="chart-sub">{solarReturn.solarReturnTime ? `返照时刻 ${solarReturn.solarReturnTime}` : ''}</span>
              </div>
              <div className="sr-summary">
                <div>☉ 太阳 {solarReturn.sunSign.signGlyph} {solarReturn.sunSign.sign}</div>
                {solarReturn.ascendant && <div>↑ 上升 {solarReturn.ascendant.signGlyph} {solarReturn.ascendant.sign}</div>}
                {solarReturn.midheaven && <div>MC {solarReturn.midheaven.signGlyph} {solarReturn.midheaven.sign}</div>}
                <div className="sr-note">
                  返照盘太阳必然回到本命太阳位置（{solarReturn.sunSign.sign}），宫位与其他星体的变化才是该年度主题。
                </div>
              </div>
              <div className="natal-chart-wrap chart-chart-top">
                <NatalChart chart={solarReturn} />
                <div className="chart-legend">
                  <div><span className="lg-asc">▲</span> 上升 {solarReturn.ascendant?.signGlyph} {solarReturn.ascendant?.sign}（{solarReturn.ascendant?.degreeInSign}）</div>
                  <div><span className="lg-mc">▲</span> 中天 {solarReturn.midheaven?.signGlyph} {solarReturn.midheaven?.sign}（{solarReturn.midheaven?.degreeInSign}）</div>
                  <div><span className="lg-ic">▼</span> 天底 {solarReturn.immc?.signGlyph} {solarReturn.immc?.sign}（{solarReturn.immc?.degreeInSign}）</div>
                  <div><span className="lg-dsc">▼</span> 下降 {solarReturn.descendant?.signGlyph} {solarReturn.descendant?.sign}（{solarReturn.descendant?.degreeInSign}）</div>
                  <div>太阳 {solarReturn.sunSign.signGlyph} {solarReturn.sunSign.sign} ｜ 月亮 {solarReturn.moonSign.signGlyph} {solarReturn.moonSign.sign}</div>
                </div>
                {srChartSigns.length > 0 && (
                  <div className="chart-signs-row">
                    <div className="chart-signs-label">星盘主要星座</div>
                    <div className="chart-signs-list">
                      {srChartSigns.map((s) => (
                        <span key={s.key} className="chart-sign-chip" style={{ borderColor: s.luckyColorHex, background: `${s.luckyColorHex}1f`, color: 'var(--text-primary)' }}>{s.glyph} {s.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="natal-cols">
                <div className="natal-cols-left">
                  <AstroAccordion
                    sections={[
                      {
                        key: 'planets',
                        title: <>🪐 十大星体 · 落座与落宫</>,
                        content: (
                          <div className="planet-table">
                            <div className="pt-head"><span>星体</span><span>星座</span><span>度数</span><span>宫位</span></div>
                            {solarReturn.planets.map((p) => (
                              <div className="pt-row" key={p.key}>
                                <span className="pt-planet">{p.glyph} {p.label}</span>
                                <span>{p.signGlyph} {p.sign}</span>
                                <span className="pt-deg">{p.degreeInSign}</span>
                                <span className="pt-house">第{p.house ?? '–'}宫{p.dignity && <em className={`dignity dignity-${p.dignity}`} title={DIGNITY_FULL[p.dignity]}>{DIGNITY_SHORT[p.dignity]}</em>}{p.retrograde && <em className="retro">℞</em>}</span>
                              </div>
                            ))}
                          </div>
                        ),
                      },
                      {
                        key: 'aspects',
                        title: <>🔗 主要相位（{solarReturn.aspects?.length ?? 0}）</>,
                        content: (
                          <div className="aspect-list">
                            {(solarReturn.aspects ?? []).map((a, i) => (
                              <div className="aspect-item" key={i}>
                                <span className="asp-p1">{a.p1}</span>
                                <span className="asp-type">{a.type}</span>
                                <span className="asp-p2">{a.p2}</span>
                                <span className="asp-orb">{a.orb}°</span>
                              </div>
                            ))}
                            {(solarReturn.aspects?.length ?? 0) === 0 && <div className="asp-empty">无主要相位</div>}
                          </div>
                        ),
                      },
                      ...(solarReturn.extraPoints?.length > 0 ? [{
                        key: 'extra',
                        title: <>☄️ 小行星 / 虚点</>,
                        content: (
                          <div className="planet-table">
                            <div className="pt-head"><span>虚点</span><span>星座</span><span>度数</span><span>宫位</span></div>
                            {solarReturn.extraPoints.map((p) => (
                              <div className="pt-row pt-row-extra" key={p.key}>
                                <span className="pt-planet">{p.glyph} {p.label}</span>
                                <span>{p.signGlyph} {p.sign}</span>
                                <span className="pt-deg">{p.degreeInSign}</span>
                                <span className="pt-house">第{p.house ?? '–'}宫</span>
                              </div>
                            ))}
                          </div>
                        ),
                      }] : []),
                      ...(solarReturn.houses?.length > 0 ? [{
                        key: 'houses',
                        title: <>🏛️ 十二宫位</>,
                        content: (
                          <div className="house-table">
                            <div className="ht-head"><span>宫</span><span>宫名 / 主题</span><span>宫头星座</span><span>宫头度数</span></div>
                            {solarReturn.houses.map((h) => (
                              <div className="ht-row" key={h.num}>
                                <span className="ht-num">第{h.num}宫</span>
                                <span className="ht-info"><b>{h.name}</b>{h.theme && <em className="ht-theme">{h.theme}</em>}</span>
                                <span className="ht-sign">{h.signGlyph} {h.sign}</span>
                                <span className="ht-cusp">{h.cusp}°</span>
                              </div>
                            ))}
                          </div>
                        ),
                      }] : []),
                    ]}
                  />
                </div>

                <div className="natal-cols-right">
                  <div className="combined-sub-section">
                    <div className="combined-sub-title">🔥 四象元素分布</div>
                    <div className="element-bar">
                      {(['火', '土', '风', '水'] as const).map((el) => {
                        const count = solarReturn.elements?.[el] ?? 0;
                        return (
                          <div key={el} className="element-seg" style={{ flexGrow: count || 0.001, background: ELEMENT_COLOR[el] }} title={`${el}象 ${count}`}>
                            {count > 0 && <span>{el}{count}</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="element-legend">
                      {(['火', '土', '风', '水'] as const).map((el) => (
                        <span key={el} className="element-dot" style={{ color: ELEMENT_COLOR[el] }}>● {el} {solarReturn.elements?.[el] ?? 0}</span>
                      ))}
                    </div>
                  </div>

                  {solarReturn.summary && (
                    <div className="combined-sub-section">
                      <div className="combined-sub-title">📜 年度主题综述</div>
                      <AstroSummary
                        text={solarReturn.summary}
                        expanded={summaryExpanded}
                        onToggle={() => setSummaryExpanded((v) => !v)}
                        preview={SUMMARY_PREVIEW}
                      />
                    </div>
                  )}

                  <div className="sr-row">
                    <span className="sr-label">☀️ 太阳返照年份</span>
                    <select className="sr-select" value={srYear} onChange={(e) => setSrYear(Number(e.target.value))}>
                      {srYearOptions.map((y) => <option key={y} value={y}>{y} 年</option>)}
                    </select>
                    <Button variant="primary" className="sr-submit" onClick={loadSolarReturn} disabled={srLoading}>
                      {srLoading ? '计算中…' : '重新生成返照盘'}
                    </Button>
                    <span className="sr-hint">
                      {srYearOptions.length > 0
                        ? `返照年份从出生次年（${srYearOptions[srYearOptions.length - 1]}）起可选；出生当年没有返照。`
                        : '请选择返照年份'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="combined-sub-section sr-sub-section">
                <div className="combined-sub-title">
                  ✨ 小玄陪你看看这一年的主题
                  <MetaBadge meta={srReportMeta} />
                </div>
                {srReportLoading && <OmLoading label="正在结合返照盘生成年度解读…" mode="inline" />}
                {srReportError && <div className="form-error">⚠️ {srReportError}</div>}
                {srReport && !srReportLoading && (
                  <div className="sr-report-body">
                    {srReport.overview && <p className="sr-rep-p"><b>整体基调</b>{srReport.overview}</p>}
                    {srReport.personality && <p className="sr-rep-p"><b>年度课题</b>{srReport.personality}</p>}
                    {srReport.love && <p className="sr-rep-p"><b>情感</b>{srReport.love}</p>}
                    {srReport.career && <p className="sr-rep-p"><b>事业财富</b>{srReport.career}</p>}
                    {srReport.health && <p className="sr-rep-p"><b>健康</b>{srReport.health}</p>}
                    {srReport.advice?.length > 0 && (
                      <ul className="sr-rep-advice">{srReport.advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="sr-generate-panel">
              <div className="sr-gen-title">☀️ 生成你的太阳返照盘</div>
              <div className="sr-gen-desc">太阳返照盘是太阳回到出生位置的那一刻所排的年度星盘，揭示该年度的主题与趋势。</div>
              <div className="sr-row">
                <span className="sr-label">返照年份</span>
                <select className="sr-select" value={srYear} onChange={(e) => setSrYear(Number(e.target.value))}>
                  {srYearOptions.map((y) => <option key={y} value={y}>{y} 年</option>)}
                </select>
                <Button variant="primary" className="sr-submit" onClick={loadSolarReturn} disabled={srLoading}>
                  {srLoading ? '计算中…' : '生成返照盘'}
                </Button>
              </div>
              {srError && <div className="form-error">⚠️ {srError}</div>}
              <div className="sr-hint">
                {srYearOptions.length > 0
                  ? `返照年份从出生次年（${srYearOptions[srYearOptions.length - 1]}）起可选；出生当年没有返照。`
                  : '请选择返照年份'}
              </div>
            </div>
          )}
          </div>
          )}
        </Card>
      )}
      
      {/* 分区③ 小玄为你解读运势 */}
      <section className="horo-section">
      {/* ===== 4. AI 本命盘解读（独立 Tab + 流式输出） ===== */}
      {chart && (
        <div className="ai-interpret-card">
          <div className="ai-card-head">
            <span className="ai-card-title">小玄陪你看看运势</span>
          </div>
          {/* <div className="ai-tab-header">
            <div className="ai-tab-actions">
              <MetaBadge meta={tab === 'report' ? reportMeta : forecastMeta[tab]} />
              {tab === 'report' && (
                <Button variant="ghost" className="regen-btn" onClick={regenerateReport} disabled={reportLoading}>
                  ♻️ 换一版解读
                </Button>
              )}
            </div>
          </div> */}
          <div className="tab-bar horo-tab-bar">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={'tab-btn horo-tab-btn' + (tab === t.key ? ' active' : '')}
                onClick={() => setTab(t.key)}
              >
                <span className="tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div className="tab-content horo-tab-content">
            {tab === 'report' && (
              <>
                {reportLoading && <OmLoading label="正在结合你的星盘生成解读…" mode="inline" />}
                {reportError && <div className="form-error">⚠️ {reportError}</div>}
                {report && (
                  <div className="interpret-body">
                    {reportSections.map((sec, i) => (
                      <div className="interpret-section" key={i}>
                        <div className="is-title">{sec.title}</div>
                        <div className="is-text">
                          {reportSkipStream ? (
                            <span>{sec.text}</span>
                          ) : reportStreamIdx >= i ? (
                            <StreamingText
                              text={sec.text}
                              speed={4}
                              onComplete={() => {
                                if (reportStreamIdx === i) setReportStreamIdx(i + 1);
                              }}
                            />
                          ) : (
                            <span className="stream-placeholder">
                              <span className="stream-dots"><span>.</span><span>.</span><span>.</span></span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(reportSkipStream || reportStreamIdx >= reportSections.length) && (
                      <div className="adv-block">
                        <div className="adv-title">📌 人生发展建议</div>
                        <ul>
                          {report.advice.map((a, i) => (
                            <li key={i}>
                              {reportSkipStream ? <span>{a}</span> : <StreamingText text={a} speed={5} />}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {report && (
                  <LightFollowUp
                    module="horoscope"
                    context={reportPlain}
                    chips={[
                      '我的性格优势在哪？',
                      '事业运接下来如何？',
                      '感情方面怎么看？',
                      '有什么健康提醒？',
                    ]}
                  />
                )}
              </>
            )}
            {tab !== 'report' && (
              <>
                {forecastLoading[tab] && <OmLoading label={`正在结合天象生成${PERIOD_LABEL[tab]}运势…`} mode="inline" />}
                {forecastError[tab] && <div className="form-error">⚠️ {forecastError[tab]}</div>}
                {forecast[tab] && (
                  <div className="interpret-body">
                    {forecastSections.map((sec, i) => (
                      <div className="interpret-section" key={i}>
                        <div className="is-title">{sec.title}</div>
                        <div className="is-text">
                          {forecastSkipStream ? (
                            <span>{sec.text}</span>
                          ) : forecastStreamIdx >= i ? (
                            <StreamingText
                              text={sec.text}
                              speed={4}
                              onComplete={() => {
                                if (forecastStreamIdx === i) setForecastStreamIdx(i + 1);
                              }}
                            />
                          ) : (
                            <span className="stream-placeholder">
                              <span className="stream-dots"><span>.</span><span>.</span><span>.</span></span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(forecastSkipStream || forecastStreamIdx >= forecastSections.length) && (
                      <>
                        {(forecast[tab]!.luckyNumbers || forecast[tab]!.luckyColors || forecast[tab]!.luckyDirection) && (
                          <div className="lucky-panel">
                            <div className="lucky-panel-title">🍀 {PERIOD_LABEL[tab]}幸运指南</div>
                            <div className="lucky-panel-items">
                              {forecast[tab]!.luckyNumbers && forecast[tab]!.luckyNumbers!.length > 0 && (
                                <div className="lp-item">
                                  <span className="lp-label">幸运数字</span>
                                  <span className="lp-nums">
                                    {forecast[tab]!.luckyNumbers!.map((n, i) => <em key={i}>{n}</em>)}
                                  </span>
                                </div>
                              )}
                              {forecast[tab]!.luckyColors && forecast[tab]!.luckyColors!.length > 0 && (
                                <div className="lp-item">
                                  <span className="lp-label">幸运颜色</span>
                                  <span className="lp-val">{forecast[tab]!.luckyColors!.join(' · ')}</span>
                                </div>
                              )}
                              {forecast[tab]!.luckyDirection && (
                                <div className="lp-item">
                                  <span className="lp-label">幸运方位</span>
                                  <span className="lp-val">{forecast[tab]!.luckyDirection}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {transits[tab] && transits[tab]!.length > 0 && (
                          <div className="transit-panel">
                            <div className="transit-panel-title">🌌 本期关键天象（{PERIOD_LABEL[tab]}）</div>
                            <div className="transit-list">
                              {transits[tab]!.slice(0, 8).map((t, i) => (
                                <span key={i} className={`transit-item ${t.typeKey === 'opposition' || t.typeKey === 'square' ? 'transit-hard' : 'transit-soft'}`}>
                                  {t.transit} {t.type} {t.natal}
                                  <em className="transit-orb">{t.orb}°</em>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="adv-block">
                          <div className="adv-title">📌 {PERIOD_LABEL[tab]}行动建议</div>
                          <ul>
                            {forecast[tab]!.advice.map((a, i) => (
                              <li key={i}>
                                {forecastSkipStream ? <span>{a}</span> : <StreamingText text={a} speed={5} />}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      </section>
      </div>
      )}
      {/* ===== 模式：星座配对 ===== */}
      {mode === 'synastry' && (
      <div className="mode-panel">
      {/* 分区① 星座配对 · 合盘分析 */}
      <section className="horo-section">
        {/* <div className="section-head">星座配对 · 合盘分析</div> */}
      {/* ===== 5. 星座配对（Ant Design 风格 + 流式输出） ===== */}
      <Card className="synastry-card">
        <div className="result-card-title"><SectionIcon name="heart" /> 星座配对 · 合盘分析</div>
        <div className="syn-form antd-form">
          <div className="syn-person">
            <div className="syn-person-label">A · 你</div>
            <div className="syn-person-info">
              {birthDate} {birthTime} · {cityName}
            </div>
            <div className="syn-person-sign">
              {selectedSign
                ? `${selectedSign.glyph} ${selectedSign.name}`
                : chart ? `太阳 ${chart.sunSign.signGlyph} ${chart.sunSign.sign}` : '待生成'}
            </div>
          </div>
          <div className="syn-arrow">💫</div>
          <div className="syn-person">
            <div className="syn-person-label">B · TA</div>
            <div className="syn-picker-group">
              <BirthDatePicker value={{ date: synDate2 }} onChange={(v) => setSynDate2(v.date)} placeholder="出生日期" />
              <TimePicker value={synTime2} onChange={setSynTime2} placeholder="出生时间" disabled={synUnknownTime2} />
              <Cascader
                value={[synProvince2, synCity2]}
                onChange={(prov, city, lat, lng) => {
                  setSynProvince2(prov);
                  setSynCity2(city);
                  setSynLat2(lat);
                  setSynLng2(lng);
                }}
                placeholder="请选择 TA 的出生地区"
              />
            </div>
            <label className="syn-unknown-time form-check">
              <input
                className="checkbox"
                type="checkbox"
                checked={synUnknownTime2}
                onChange={(e) => setSynUnknownTime2(e.target.checked)}
              />
              出生时间未知（按日间盘计算）
            </label>
          </div>
        </div>
        <Button variant="submit" onClick={generateSynastry} disabled={synLoading} className="syn-submit">
          {synLoading ? '合盘计算中…' : '开始合盘分析'}
        </Button>
        {synError && <div className="form-error">⚠️ {synError}</div>}

        {synastry && (
          <div className="syn-result">
            <div className="syn-result-head">
              {/* <MetaBadge meta={synMeta} /> */}
            </div>
            <div className="syn-score-wrap">
              <div className="syn-score-ring" data-score={synastry.score}>
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(124,92,255,0.12)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={synastry.score >= 75 ? '#5ce1e6' : synastry.score >= 50 ? '#7c5cff' : '#f2876f'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(synastry.score / 100) * 264} 264`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="syn-score-num">{synastry.score}</div>
              </div>
              <div className="syn-score-label">配对指数</div>
            </div>
            <div className="syn-pair">
              <div className="syn-pair-side">
                <div className="sps-label">A</div>
                <div>☉ {synastry.chart1.sun}</div>
                <div>☽ {synastry.chart1.moon}</div>
                <div>↑ {synastry.chart1.ascendant}</div>
              </div>
              <div className="syn-pair-side">
                <div className="sps-label">B</div>
                <div>☉ {synastry.chart2.sun}</div>
                <div>☽ {synastry.chart2.moon}</div>
                <div>↑ {synastry.chart2.ascendant}</div>
              </div>
            </div>
            {synastry.composite && (() => {
              const labels: Record<string, string> = { sun: '太阳', moon: '月亮', venus: '金星', mars: '火星', ascendant: '上升', midheaven: '中天' };
              const comp = synastry.composite;
              return (
                <div className="syn-composite">
                  <div className="syn-composite-title">💞 组合盘（中点法 Composite · 关系本身）</div>
                  <div className="syn-composite-body">
                    {(['sun', 'moon', 'venus', 'mars'] as const).map((k) => {
                      const c = comp[k];
                      if (!c) return null;
                      return <span key={k} className="sc-item">{labels[k]} {c.signGlyph} {c.sign}</span>;
                    })}
                    {comp.ascendant && <span className="sc-item">↑ {comp.ascendant.signGlyph} {comp.ascendant.sign}</span>}
                    {comp.midheaven && <span className="sc-item">MC {comp.midheaven.signGlyph} {comp.midheaven.sign}</span>}
                  </div>
                  {comp.aspects?.length > 0 && (
                    <div className="syn-composite-aspects">
                      {(synCompAspectsExpanded ? comp.aspects : comp.aspects.slice(0, 6)).map((a, i) => (
                        <span key={i} className="sc-asp">{labels[a.p1] ?? a.p1} {a.type} {labels[a.p2] ?? a.p2}</span>
                      ))}
                    </div>
                  )}
                  {comp.aspects?.length > 6 && (
                    <button
                      type="button"
                      className="aspect-toggle"
                      onClick={() => setSynCompAspectsExpanded((v) => !v)}
                      aria-label={synCompAspectsExpanded ? '收起组合盘相位' : '展开剩余组合盘相位'}
                    >
                      {synCompAspectsExpanded ? '收起' : `展开剩余 ${comp.aspects.length - 6} 条`}
                    </button>
                  )}
                </div>
              );
            })()}
            <div className="syn-aspects">
              <div className="syn-aspects-title">交叉相位（{synastry.aspects.length}）</div>
              <div className="syn-aspects-list">
                {(synAspectsExpanded ? synastry.aspects : synastry.aspects.slice(0, 10)).map((a, i) => (
                  <span key={i} className={'syn-asp ' + (a.type === 'trine' || a.type === 'sextile' || a.type === 'conjunction' ? 'good' : 'hard')}>
                    {a.p1} {a.label} {a.p2}
                  </span>
                ))}
              </div>
              {synastry.aspects.length > 10 && (
                <button
                  type="button"
                  className="aspect-toggle"
                  onClick={() => setSynAspectsExpanded((v) => !v)}
                  aria-label={synAspectsExpanded ? '收起交叉相位' : '展开剩余交叉相位'}
                >
                  {synAspectsExpanded ? '收起' : `展开剩余 ${synastry.aspects.length - 10} 条`}
                </button>
              )}
            </div>
            <div className="interpret-body">
              {synSections.map((sec, i) => (
                <div className="interpret-section" key={i}>
                  <div className="is-title">{sec.title}</div>
                  <div className="is-text">
                    {synSkipStream ? (
                      <span>{sec.text}</span>
                    ) : synStreamIdx >= i ? (
                      <StreamingText
                        text={sec.text}
                        speed={4}
                        onComplete={() => {
                          if (synStreamIdx === i) setSynStreamIdx(i + 1);
                        }}
                      />
                    ) : (
                      <span className="stream-placeholder">
                        <span className="stream-dots"><span>.</span><span>.</span><span>.</span></span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {(synSkipStream || synStreamIdx >= synSections.length) && (
                <div className="adv-block">
                  <div className="adv-title">📌 关系发展建议</div>
                  <ul>
                    {synastry.advice.map((a, i) => (
                      <li key={i}>
                        {synSkipStream ? <span>{a}</span> : <StreamingText text={a} speed={5} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
        </Card>
      </section>
      </div>
      )}
      {/* 跨页联动 CTA */}
      <CrossPageLink
        description="星盘看先天性格与潜能，八字看后天运势节律，两套系统互相印证，结论更立体。"
        links={[
          { icon: '☯️', label: '去卜卦页排八字', href: '/bugua' },
          { icon: '📄', label: '生成综合报告', href: '/report', variant: 'primary' },
        ]}
      />
    </div>
  );
}

/** 紧凑内联评分：emoji + 标签 + 星星，一行展示 */
function ScoreItem({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <span className="si-item">
      <span className="si-icon">{icon}</span>
      <span className="si-label">{label}</span>
      <span className="si-stars">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < value ? 'si-on' : 'si-off'}>★</span>
        ))}
      </span>
    </span>
  );
}
