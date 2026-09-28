'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  ZiweiAPIResult,
  ZiweiLiuNianYear,
  ZiweiLiuYueItem,
  ZiweiDafen,
  ZiweiPalace,
  ZiweiYunSihua,
  InterpretResponse,
} from '@/lib/api';
import { requestInterpret } from '@/lib/api';
import SectionIcon from '@/components/ui/SectionIcon';
import { mdToHtml } from '@/lib/markdown';
import { ModuleProps, ApiBadge, stripInterpDisclaimer } from '../shared';

/* ============================= 常量 ============================= */

/** 紫微十二宫：原型演示数据已清空，无真实排盘时返回空数组 */
const ZIWEI_PALACES: ZiweiPalace[] = [];

/** 命格特质：原型演示数据已清空 */
const ZIWEI_TRAITS: { icon?: string; name: string; stars?: string; color?: string }[] = [];

/** 地支方位方阵：传统紫微斗数盘位（4 行 × 4 列，中宫留白）
 *  巳午未申 / 辰—酉 / 卯—戌 / 寅丑子亥，每格落一个地支；中宫 4 格为空。 */
const ZHI_GRID: (string | null)[] = (() => {
  const pos: Record<string, [number, number]> = {
    '巳': [0, 0], '午': [0, 1], '未': [0, 2], '申': [0, 3],
    '辰': [1, 0], '酉': [1, 3],
    '卯': [2, 0], '戌': [2, 3],
    '寅': [3, 0], '丑': [3, 1], '子': [3, 2], '亥': [3, 3],
  };
  const g: (string | null)[] = new Array(16).fill(null);
  for (const [zhi, [r, c]] of Object.entries(pos)) g[r * 4 + c] = zhi;
  return g;
})();

/** 模块3：紫微斗数 */
export function ZiweiModule({ data, status }: ModuleProps<ZiweiAPIResult>) {
  const palaces = data?.palaces ?? ZIWEI_PALACES;
  const traits = data?.traits ?? ZIWEI_TRAITS;
  const sihua = data?.sihua ?? [];
  const mainStarsRef = data?.mainStarsRef ?? [];
  const dafen = data?.dafen ?? [];
  const liuNian = data?.liuNian;
  const liuYue = data?.liuYue;
  // P0：流年/流月 可切换。优先用后端预生成数据；旧后端缺失时直接由
  //     出生年(solar) + 十二宫(palaces) 在客户端反推，使选择器不依赖后端版本。
  const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
  const PALACE_ORDER = palaces.map((p) => p.name);
  const _mingIdx = palaces.findIndex((p) => p.highlight);
  const mingPalaceIdx = _mingIdx >= 0 ? _mingIdx : Math.max(0, PALACE_ORDER.indexOf('命宫'));
  const birthYear = data?.solar ? parseInt(data.solar.slice(0, 4), 10) || new Date().getFullYear() : new Date().getFullYear();
  const birthZhiIdx = ((birthYear - 4) % 12 + 12) % 12;
  const mod12 = (n: number) => ((n % 12) + 12) % 12;
  const liuNianFor = (year: number): ZiweiLiuNianYear => {
    const tZhi = mod12(year - 4);
    const mingIdx = mod12(0 - mod12(tZhi - birthZhiIdx));
    const taiIdx = mod12(mingPalaceIdx - tZhi);
    return {
      year,
      zhi: DIZHI[tZhi],
      mingPalace: PALACE_ORDER[mingIdx],
      taiPalace: PALACE_ORDER[taiIdx],
      star: palaces[mingIdx]?.star ?? '',
    };
  };
  const liuYueListFor = (year: number): ZiweiLiuYueItem[] =>
    Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const idx = mod12(mod12(0 - mod12(mod12(year - 4) - birthZhiIdx)) - (m - 1));
      return { month: m, mingPalace: PALACE_ORDER[idx], star: palaces[idx]?.star ?? '' };
    });
  const liuNianRange: ZiweiLiuNianYear[] =
    data?.liuNianRange && data.liuNianRange.length
      ? data.liuNianRange
      : (() => {
          const cur = new Date().getFullYear();
          const out: ZiweiLiuNianYear[] = [];
          for (let y = cur - 16; y <= cur + 16; y++) out.push(liuNianFor(y));
          return out;
        })();
  const liuYueByYear: Record<number, ZiweiLiuYueItem[]> =
    data?.liuYueByYear && Object.keys(data.liuYueByYear).length
      ? data.liuYueByYear
      : (() => {
          const cur = new Date().getFullYear();
          const map: Record<number, ZiweiLiuYueItem[]> = {};
          for (let y = cur - 16; y <= cur + 16; y++) map[y] = liuYueListFor(y);
          return map;
        })();
  const [selYear, setSelYear] = useState<number>(data?.liuNian?.year ?? new Date().getFullYear());
  const [selMonth, setSelMonth] = useState<number>(data?.liuYue?.month ?? 1);
  /** G1：当前点选的大限阶段索引（null = 未点选，回落展示当前所走大限） */
  const [selDafenIdx, setSelDafenIdx] = useState<number | null>(null);
  const curLiuNian = liuNianRange.find((y) => y.year === selYear) ?? liuNian ?? null;
  const curLiuYueList = liuYueByYear[selYear] ?? [];
  const curLiuYue = curLiuYueList.find((m) => m.month === selMonth) ?? liuYue ?? null;
  // P0：当前所选年份 / 月份的运四化（流年 / 流月四化），优先取预生成范围，降级用顶层字段
  const curLiuNianSihua: ZiweiYunSihua[] =
    (data?.liuNianSihuaRange && data.liuNianSihuaRange[selYear]) ?? data?.liuNianSihua ?? [];
  const curLiuYueSihua: ZiweiYunSihua[] =
    (data?.liuYueSihuaByYear && data.liuYueSihuaByYear[selYear] && data.liuYueSihuaByYear[selYear][selMonth]) ??
    data?.liuYueSihua ??
    [];
  // G2：当前所选流年/流月命宫、太岁宫 —— 用于在十二宫方阵上高亮落点
  const liuNianMing = curLiuNian?.mingPalace;
  const liuNianTai = curLiuNian?.taiPalace;
  const liuYueMing = curLiuYue?.mingPalace;
  // 与后端四化取值一致（禄/权/科/忌，无"化"前缀）
  const HUA_COLOR: Record<string, string> = { '禄': '#e8c068', '权': '#e85d6d', '科': '#5ce1e6', '忌': '#9b8db5' };
  const BRIGHT_COLOR: Record<string, string> = { '庙': '#e8c068', '旺': '#e8a838', '地': '#7ec8a0', '利': '#5ce1e6', '平': '#a0a0b8', '闲': '#8a8aa0', '陷': '#e85d6d' };
  /** 五大主宫（命宫 + 财帛 / 官禄 / 迁移 / 疾厄）—— 视觉强调锚点 */
  const MAJOR_PALACES = new Set(['命宫', '财帛', '官禄', '迁移', '疾厄']);
  /** 辅星是否有内容 */
  const hasAux = (aux?: ZiweiPalace['aux']) =>
    !!aux && (aux['吉'].length > 0 || aux['煞'].length > 0 || aux['财'].length > 0 || aux['桃'].length > 0);
  /** 地支 → 宫位（按 pos 还原方阵） */
  const palaceByPos = new Map(palaces.map((p) => [p.pos, p]));
  /** 主星 → 所在宫位（用于十四主星卡点击联动） */
  const palaceOfStar = (name: string) => palaces.find((p) => p.star.includes(name))?.name;
  /** 对宫（相隔六位），紫微以"本宫 + 对宫"论冲合 */
  const palaceOpp = (name: string): string => {
    const i = PALACE_ORDER.indexOf(name);
    return i < 0 ? '' : PALACE_ORDER[(i + 6) % 12];
  };
  /** 各宫所主领域 —— 用于流年/流月解读文案 */
  const PALACE_DOMAIN: Record<string, string> = {
    '命宫': '全年整体运势基调、精神面貌与自我状态',
    '兄弟': '手足同辈之情、人脉分摊与财物往来',
    '夫妻': '感情婚姻与伴侣关系',
    '子女': '子女缘、桃花孕育与创意表达',
    '财帛': '进财渠道、理财方式与开销',
    '疾厄': '健康体能、旧疾与养生',
    '迁移': '外出机遇、迁徙变动与外缘人缘',
    '交友': '朋友部属、人际圈层与合作',
    '官禄': '事业工作、职位升迁与名望',
    '田宅': '房产家宅、不动产与家族根基',
    '福德': '精神享受、内心安宁与福报',
    '父母': '长辈缘分、荫庇与文书学业',
  };
  /** 主星的流年/流月气性（确定性文案，非 AI） */
  const STAR_TONE: Record<string, string> = {
    '紫微': '尊贵掌权之气，主地位与主导力', '天机': '谋略变动之机，主转念与机变',
    '太阳': '名望光明之力，主声名与外显', '武曲': '财官实干之能，主务实与求财',
    '天同': '温和享福之趣，主安逸与随和', '廉贞': '感情才艺之波，主情缘与才思',
    '天府': '稳厚库藏之福，主守成与积累', '太阴': '阴柔财荫之润，主内敛与滋养',
    '贪狼': '欲望交际之动，主桃花与社交', '巨门': '口舌是非之辨，主辨析与争执',
    '天相': '印绶辅佐之稳，主协理与靠山', '天梁': '荫护解厄之安，主庇护与化解',
    '七杀': '开创破旧之勇，主突破与决断', '破军': '变革颠覆之力，主更张与开拓',
    '文昌': '文采学识之光，主文书与才学', '文曲': '才艺聪慧之巧，主技艺与灵思',
    '左辅': '助力扶持之援，主得帮衬', '右弼': '助力扶持之援，主得帮衬',
    '禄存': '守财安稳之实，主积聚与稳进', '天魁': '贵人提携之机，主逢贵', '天钺': '贵人提携之机，主逢贵',
    '擎羊': '刚烈刑伤之锐，主冲劲与损耗', '陀罗': '纠缠反复之滞，主拖延与纠结',
    '火星': '突发躁动之火，主急变与冲动', '铃星': '暗伏煎熬之扰，主隐忧与闷耗',
    '天空': '虚华落空之象，主不实与飘忽', '地劫': '破失耗散之象，主损落与波折',
  };
  /** 生成"流年"解读条目（确定性，随所选年份变化；对宫可点击跳转，G3） */
  const explainLiuNian = (ln: ZiweiLiuNianYear): { t: string; d: ReactNode }[] => {
    const items: { t: string; d: ReactNode }[] = [];
    items.push({
      t: `流年命宫 · ${ln.mingPalace}`,
      d: <>本年运势基调落在「{ln.mingPalace}」，重点在{PALACE_DOMAIN[ln.mingPalace] ?? '该宫所主之事'}。点上方高亮的「{ln.mingPalace}」格可看本宫星曜详析。</>,
    });
    const opp = palaceOpp(ln.taiPalace);
    items.push({
      t: `流年太岁 · ${ln.taiPalace}`,
      d: <>岁君坐镇「{ln.taiPalace}」，本年宜稳守、忌冒进；其对宫 <button type="button" className="ziwei-link-palace" onClick={() => selectNatalPalace(opp)}>{opp}</button> 为冲太岁，是本年变动与机会最集中的焦点。</>,
    });
    if (ln.star) {
      items.push({
        t: `流年命宫主星 · ${ln.star}`,
        d: <>流年命宫与「{ln.star}」同宫，为该年注入{STAR_TONE[ln.star] ?? '此星曜之性'}。</>,
      });
    }
    return items;
  };
  /** 生成"流月"解读条目（确定性，随所选月份变化；含对宫维度 G4，对宫可点击 G3） */
  const explainLiuYue = (ly: ZiweiLiuYueItem): { t: string; d: ReactNode }[] => {
    const items: { t: string; d: ReactNode }[] = [];
    items.push({
      t: `流月命宫 · ${ly.mingPalace}`,
      d: <>本月运势基调落在「{ly.mingPalace}」，重心在{PALACE_DOMAIN[ly.mingPalace] ?? '该宫所主之事'}。流月是流年的细化，看短期一月之内的起落。</>,
    });
    const opp = palaceOpp(ly.mingPalace);
    items.push({
      t: `流月对宫 · ${opp}`,
      d: <>流月命宫「{ly.mingPalace}」的对宫是 <button type="button" className="ziwei-link-palace" onClick={() => selectNatalPalace(opp)}>{opp}</button>，为本月变动与机会的聚焦点。</>,
    });
    if (ly.star) {
      items.push({
        t: `流月命宫主星 · ${ly.star}`,
        d: <>流月命宫与「{ly.star}」同宫，为当月注入{STAR_TONE[ly.star] ?? '此星曜之性'}。</>,
      });
    }
    return items;
  };
  /** 生成"大限"解读条目（确定性，G1）：总览 + 点选大限的十年详解（未点选时回落为当前所走大限） */
  const explainDafen = (list: ZiweiDafen[], selIdx?: number | null): { t: string; d: ReactNode }[] => {
    const items: { t: string; d: ReactNode }[] = [];
    items.push({
      t: '大限 · 总览',
      d: '大限十年一转运，从命宫起按性别顺/逆每行一宫。点任一阶段可聚焦该十年的详解；再点对应宫格（或下方宫名）可看本宫星曜详析。',
    });
    const curY = new Date().getFullYear();
    const age = curY - birthYear;
    const picked = selIdx != null ? list[selIdx] : undefined;
    const cur = picked ?? list.find((d) => {
      const m = d.age.match(/(\d+)-(\d+)/);
      if (!m) return false;
      const lo = parseInt(m[1], 10);
      const hi = parseInt(m[2], 10);
      return age >= lo && age <= hi;
    });
    if (cur) {
      const opp = palaceOpp(cur.palace);
      items.push({
        t: `${picked ? '大限详解' : '当前大限'} · ${cur.age}`,
        d: (
          <>
            {picked
              ? `「${cur.age}」这十年大限命宫落在`
              : `你现年约 ${age} 岁，正行「${cur.age}」大限，命宫落入`}{' '}
            <button type="button" className="ziwei-link-palace" onClick={() => selectNatalPalace(cur.palace)}>{cur.palace}</button>
            。该十年重心在{PALACE_DOMAIN[cur.palace] ?? '该宫所主之事'}
            {cur.star ? `，当运主星「${cur.star}」注入${STAR_TONE[cur.star] ?? '星性'}` : ''}
            ，行运{cur.dir}
            {opp && (
              <>
                ；对宫 <button type="button" className="ziwei-link-palace" onClick={() => selectNatalPalace(opp)}>{opp}</button>
                为大限迁移位，看这十年的外部舞台、外出与变动
              </>
            )}
            。
          </>
        ),
      });
    }
    return items;
  };
  /** 当前点选的宫位（默认命宫），联动下方「宫位详析」 */
  const [activePalace, setActivePalace] = useState<string | null>(null);
  /** 当前点选的四化卡（化禄/权/科/忌），用于「独立选中态」：只强强调被点的那张 */
  const [linkedSihua, setLinkedSihua] = useState<string | null>(null);
  /** 宫干四化飞星（48 条）默认折叠：信息量大，普通用户易被淹没，进阶用户可按需展开 */
  const [fxOpen, setFxOpen] = useState(false);
  /** 当前从「流年十二宫盘」点选的宫名：非 null 时「宫位详析」切换为流年视角。
   *  此前点流年宫格只设 activePalace，详析卡仍按本命盘渲染 → 内容与流年盘无关。 */
  const [liuNianSel, setLiuNianSel] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  /** 本命盘 / 四化 / 飞星 / 主星 / 大限 点选 → 宫位详析回本命视角 */
  const selectNatalPalace = (name: string, hua?: string | null) => {
    setActivePalace(name);
    setLiuNianSel(null);
    setLinkedSihua(hua ?? null);
  };
  /** 流年十二宫盘点选 → 详析切换为流年视角，并滚动定位（详析卡在流年盘上方） */
  const selectLiuNianPalace = (name: string) => {
    setActivePalace(name);
    setLiuNianSel(name);
    setLinkedSihua(null);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };
  /** 真·AI 分块解读：排盘就绪后并行请求聚焦解读（四化/主星 2 张结构卡），
   *  各自基于排盘数据返回 Markdown 具体解答。整盘综合解读已合并至右侧「AI 实时解读」面板，此处不再重复请求。
   *  注：十二宫盘、大限·流年·流月 两卡的 AI 解说已按需求移除（见下方 renderZiweiAi 调用处）。 */
  type ZiweiAiState = { state: 'idle' | 'loading' | 'done' | 'error'; text?: string; disclaimer?: string };
  const [ziweiSec, setZiweiSec] = useState<Record<string, ZiweiAiState>>({
    sihua: { state: 'idle' }, stars: { state: 'idle' },
  });
  const ziweiReq = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!data || !Array.isArray(data.palaces)) return; // 仅真实排盘就绪后触发
    const tasks: [string, string | undefined][] = [
      ['sihua', 'sihua'], ['stars', 'stars'], ['timeline', 'timeline'],
    ];
    for (const [key, focus] of tasks) {
      const reqId = (ziweiReq.current[key] = (ziweiReq.current[key] ?? 0) + 1);
      setZiweiSec((s) => ({ ...s, [key]: { state: 'loading' } }));
      requestInterpret('ziwei', data, focus)
        .then((res: InterpretResponse) => {
          if (ziweiReq.current[key] !== reqId) return; // 丢弃过期响应，防止竞态
          setZiweiSec((s) => ({ ...s, [key]: { state: 'done', text: res.text, disclaimer: res.disclaimer } }));
        })
        .catch(() => {
          if (ziweiReq.current[key] !== reqId) return;
          setZiweiSec((s) => ({ ...s, [key]: { state: 'error' } })); // 静默降级
        });
    }
  }, [data]);

  /** 渲染某分块的真·AI 解读（按 state 切换 loading / 降级 / Markdown） */
  const renderZiweiAi = (key: string, fallback?: string) => {
    const sec = ziweiSec[key];
    if (!sec || sec.state === 'idle') return null;
    if (sec.state === 'loading') return <div className="ziwei-ai-box ziwei-ai-loading">小玄在结合你的命盘数据，慢慢写一份专属解读给你…</div>;
    if (sec.state === 'error') return <div className="ai-paragraph"><p>{fallback ?? '小玄暂时连不上，先看看下方其它结果吧'}</p></div>;
    if (sec.state === 'done' && sec.text) return (
      <div className="ziwei-ai-box">
        <div className="ziwei-ai-md" dangerouslySetInnerHTML={{ __html: mdToHtml(stripInterpDisclaimer(sec.text)) }} />
      </div>
      // 免责声明不再逐卡重复展示：统一由右侧「AI 实时解读」面板显示一次
    );
    return null;
  };
  return (
    <>
            {/* 盘底：十二宫盘（可点选，联动下方宫位详析） */}
      <div className="result-card ziwei-plate-card">
        <div className="result-card-title">
          <SectionIcon name="orbit" /> 紫微斗数 · 十二宫盘 <ApiBadge status={status} />
        </div>
        <p className="ziwei-module-desc">十二个人事宫位与坐守星曜，命宫为格局核心；点选宫格查看该宫的三方四正与辅星明细。</p>
        {data && (
          <div className="ziwei-summary">
            <span className="ziwei-summary-item">命宫 <b className="tc-secondary">{data.mingGong}</b></span>
            <span className="ziwei-summary-item">身宫 <b className="tc-secondary">{data.shenGong}{data.shenGongName ? `（${data.shenGongName}）` : ''}</b></span>
            <span className="ziwei-summary-item">五行局 <b className="tc-secondary">{data.wuxingJu}</b></span>
            <span className="ziwei-summary-item ziwei-summary-ziwei">{data.ziwei}</span>
          </div>
        )}
        <div className="ziwei-plate ziwei-plate-geo">
          {ZHI_GRID.map((zhi, i) => {
            if (!zhi) {
              // 中宫 4 格合并为一块，中央放大显示「中宫」
              const isCenter = i === 5 || i === 6 || i === 9 || i === 10;
              if (!isCenter) return <div key={`c${i}`} className="ziwei-cell-empty" />;
              if (i === 5) return <div key="ziwei-center" className="ziwei-cell-center">中宫</div>;
              return null;
            }
            const p = palaceByPos.get(zhi);
            if (!p) return <div key={zhi} className="ziwei-cell-empty" />;
            const isMajor = MAJOR_PALACES.has(p.name);
            const cls = [
              'ziwei-cell',
              p.highlight ? 'is-ming' : '',
              p.isShenGong ? 'is-shen' : '',
              isMajor ? 'is-major' : '',
              activePalace === p.name ? 'is-active' : '',
              // G2：当前所选流年/流月命宫、太岁宫 高亮落点
              p.name === liuNianMing ? 'is-liunian' : '',
              p.name === liuNianTai ? 'is-taisui' : '',
              p.name === liuYueMing ? 'is-liuyue' : '',
            ].filter(Boolean).join(' ');
            return (
              <button
                key={p.name}
                type="button"
                className={cls}
                onClick={() => selectNatalPalace(p.name)}
                aria-pressed={activePalace === p.name}
              >
                <div className="ziwei-cell-head">
                  <span className="ziwei-cell-name">{p.name}</span>
                  <span className="ziwei-cell-zhi">{p.pos}{p.gan ?? ''}</span>
                </div>
                <div className="ziwei-cell-body">
                  <span className="ziwei-cell-icon" aria-hidden>{p.icon}</span>
                  <span className="ziwei-cell-star" style={{ color: p.color }}>{p.star}</span>
                  {p.bright && <span className="ziwei-cell-bright" style={{ color: BRIGHT_COLOR[p.bright] ?? 'var(--text-secondary)' }}>{p.bright}</span>}
                </div>
                {p.mainDesc && <div className="ziwei-cell-desc">{p.mainDesc}</div>}
                {hasAux(p.aux) && (
                  <div className="ziwei-cell-aux">
                    {p.aux!['吉'].length > 0 && <span className="aux aux-ji">{p.aux!['吉'].join(' ')}</span>}
                    {p.aux!['煞'].length > 0 && <span className="aux aux-sha">{p.aux!['煞'].join(' ')}</span>}
                    {p.aux!['财'].length > 0 && <span className="aux aux-cai">{p.aux!['财'].join(' ')}</span>}
                    {p.aux!['桃'].length > 0 && <span className="aux aux-tao">{p.aux!['桃'].join(' ')}</span>}
                  </div>
                )}
                {/* P1：长生十二神 / 杂曜 / 空宫借星 角标 */}
                {(p.changsheng || (p.misc && p.misc.length) || (p.borrow && p.borrow.length)) && (
                  <div className="ziwei-cell-foot">
                    {p.changsheng && <span className="ziwei-cs-badge" title="长生十二神">{p.changsheng}</span>}
                    {(p.misc ?? []).length > 0 && <span className="ziwei-misc-mini">{p.misc!.join(' ')}</span>}
                    {(p.borrow ?? []).length > 0 && <span className="ziwei-borrow-mini">借 {p.borrow!.join(' ')}</span>}
                  </div>
                )}
                {(p.isShenGong || p.name === liuNianMing || p.name === liuNianTai || p.name === liuYueMing) && (
                  <div className="ziwei-cell-tags">
                    {p.isShenGong && <span className="zw-sg-tag">身宫</span>}
                    {p.name === liuNianMing && <span className="ziwei-cell-flag f-ln">流年</span>}
                    {p.name === liuNianTai && <span className="ziwei-cell-flag f-ts">太岁</span>}
                    {p.name === liuYueMing && <span className="ziwei-cell-flag f-ly">流月</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 宫位详析（点选宫格联动） */}
      {(() => {
        const sel = palaces.find((p) => p.name === activePalace) ?? palaces[0];
        if (!sel) return null;
        const aux = sel.aux;
        // 流年视角：从「流年十二宫盘」点选时，用该宫的流年落星 + 太岁 + 流年四化入宫
        const lnCell = liuNianSel === sel.name ? (data?.liuNianPan ?? []).find((c) => c.name === sel.name) ?? null : null;
        const lnSihua = lnCell ? curLiuNianSihua.filter((s) => s.palace === sel.name) : [];
        return (
          <div ref={detailRef} className={'result-card ziwei-detail-card' + (lnCell ? ' is-liunian' : '')}>
            <div className="result-card-title">
              <SectionIcon name="orbit" /> {sel.name} · 宫位详析{lnCell && curLiuNian ? ` · 流年 ${curLiuNian.year} 年视角` : ''}
            </div>
            <p className="ziwei-module-desc">
              {lnCell
                ? `流年 ${curLiuNian?.year} 年（${curLiuNian?.zhi}）视角：看流年星曜落入此宫后的年度影响；下方另附本命坐守以对照先天与流年的落差。`
                : '所选宫位的主星、庙旺、三方四正与辅星配置，揭示该人生领域的人事吉凶。'}
            </p>
            {lnCell && (
              <div className="ziwei-detail-liunian">
                <div className="ziwei-detail-label">流年落星 · {curLiuNian?.year} 年（{curLiuNian?.zhi}）</div>
                <div className="ziwei-detail-starline">
                  <span className="ziwei-detail-star">{lnCell.star || '无主星'}</span>
                  <span className="ziwei-detail-zhi">{lnCell.pos}</span>
                  {lnCell.isMingGong && <span className="zw-ln-badge">流年命宫</span>}
                  {lnCell.taiSui && <span className="zw-ln-badge tai">太岁</span>}
                </div>
                {lnCell.sub && <p className="ziwei-detail-sub">流年辅曜 · {lnCell.sub}</p>}
                <p className="ziwei-detail-desc">
                  此宫主{PALACE_DOMAIN[sel.name] ?? '该宫所主之事'}；本年该领域以流年「{lnCell.star || '无主星'}」坐镇为主调，对照本命坐守「{sel.star}」看先天与流年的落差。
                </p>
                {lnSihua.length > 0 && (
                  <div className="ziwei-detail-aux">
                    <div className="ziwei-detail-label">流年四化入此宫</div>
                    {lnSihua.map((s, i) => (
                      <div key={i} className="ziwei-aux-row">
                        <span className="aux-tag" style={{ color: HUA_COLOR[s.hua] ?? 'var(--text-secondary)' }}>化{s.hua}</span>{s.star}
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="ziwei-link-palace" onClick={() => selectNatalPalace(sel.name)}>← 回到本命视角</button>
              </div>
            )}
            {lnCell && <div className="ziwei-detail-label ziwei-detail-label-sep">本命坐守（对照）</div>}
            <div className="ziwei-detail-grid">
              <div className="ziwei-detail-main">
                <div className="ziwei-detail-starline">
                  <span className="ziwei-detail-star" style={{ color: sel.color }}>{sel.star}</span>
                  {sel.bright && <span className="ziwei-detail-bright" style={{ color: BRIGHT_COLOR[sel.bright] ?? 'var(--text-secondary)' }}>{sel.bright}</span>}
                  <span className="ziwei-detail-zhi">{sel.pos}{sel.gan ?? ''}</span>
                </div>
                {sel.mainDesc && <p className="ziwei-detail-desc">{sel.mainDesc}</p>}
                {sel.sub && <p className="ziwei-detail-sub">辅曜 · {sel.sub}</p>}
              </div>
              <div className="ziwei-detail-side">
                {(sel.sifang ?? []).length > 0 && (
                  <>
                    <div className="ziwei-detail-label">三方四正</div>
                    <div className="ziwei-detail-sifang">
                      {(sel.sifang ?? []).map((s, i) => (
                        <button key={i} type="button" className={'ziwei-sifang-chip' + (s === sel.name ? ' self' : '')} onClick={() => selectNatalPalace(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {aux && hasAux(aux) && (
                  <div className="ziwei-detail-aux">
                    <div className="ziwei-detail-label">辅星</div>
                    {aux['吉'].length > 0 && <div className="ziwei-aux-row"><span className="aux-tag ji">六吉</span>{aux['吉'].join('、')}</div>}
                    {aux['煞'].length > 0 && <div className="ziwei-aux-row"><span className="aux-tag sha">六煞</span>{aux['煞'].join('、')}</div>}
                    {aux['财'].length > 0 && <div className="ziwei-aux-row"><span className="aux-tag cai">财星</span>{aux['财'].join('、')}</div>}
                    {aux['桃'].length > 0 && <div className="ziwei-aux-row"><span className="aux-tag tao">桃花</span>{aux['桃'].join('、')}</div>}
                  </div>
                )}
                {/* P1：长生十二神 / 杂曜 / 空宫借星 */}
                {(sel.changsheng || (sel.misc && sel.misc.length) || (sel.borrow && sel.borrow.length)) && (
                  <div className="ziwei-detail-extra">
                    <div className="ziwei-detail-label">长生 · 杂曜 · 借星</div>
                    {sel.changsheng && <div className="ziwei-aux-row"><span className="aux-tag cs">长生</span>{sel.changsheng}</div>}
                    {(sel.misc ?? []).length > 0 && <div className="ziwei-aux-row"><span className="aux-tag zy">杂曜</span>{sel.misc!.join('、')}</div>}
                    {(sel.borrow ?? []).length > 0 && <div className="ziwei-aux-row"><span className="aux-tag jx">借星</span>{sel.borrow!.join('、')}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 动态：四化飞星 */}
      {sihua.length > 0 && (
        <div className="result-card">
          <div className="result-card-title"><SectionIcon name="sparkles" /> 四化飞星 · 生年四化</div>
          <p className="ziwei-module-desc">生年四化（禄权科忌）揭示先天气运能量如何流向并"染色"各宫星曜，是解盘的能量主轴。</p>
          <div className="zw-sihua-row">
            {sihua.map((s) => (
              <button
                key={s.hua}
                type="button"
                className={
                  'zw-sihua-cell' +
                  (linkedSihua === s.hua ? ' is-active' : '') +
                  (linkedSihua !== s.hua && activePalace === s.palace ? ' is-same-palace' : '')
                }
                style={{ borderColor: HUA_COLOR[s.hua] ?? 'var(--border)' }}
                onClick={() => selectNatalPalace(s.palace, s.hua)}
                title={`点击查看 ${s.palace} 宫位详析`}
                aria-pressed={linkedSihua === s.hua}
              >
                <div className="zw-sihua-hua" style={{ color: HUA_COLOR[s.hua] ?? 'var(--text-secondary)' }}>{s.hua}</div>
                <div className="zw-sihua-star">{s.star}</div>
                <div className="zw-sihua-palace">落 {s.palace}</div>
              </button>
            ))}
          </div>
          {renderZiweiAi('sihua', '生年四化揭示先天气运能量走向，化禄权科处顺、化忌落处宜守。')}
        </div>
      )}

      {/* P2：格局识别引擎 */}
      {(data?.patterns ?? []).length > 0 && (
        <div className="result-card">
          <div className="result-card-title"><SectionIcon name="orbit" /> 格局识别</div>
          <p className="ziwei-module-desc">命盘星曜组合命中的经典格局，揭示先天的禀赋架构与人生主线（规则引擎识别，供参考）。</p>
          <div className="zw-patterns">
            {data!.patterns!.map((pat) => (
              <div key={pat.name} className="zw-pattern-cell">
                <div className="zw-pattern-name">{pat.name}</div>
                <div className="zw-pattern-desc">{pat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P0：宫干四化飞星（飞星派核心）—— 12 宫 × 4 化共 48 条，默认折叠，按需展开 */}
      {(data?.palaceSihua ?? []).length > 0 && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="sparkles" /> 宫干四化 · 飞星
            <button
              type="button"
              className="ziwei-card-toggle"
              onClick={() => setFxOpen((v) => !v)}
              aria-expanded={fxOpen}
            >
              {fxOpen ? '收起全部' : `展开 ${data!.palaceSihua!.length} 条飞化`}
            </button>
          </div>
          <p className="ziwei-module-desc">以每一宫的宫干飞化禄权科忌，揭示能量在宫与宫之间的流动脉络；落本宫者即「自化」，主该宫能量自我消解或强化。点选可联动查看落宫详析。</p>
          {/* 折叠态：预览前 3 条关键飞化（命宫/夫妻/财帛等高关注宫位优先） */}
          {!fxOpen && (
          <div className="zw-feixing-preview">
            {data!.palaceSihua!.slice(0, 3).map((f, i) => (
              <span key={i} className="zw-fx-preview-item">
                <span className="zw-fx-preview-from">{f.from}</span>
                <span className="zw-fx-preview-hua" style={{ color: HUA_COLOR[f.hua] ?? 'var(--text-secondary)' }}>化{f.hua}</span>
                <span className="zw-fx-preview-star">{f.star}</span>
                <span className="zw-fx-preview-arrow">→</span>
                <span className="zw-fx-preview-to">{f.to}{f.self ? '（自化）' : ''}</span>
              </span>
            ))}
            {data!.palaceSihua!.length > 3 && <span className="zw-fx-preview-more">…还有 {data!.palaceSihua!.length - 3} 条</span>}
          </div>
          )}
          {fxOpen && (
          <div className="zw-feixing-grid">
            {data!.palaceSihua!.map((f, i) => (
              <button
                key={i}
                type="button"
                className={'zw-fx-cell' + (f.self ? ' is-self' : '')}
                style={{ borderColor: HUA_COLOR[f.hua] ?? 'var(--border)' }}
                onClick={() => selectNatalPalace(f.to)}
                title={`点击查看 ${f.to} 宫位详析`}
              >
                <span className="zw-fx-from">{f.from}</span>
                <span className="zw-fx-hua" style={{ color: HUA_COLOR[f.hua] ?? 'var(--text-secondary)' }}>化{f.hua}</span>
                <span className="zw-fx-star">{f.star}</span>
                <span className="zw-fx-to">→ {f.to}{f.self && '（自化）'}</span>
              </button>
            ))}
          </div>
          )}
        </div>
      )}

      {/* 时间：大限 / 流年 / 流月 */}
      {dafen.length > 0 && (
        <div className="result-card">
          <div className="result-card-title"><SectionIcon name="clock" /> 大限 · 流年 · 流月</div>
          <p className="ziwei-module-desc">以大限、流年、流月标定人生时运的时间轴，定位吉凶事件的发生节点与应期。</p>

          {/* P0：流年 / 流月 年份·月份选择器（基于预生成范围本地切换，无需二次请求） */}
          <div className="zw-tl-controls">
            <label className="zw-tl-ctrl">
              <span>流年年份</span>
              <select
                value={selYear}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setSelYear(y);
                  const list = (liuYueByYear as Record<number, ZiweiLiuYueItem[]>)[y];
                  if (list && list.length) setSelMonth(list[0].month);
                }}
              >
                {liuNianRange.map((y) => (
                  <option key={y.year} value={y.year}>{y.year} 年（{y.zhi}）</option>
                ))}
              </select>
            </label>
            <label className="zw-tl-ctrl">
              <span>流月月份</span>
              <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}>
                {curLiuYueList.map((m) => (
                  <option key={m.month} value={m.month}>农历 {m.month} 月</option>
                ))}
              </select>
            </label>
          </div>

          {/* P0：小限（年支 + 虚岁） */}
          {data?.xiaoXian && (
            <div className="zw-xiaoxian">
              <span className="zw-xiaoxian-label">小限</span>
              <span className="zw-xiaoxian-age">{data.xiaoXian.age}</span>
              <span className="zw-xiaoxian-palace">落 {data.xiaoXian.palace}（{data.xiaoXian.zhi}）</span>
            </div>
          )}

          <div className="zw-timeline">
            <div className="zw-tl-section">
              <div className="zw-tl-label">大限</div>
              <div className="zw-tl-track">
                {dafen.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    className={'zw-tl-item' + (activePalace === d.palace ? ' is-linked' : '') + (selDafenIdx === i ? ' is-picked' : '')}
                    onClick={() => { selectNatalPalace(d.palace); setSelDafenIdx(i); }}
                    title={`点击查看 ${d.palace} 宫位详析与该十年详解`}
                    aria-pressed={selDafenIdx === i}
                  >
                    <span className="zw-tl-age">{d.age}</span>
                    <span className="zw-tl-palace">{d.palace}</span>
                    {d.star && <span className="zw-tl-star">{d.star}</span>}
                    <span className="zw-tl-dir">{d.dir}</span>
                  </button>
                ))}
              </div>
            </div>
            {curLiuNian && (
              <div className="zw-tl-section">
                <div className="zw-tl-label">流年</div>
                <div className="zw-tl-track">
                  <button
                    type="button"
                    className={'zw-tl-item current' + (activePalace === curLiuNian.mingPalace ? ' is-linked' : '')}
                    onClick={() => selectNatalPalace(curLiuNian.mingPalace)}
                    title={`点击查看 ${curLiuNian.mingPalace} 宫位详析`}
                  >
                    <span className="zw-tl-age">{curLiuNian.year} ({curLiuNian.zhi})</span>
                    <span className="zw-tl-palace">{curLiuNian.mingPalace}</span>
                    {curLiuNian.star && <span className="zw-tl-star">{curLiuNian.star}</span>}
                    <span className="zw-tl-palace">太岁 {curLiuNian.taiPalace}</span>
                  </button>
                </div>
              </div>
            )}
            {curLiuYue && (
              <div className="zw-tl-section">
                <div className="zw-tl-label">流月</div>
                <div className="zw-tl-track">
                  <button
                    type="button"
                    className={'zw-tl-item current' + (activePalace === curLiuYue.mingPalace ? ' is-linked' : '')}
                    onClick={() => selectNatalPalace(curLiuYue.mingPalace)}
                    title={`点击查看 ${curLiuYue.mingPalace} 宫位详析`}
                  >
                    <span className="zw-tl-age">农历 {curLiuYue.month} 月</span>
                    <span className="zw-tl-palace">{curLiuYue.mingPalace}</span>
                    {curLiuYue.star && <span className="zw-tl-star">{curLiuYue.star}</span>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* P0：流年 / 流月四化（运四化） */}
          {(curLiuNianSihua.length > 0 || curLiuYueSihua.length > 0) && (
            <div className="zw-yunsihua">
              {curLiuNianSihua.length > 0 && (
                <>
                  <div className="zw-ys-label">流年四化 · {selYear} 年（{curLiuNian?.zhi}）</div>
                  <div className="zw-ys-row">
                    {curLiuNianSihua.map((s, i) => (
                      <span key={i} className="zw-ys-cell" style={{ borderColor: HUA_COLOR[s.hua] ?? 'var(--border)' }}>
                        <b style={{ color: HUA_COLOR[s.hua] ?? 'var(--text-secondary)' }}>化{s.hua}</b> {s.star} → {s.palace}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {curLiuYueSihua.length > 0 && (
                <>
                  <div className="zw-ys-label">流月四化 · 农历 {selMonth} 月</div>
                  <div className="zw-ys-row">
                    {curLiuYueSihua.map((s, i) => (
                      <span key={i} className="zw-ys-cell" style={{ borderColor: HUA_COLOR[s.hua] ?? 'var(--border)' }}>
                        <b style={{ color: HUA_COLOR[s.hua] ?? 'var(--text-secondary)' }}>化{s.hua}</b> {s.star} → {s.palace}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* G1：大限详解（确定性解读；点选某大限阶段后聚焦该十年，未点选时展示当前所走大限） */}
          <div className="ziwei-tl-explain">
            <div className="ziwei-tl-explain-head">
              大限解读{selDafenIdx != null && dafen[selDafenIdx] ? ` · ${dafen[selDafenIdx].age} 行 ${dafen[selDafenIdx].palace}` : ''}
            </div>
            {explainDafen(dafen, selDafenIdx).map((it) => (
              <div key={it.t} className="ziwei-tl-explain-item">
                <span className="ziwei-tl-explain-t">{it.t}</span>
                <span className="ziwei-tl-explain-d">{it.d}</span>
              </div>
            ))}
          </div>

          {/* 流年 / 流月 详解（确定性解读，随选择更新，不调用 AI） */}
          {curLiuNian && (
            <div className="ziwei-tl-explain">
              <div className="ziwei-tl-explain-head">流年解读 · {curLiuNian.year} 年（{curLiuNian.zhi}）</div>
              {explainLiuNian(curLiuNian).map((it) => (
                <div key={it.t} className="ziwei-tl-explain-item">
                  <span className="ziwei-tl-explain-t">{it.t}</span>
                  <span className="ziwei-tl-explain-d">{it.d}</span>
                </div>
              ))}
            </div>
          )}
          {curLiuYue && (
            <div className="ziwei-tl-explain">
              <div className="ziwei-tl-explain-head">流月解读 · 农历 {curLiuYue.month} 月（{curLiuNian?.zhi ?? ''}年）</div>
              {explainLiuYue(curLiuYue).map((it) => (
                <div key={it.t} className="ziwei-tl-explain-item">
                  <span className="ziwei-tl-explain-t">{it.t}</span>
                  <span className="ziwei-tl-explain-d">{it.d}</span>
                </div>
              ))}
            </div>
          )}

          {/* 流年十二宫盘（以流年命宫为基准重排，太岁标注） */}
          {data?.liuNianPan && data.liuNianPan.length === 12 && (
            <div className="ziwei-liunian-pan-wrap">
              <div className="ziwei-tl-explain-head">流年十二宫盘 · {curLiuNian?.year} 年（{curLiuNian?.zhi}）</div>
              <p className="ziwei-module-desc">以流年命宫为基准重排十二宫，看流年星曜落入原盘何宫；红框为当年太岁（{curLiuNian?.zhi}）。点选宫格 → 上方「宫位详析」切换为流年视角并自动定位。</p>
              <div className="ziwei-liunian-pan">
                {data.liuNianPan.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={
                      'ziwei-ln-cell' +
                      (c.isMingGong ? ' is-ming' : '') +
                      (c.taiSui ? ' is-taisui' : '') +
                      (liuNianSel === c.name ? ' is-active' : '')
                    }
                    aria-pressed={liuNianSel === c.name}
                    onClick={() => selectLiuNianPalace(c.name)}
                    title={`流年${c.name} · ${c.star || '无主星'}${c.taiSui ? ' · 太岁' : ''}`}
                  >
                    <span className="ziwei-ln-name">{c.name}</span>
                    <span className="ziwei-ln-star">{c.star || '—'}</span>
                    <span className="ziwei-ln-zhi">{c.pos}</span>
                    {c.taiSui && <span className="ziwei-ln-flag">太岁</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {renderZiweiAi('timeline', '大限、流年、流月共同勾勒你的人生时运曲线；AI 正在结合命盘生成专属解读。')}

        </div>
      )}

      {/* 主角：十四主星参考 */}
      {mainStarsRef.length > 0 && (
        <div className="result-card">
          <div className="result-card-title"><SectionIcon name="star" /> 十四主星 · 北斗南斗</div>
          <p className="ziwei-module-desc">北斗南斗十四主星体系，奠定各宫星曜的性格基调与庙旺利陷，是格局判断的根本。</p>
          <div className="zw-stars-ref">
            {mainStarsRef.map((s) => {
              const target = palaceOfStar(s.name);
              return (
                <button
                  key={s.name}
                  type="button"
                  className={'zw-star-ref-cell' + (s.group.includes('北') ? ' north' : ' south') + (target && activePalace === target ? ' is-linked' : '')}
                  onClick={() => { if (target) selectNatalPalace(target); }}
                  disabled={!target}
                  title={target ? `点击查看 ${target} 宫位详析` : '本命盘未出现此主星'}
                >
                  <div className="zw-star-ref-name">{s.name}</div>
                  <div className="zw-star-ref-group">{s.group}</div>
                  <div className="zw-star-ref-char">{s.char}</div>
                </button>
              );
            })}
          </div>
          {renderZiweiAi('stars', '北斗主开创变动、南斗主守成稳定，主星坐守奠定性格与能力基调。')}
        </div>
      )}

      {/* 命格特质（整盘 AI 解读已合并至右侧「AI 实时解读」面板，避免重复调用与重复展示） */}
      <div className="result-card">
        <div className="result-card-title"><SectionIcon name="user" /> 特质总览</div>
        <p className="ziwei-module-desc">十四主星在命盘各宫的坐守特质，由命宫主星组合定调你的先天气质与格局大小；整盘综合解读见右侧「小玄陪你看看这张命盘」。</p>
        <div className="ziwei-traits-grid">
          {traits.map((t) => (
            <div key={t.name} className="ziwei-trait-cell">
              <div className="ziwei-trait-icon">{t.icon}</div>
              <div className="ziwei-trait-name">{t.name}</div>
              <div className="ziwei-trait-stars" style={{ color: t.color }}>{t.stars}</div>
            </div>
          ))}
        </div>
        {/* P1-3：命格解读文字（后端确定性生成，非 AI；此前从未渲染，数据被浪费） */}
        {data?.analysis ? (
          <p className="ziwei-analysis-text">{data.analysis}</p>
        ) : null}
      </div>
    </>
  );
}
