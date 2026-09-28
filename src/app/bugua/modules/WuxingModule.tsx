'use client';

import type { ReactNode } from 'react';
import type { BaziAPIResult } from '@/lib/api';
import SectionIcon from '@/components/ui/SectionIcon';
import { computeLocalBazi, type LocalDayunInput } from '@/data/baziDayun';
import { ModuleProps, ApiBadge, WUXING_BG, WUXING_BG_TEXT_COLOR, WX_ICON } from '../shared';

/* ============================= 常量 ============================= */

/** 五行能量条：原型演示数据已清空，无排盘数据时返回空数组 */
const WUXING: { icon?: string; label: string; pct: number; bg?: string }[] = [];

/** 五行圆环布局节点（位置/颜色与五方对应，非业务数据；去掉原型写死的百分比，动态排盘后回填） */
const WUXING_NODES = [
  { label: '火', color: '#ff6b6b', bg: 'rgba(255,107,107,0.2)', style: { top: 8, left: '50%', transform: 'translateX(-50%)' } },
  { label: '木', color: '#4ade80', bg: 'rgba(74,222,128,0.15)', style: { top: 76, right: -4 } },
  { label: '金', color: '#a0a0b8', bg: 'rgba(160,160,184,0.15)', style: { bottom: 56, right: 30 } },
  { label: '土', color: '#d4a853', bg: 'rgba(212,168,83,0.15)', style: { bottom: 8, left: '50%', transform: 'translateX(-50%)' } },
  { label: '水', color: '#5ce1e6', bg: 'rgba(92,225,230,0.15)', style: { bottom: 56, left: 30 } }
];

/** 模块2：五行能量 */
export function WuxingModule({ data, status, birth }: ModuleProps<BaziAPIResult> & { birth: LocalDayunInput }) {
  // 离线兜底：后端不可用时用 computeLocalBazi 真实计算五行（替代写死 1995 常量）
  const local = data ? null : computeLocalBazi(birth);
  const wuxing = (data?.wuxing ?? local?.wuxing ?? WUXING).map((w) => ({ icon: w.icon || '●', label: w.label, pct: w.pct, bg: WUXING_BG[w.label] || 'linear-gradient(90deg,#a0a0b8,#d4d4e8)' }));
  const nodes = WUXING_NODES.map((n) => {
    const l = n.label.charAt(0);
    const p = (data?.wuxing ?? local?.wuxing ?? []).find((w) => w.label === l);
    return p ? { ...n, label: `${p.label}${p.pct}%` } : n;
  });
  const yongshen = data?.yongshen ?? local?.yongshen;
  const wuxingCount = data?.wuxingCount ?? local?.wuxingCount;
  const rawLacking: string[] = data?.lacking ?? local?.lacking ?? [];
  const lackingFromCount = (wuxingCount ?? []).filter((c: any) => Number(c?.count) === 0).map((c: any) => String(c.label || '').trim().charAt(0)).filter(Boolean);
  const lackingFromPct = wuxing.filter((w) => Number(w.pct) === 0).map((w) => w.label);
  const lacking = [...rawLacking, ...lackingFromCount, ...lackingFromPct].filter((v, i, arr) => arr.indexOf(v) === i);

  // 动态五行偏旺/偏弱/缺失分析
  const sortedWx = [...wuxing].sort((a, b) => b.pct - a.pct);
  const maxWx = sortedWx[0];
  const minWx = sortedWx[sortedWx.length - 1];
  const weakWx = sortedWx.filter((w) => w.pct <= 10);
  const strongWx = sortedWx.filter((w) => w.pct >= 30);

  // ===== 五行调候与角色解释（金/木/水/火/土每个五行的意义，用户能看明白为什么要这么做）=====
  const WX_ADVICE: Record<string, string> = {
    '金': '佩戴白水晶/银饰，穿白色衣物，西方位有利',
    '木': '多接触绿色植物，佩戴木质饰品，东方位有利',
    '水': '办公桌放一杯水，穿深蓝色衣物，北方位有利',
    '火': '穿红色衣物，佩戴紫水晶，南方位有利',
    '土': '佩戴黄水晶/陶瓷饰品，穿黄色衣物，中宫有利',
  };
  /** 五行基础角色解释（命理·脏腑·情志·颜色·方位·饰品），用于把「金/木/水/火/土」单字翻译成用户能看懂的话 */
  type WxRole = {
    season: string;           // 对应季节
    organ: string;            // 对应脏腑（中医）
    emotion: string;          // 对应情志（情绪影响）
    color: string;            // 主色
    dir: string;              // 有利方位
    item: string;             // 代表性饰品（为什么推荐这个）
    life: string;             // 生活场景（如工作/饮食）
    personality: string;      // 在性格上的含义
    whyBoost: string;         // 「如果偏弱/缺失，为什么要补」
    whyCalm: string;          // 「如果偏旺，为什么要抑」
  };
  const WX_ROLE: Record<string, WxRole> = {
    '金': {
      season: '秋季（肃杀、收敛之气）',
      organ: '肺 · 大肠 · 呼吸道 · 皮肤',
      emotion: '悲/忧（过悲伤肺）',
      color: '白 · 银 · 浅灰',
      dir: '西方',
      item: '白水晶、银饰、金属配饰（金气对应白色、金属，同气相求）',
      life: '饮食：白萝卜、百合、银耳、雪梨（白色润肺）；职业：法律、金融、管理、机械（金=规则、决断）',
      personality: '决断力、原则性、义气、骨气；金不足则优柔寡断、不敢拒绝，金过旺则刚愎自用、说话尖锐',
      whyBoost: '金气不足或缺金，会表现为决策犹豫、容易被他人意见左右、肺/呼吸道偏弱（易感冒、鼻塞、过敏），所以要补金增强魄力与肺卫。',
      whyCalm: '金气过旺则容易急躁、挑剔、言辞伤人，做事不留余地，需以火炼之（红色/南方）以收敛锋芒，以水润之（黑色/北方）以泄金气。',
    },
    '木': {
      season: '春季（生发、舒展之气）',
      organ: '肝 · 胆 · 筋 · 眼睛 · 指甲',
      emotion: '怒（大怒伤肝）',
      color: '青 · 绿 · 浅蓝',
      dir: '东方',
      item: '翡翠、绿幽灵、木质饰品、绿植（木对应生发之气，植物为木之代表）',
      life: '饮食：绿叶菜、酸口味、豆芽；作息：早睡养肝（23点前入睡，丑时肝经当令）；运动：伸展、瑜伽、散步（疏肝气）',
      personality: '仁慈、创意、条理性、执行力；木不足则萎靡没精神、眼睛干涩，木过旺则脾气急躁、容易顶撞人、肝郁化火',
      whyBoost: '木气不足或缺木，表现为易疲惫、手脚冰凉、情绪抑郁、做事缺乏冲劲、视力下降/眼睛干涩，需补木以疏肝理气、振奋生发之力。',
      whyCalm: '木气过旺则肝火旺，表现为易怒、头晕头痛、失眠多梦、口腔溃疡，需以金克之（白色/金属）以削其刚，以火泄之（红色/南方）以散其郁。',
    },
    '水': {
      season: '冬季（收藏、滋养之气）',
      organ: '肾 · 膀胱 · 骨 · 耳 · 头发',
      emotion: '恐（惊恐伤肾）',
      color: '黑 · 深蓝 · 灰',
      dir: '北方',
      item: '黑曜石、黑发晶、海蓝宝、水缸/鱼缸/水杯（水对应流动、冷色、聚气之物）',
      life: '饮食：黑豆、黑芝麻、木耳、海参、深海鱼（黑色入肾）；习惯：多喝水、少熬夜（熬夜伤肾水）；环境：靠近水边居住/办公',
      personality: '智慧、沟通力、适应力、神秘感；水不足则记忆力下降、思虑过度睡不着，水过旺则犹豫不决、情感泛滥易受影响',
      whyBoost: '水气不足或缺水，表现为记忆力差、易焦虑失眠、腰酸膝软、耳背耳鸣、皮肤干燥，需补水以养肾阴、安神定志、滋水涵木（让肝木不至于过旺）。',
      whyCalm: '水气过旺则痰湿重、易水肿、思维游移不定、容易被他人情绪带走，需以土克之（黄色/陶瓷/稳定作息）筑堤防水，以木泄之（绿色/植物）疏导水势。',
    },
    '火': {
      season: '夏季（炎上、热情之气）',
      organ: '心 · 小肠 · 血脉 · 舌 · 面部',
      emotion: '喜/狂喜（过喜伤心）',
      color: '红 · 紫 · 橙 · 暖粉',
      dir: '南方',
      item: '紫水晶、红玛瑙、朱砂、石榴石、红绳（火对应暖色、光明之物）',
      life: '饮食：红枣、桂圆、枸杞、姜茶（温补心火，不可过量）；光照：多晒太阳（尤其是早晨/傍晚的阳气）；运动：有氧出汗运动助心火宣发',
      personality: '热情、领导力、表达力、感染力；火不足则怕冷、手脚冰凉、精神萎靡、社交被动，火过旺则性急冲动、爱发火、睡眠差/多梦',
      whyBoost: '火气不足或缺火，表现为怕冷（尤其手脚）、缺乏热情、做事提不起劲、心率偏低/容易胸闷，需补火以温煦心阳、提振精神与行动力。',
      whyCalm: '火气过旺则心火上炎，表现为口舌生疮、脸红长痘、暴躁易怒、心率快/失眠、血压不稳，需以水克之（黑色/北方/多喝水）以降火滋阴，以土泄之（黄色/稳定）以敛火归元。',
    },
    '土': {
      season: '长夏（湿土、运化之气；四季末各 18 天属土）',
      organ: '脾 · 胃 · 肌肉 · 口 · 唇',
      emotion: '思（思虑过度伤脾）',
      color: '黄 · 赭 · 米棕 · 土色',
      dir: '中宫（中央；住宅中间位/办公室中心）',
      item: '黄水晶、黄玉、陶瓷、紫砂、原石摆件（土对应厚重、包容、稳定之物）',
      life: '饮食：小米、南瓜、红薯、山药、黄豆（黄色入脾，甘味补脾）；习惯：三餐定时定量（脾胃怕乱）；环境：地面材质选陶瓷/实木/石材（接地气）',
      personality: '包容、守信、务实、稳重、组织力；土不足则消化不良、肌肉松软、容易焦虑想太多，土过重则思虑内耗、固执拖沓、身体湿气重水肿',
      whyBoost: '土气不足或缺土，表现为脾胃虚弱（食欲差/易腹胀/便溏）、形体偏瘦或虚胖、过度思虑（做事反复权衡难以决定）、缺乏安全感，需补土以健脾厚土、增强运化与稳定感。',
      whyCalm: '土气过旺（尤其火土同旺）则脾胃壅滞、口干口苦、身体湿气重、固执己见、精神内耗严重（想太多不动），需以木克之（绿色/伸展运动）疏通土气，以金泄之（白色/决断训练）打破拖沓。',
    },
  };
  /** 把喜用神/忌神的条目（可能是「水」单字，也可能是「水 — 调候第一用神」自带解释）扩展为可读解释 */
  function explainYongshenItem(raw: string, kind: 'xi' | 'ji'): { wx: string; text: string; } {
    const wx = raw?.trim().charAt(0) || '';
    const hasCustom = raw.trim().length > 2 && raw.includes('—') || raw.trim().length > 2 && raw.includes('－') || raw.trim().length > 3;
    const r = WX_ROLE[wx];
    const head = wx ? `<strong style="font-size:16px;">${wx}</strong>（${r?.color || ''}·${r?.dir || ''}）` : raw;
    let why = '';
    if (r) {
      why = kind === 'xi' ? r.whyBoost : r.whyCalm;
    }
    const customDetail = hasCustom ? `<br/><span style="color:var(--text-muted);">排盘备注：${raw}</span>` : '';
    const organ = r ? `<br/><span style="color:var(--text-muted);">对应：${r.season}；${r.organ}；${r.emotion}</span>` : '';
    return { wx: wx || raw, text: `${head}${organ}${customDetail}<br/><span style="color:${kind === 'xi' ? 'var(--accent-green)' : '#ff8e8e'};">${why || ''}</span>` };
  }
  // 当前命盘每个五行的状态：偏旺(strong) / 偏弱(weak) / 缺失(lacking) / 均衡
  const labelState: Record<string, string> = {};
  const labelPct: Record<string, number | undefined> = {};
  wuxing.forEach((w) => { labelPct[w.label] = w.pct; });
  strongWx.forEach((w) => { labelState[w.label] = '偏旺'; });
  weakWx.forEach((w) => { if (!labelState[w.label]) labelState[w.label] = '偏弱'; });
  lacking.forEach((l) => { labelState[l] = '缺失'; });
  wuxing.forEach((w) => { if (!labelState[w.label]) labelState[w.label] = '均衡'; });
  // ===== 喜用/忌神候选：优先走后端 yongshen；后端没给出时，按命盘真实强弱动态推导（缺 / 偏弱 → 喜用；偏旺 → 忌神）=====
  const weakLabels = weakWx.filter((w) => !lacking.includes(w.label)).map((w) => w.label);
  const strongLabels = strongWx.map((w) => w.label);
  const xiFallback: string[] = [...lacking, ...weakLabels].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3);
  const jiFallback: string[] = strongLabels.slice(0, 3);

  // xiRaw / jiRaw = 传给卡片渲染的原始条目
  // —— 核心规则（解决"后端给了喜用，但没把缺失五行当喜用"的 mismatch）：
  //   喜用 xiRaw = ① 后端 yongshen.xi  +  ② 命盘真实 lacking（缺失五行必须补 = 无条件 = 喜用，不看后端写没写） +  ③ 后端为空时再加偏弱五行
  //   忌神 jiRaw = ① 后端 yongshen.ji  +  ② 命盘真实 strongLabels（偏旺五行 = 无条件要规避）
  // —— 最后一律按五行首字去重，避免 ["土(食伤)","土(官杀)"] 等同一五行渲染多张卡片。
  const dedupByWx = (entries: string[]): string[] => {
    const seen = new Set<string>();
    return entries.filter((e) => {
      const wx = String(e ?? '').trim().charAt(0);
      if (!wx) return false;
      if (seen.has(wx)) return false;
      seen.add(wx);
      return true;
    });
  };
  const xiRaw: string[] = dedupByWx([
    ...(yongshen?.xi ?? []),
    ...lacking,
    ...(!yongshen?.xi?.length ? weakLabels : []),
  ]).slice(0, 4);
  const jiRaw: string[] = dedupByWx([
    ...(yongshen?.ji ?? []),
    ...strongLabels,
  ]).slice(0, 4);

  // xiLabels / jiLabels / strongLabelSet = 用于命中五行角色字典与调候建议映射的"首字五行集合"
  const xiLabels = xiRaw.map((x) => x.trim().charAt(0)).filter(Boolean);
  const jiLabels = jiRaw.map((x) => x.trim().charAt(0)).filter(Boolean);
  const strongLabelSet = new Set(strongLabels);

  // —— 最终断言式兜底（最后一道保险）：不管前面怎么推导/去重/后端怎么给，
  //    只要「命盘判定为缺 X」→ X 必须出现在喜用 xiRaw 里；只要「X 偏旺」→ X 必须出现在忌神 jiRaw 里。
  //    彻底避免"明明缺水但喜用卡仍没有水"这类链路疏漏问题。
  (() => {
    const missingXiWx = lacking.filter((l) => !xiLabels.includes(l));
    for (const wx of missingXiWx) {
      xiRaw.push(wx);
      xiLabels.push(wx);
    }
    const missingJiWx = strongLabels.filter((s) => !jiLabels.includes(s));
    for (const wx of missingJiWx) {
      jiRaw.push(wx);
      jiLabels.push(wx);
    }
  })();

  const noteParts: string[] = [];
  if (strongWx.length > 0) {
    noteParts.push(`五行<strong class="tc-red">${strongWx.map((w) => w.label).join('、')}偏旺</strong>`);
  }
  if (lacking.length > 0) {
    noteParts.push(`<strong class="tc-blue">缺${lacking.join('、')}</strong>`);
  }
  if (weakWx.length > 0 && weakWx.some((w) => !lacking.includes(w.label))) {
    noteParts.push(`<strong class="tc-green">${weakWx.filter((w) => !lacking.includes(w.label)).map((w) => w.label).join('、')}偏弱</strong>`);
  }
  const adviceTarget = lacking[0] || minWx?.label || '金';
  const adviceText = WX_ADVICE[adviceTarget] || WX_ADVICE['金'];

  return (
    <>
      <div className="result-card">
        <div className="result-card-title"><SectionIcon name="pentagon" /> 五行能量分布 <ApiBadge status={status} /></div>
        <div className="wuxing-bars">
          {wuxing.map((w) => (
            <div className="wuxing-row" key={w.label}>
              <div className="wuxing-label">{w.icon} {w.label}</div>
              <div className="wuxing-bar-bg"><div className="wuxing-bar-fill" style={{ width: w.pct + '%', background: w.bg }} /></div>
              <div className="wuxing-value">{w.pct}%</div>
            </div>
          ))}
        </div>
        {wuxingCount && (
          <div className="wuxing-count-row">
            <span className="wuxing-count-label">五行个数：</span>
            {wuxingCount.map((w) => (
              <span key={w.label} className={`wuxing-count-item ${w.count === 0 ? 'lacking' : ''}`}>
                {w.label}{w.count}
              </span>
            ))}
            {lacking.length > 0 && <span className="wuxing-count-lacking">（缺{lacking.join('、')}）</span>}
          </div>
        )}
        <div className="note-box warn" dangerouslySetInnerHTML={{
          __html: noteParts.length > 0
            ? `⚠️ ${noteParts.join('，')}。建议：${adviceText}。`
            : `⚠️ 五行较为均衡，无明显偏旺或偏弱。建议：保持生活规律，顺其自然即可。`
        }} />
      </div>

      <div className="result-card">
        <div className="result-card-title"><SectionIcon name="pentagon" /> 五行生克关系图</div>
        <div className="wuxing-diagram-wrap">
          <div className="wuxing-ring">
            <svg viewBox="0 0 280 280" className="wuxing-svg">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(74,222,128,0.6)" />
                </marker>
                <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,107,107,0.6)" />
                </marker>
              </defs>
              {/* 相生线 */}
              <line x1="140" y1="30" x2="230" y2="90" stroke="rgba(74,222,128,0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
              <line x1="230" y1="90" x2="230" y2="190" stroke="rgba(74,222,128,0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
              <line x1="230" y1="190" x2="140" y2="250" stroke="rgba(74,222,128,0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
              <line x1="140" y1="250" x2="50" y2="190" stroke="rgba(74,222,128,0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
              <line x1="50" y1="190" x2="50" y2="90" stroke="rgba(74,222,128,0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
              <line x1="50" y1="90" x2="140" y2="30" stroke="rgba(74,222,128,0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
              {/* 相克线（虚线） */}
              <line x1="140" y1="30" x2="230" y2="190" stroke="rgba(255,107,107,0.3)" strokeWidth="1.5" strokeDasharray="4,4" />
              <line x1="230" y1="190" x2="50" y2="190" stroke="rgba(255,107,107,0.3)" strokeWidth="1.5" strokeDasharray="4,4" />
              <line x1="50" y1="190" x2="140" y2="30" stroke="rgba(255,107,107,0.3)" strokeWidth="1.5" strokeDasharray="4,4" />
              <line x1="140" y1="250" x2="50" y2="90" stroke="rgba(255,107,107,0.3)" strokeWidth="1.5" strokeDasharray="4,4" />
              <line x1="50" y1="90" x2="230" y2="90" stroke="rgba(255,107,107,0.3)" strokeWidth="1.5" strokeDasharray="4,4" />
              <line x1="230" y1="90" x2="140" y2="250" stroke="rgba(255,107,107,0.3)" strokeWidth="1.5" strokeDasharray="4,4" />
            </svg>
            {nodes.map((n) => (
              <div key={n.label} className="wuxing-node" style={{ ['--wn-bg' as string]: n.bg, ['--wn-c' as string]: n.color, ...n.style } as React.CSSProperties}>{n.label}</div>
            ))}
          </div>
        </div>
        <div className="wuxing-legend">
          <span>━▶ 相生（绿色）</span>
          <span>┅▶ 相克（红色虚线）</span>
        </div>
      </div>

      <div className="result-card">
        <div className="result-card-title"><SectionIcon name="target" /> 用神喜忌与调候建议</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-6px 0 14px' }}>
          喜用神 = 命盘需要、能带来平衡的五行（多加扶持）；忌神 = 已经过剩、会加剧失衡的五行（尽量规避）。
          每一项下方附对应「五行角色 · 季节/脏腑/情志 · 为什么喜/忌」说明，便于理解。
        </p>
        <div className="yongshen-grid">
          <div className="yongshen-card good">
            <div className="yongshen-title good">✅ 喜用神（要扶持 · 对五行平衡有利）</div>
            <div className="yongshen-list">
              {xiRaw.map((raw) => {
                const { wx, text } = explainYongshenItem(typeof raw === 'string' ? raw : String(raw ?? ''), 'xi');
                const iconMap: Record<string, string> = { 金: '⚙️', 木: '🌳', 水: '🌊', 火: '🔥', 土: '🌍' };
                return (
                  <div key={wx + text} className="yongshen-list-item">
                    <div className="yongshen-ic">{iconMap[wx] || '✨'}</div>
                    <div dangerouslySetInnerHTML={{ __html: text }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="yongshen-card bad">
            <div className="yongshen-title bad">❌ 忌神（要规避 · 会加剧失衡）</div>
            <div className="yongshen-list">
              {jiRaw.map((raw) => {
                const label = typeof raw === 'string' ? raw : String(raw ?? '');
                // 「燥土 / 湿土」等复合字，取最后一个字判断五行
                const wx = (() => {
                  const last = label.trim().slice(-1);
                  if (['金', '木', '水', '火', '土'].includes(last)) return last;
                  const first = label.trim().charAt(0);
                  if (['金', '木', '水', '火', '土'].includes(first)) return first;
                  return label;
                })();
                const { text } = explainYongshenItem(['金', '木', '水', '火', '土'].includes(wx) ? wx : '土', 'ji');
                const iconMap: Record<string, string> = { 金: '⚙️', 木: '🌳', 水: '🌊', 火: '🔥', 土: '🌍' };
                const display = ['金', '木', '水', '火', '土'].includes(wx) && label.length > 1 && label !== wx
                  ? text.replace(`<strong style="font-size:16px;">${wx}</strong>`, `<strong style="font-size:16px;">${label}</strong><span style="color:var(--text-muted);">（本命${wx}相关）</span>`)
                  : text;
                return (
                  <div key={wx + label} className="yongshen-list-item">
                    <div className="yongshen-ic">{iconMap[wx] || '⚠️'}</div>
                    <div dangerouslySetInnerHTML={{ __html: display }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="note-box">
          <strong className="tc-text-primary">调候方案：</strong>
          {(() => {
            const tips: ReactNode[] = [];
            const allLacking = [...lacking];
            const targets = [...allLacking, ...xiLabels].filter((v, i, arr) => arr.indexOf(v) === i);
            const WX_TIP: Record<string, ReactNode> = {
              '金': (
                <>佩戴白水晶/银饰、穿白色衣物（补金 · 对应：{WX_ROLE['金'].item.split('（')[0]}）<br />
                <span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['金'].whyBoost}</span></>
              ),
              '木': (
                <>多接触绿色植物、佩戴木质饰品（补木 · 对应：{WX_ROLE['木'].item.split('（')[0]}）<br />
                <span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['木'].whyBoost}</span></>
              ),
              '水': (
                <>办公桌放一杯水/鱼缸、穿深蓝色衣物（补水 · 对应：{WX_ROLE['水'].item.split('（')[0]}）<br />
                <span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['水'].whyBoost}</span></>
              ),
              '火': (
                <>穿红色衣物、佩戴紫水晶（补火 · 对应：{WX_ROLE['火'].item.split('（')[0]}）<br />
                <span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['火'].whyBoost}</span></>
              ),
              '土': (
                <>佩戴黄水晶/陶瓷、穿黄色衣物（补土 · 对应：{WX_ROLE['土'].item.split('（')[0]}）<br />
                <span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['土'].whyBoost}</span></>
              ),
            };
            const AVOID_TIP: Record<string, ReactNode> = {
              '金': (<>减少白色系/金属装饰、少做过度决断性事务<br /><span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['金'].whyCalm}</span></>),
              '木': (<>减少绿色/木质饰品、避免熬夜与大怒生闷气<br /><span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['木'].whyCalm}</span></>),
              '水': (<>避免过多黑色/深蓝/鱼缸摆设、睡前 1 小时少饮水防痰湿<br /><span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['水'].whyCalm}</span></>),
              '火': (<>避免过多红色装饰、忌长期熬夜/辛辣饮食防心火上炎<br /><span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['火'].whyCalm}</span></>),
              '土': (<>避免过多黄色/陶瓷、忌过度思虑与饮食不节防脾胃壅滞<br /><span style={{ color: 'var(--text-muted)' }}>原理：{WX_ROLE['土'].whyCalm}</span></>),
            };
            targets.slice(0, 3).forEach((wx) => {
              if (WX_TIP[wx]) tips.push(WX_TIP[wx]);
            });
            // 疏泄候选：忌神标签 + 实际偏旺五行（偏旺但后端没列为忌神时，也给出疏泄建议），去重取前 2
            [...jiLabels, ...strongLabels.filter((w) => !jiLabels.includes(w))].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 2).forEach((wx) => {
              if (AVOID_TIP[wx]) tips.push(AVOID_TIP[wx]);
            });
            if (tips.length === 0) tips.push('五行相对均衡，保持规律作息、恬淡饮食、心情平和即可。');
            // 纯 JSX 输出（避免字符串被 React escape 成 HTML 源码）
            const items = tips.length && typeof tips[0] !== 'string';
            return (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tips.map((t, i) => (
                  <div key={i} style={{ marginBottom: items ? 0 : 6 }}>
                    {items ? (
                      <>
                        <strong style={{ color: 'var(--primary-light)' }}>{i + 1}.</strong>{' '}{t}
                      </>
                    ) : (
                      <>{t}</>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* === 新增：五行 · 调候对照表（本命每个五行逐条讲清楚）=== */}
      <div className="result-card">
        <div className="result-card-title"><SectionIcon name="pentagon" /> 五行 · 调候对照表</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6, marginBottom: 12 }}>
          下表按「金 · 木 · 水 · 火 · 土」顺序列出你的命盘里每个五行的状态，并说明它对应身体、性格、生活中的哪些地方，以及你该怎么对待它。
        </p>
        <div className="wuxing-reference-table">
          {(['金', '木', '水', '火', '土'] as const).map((wx) => {
            const r = WX_ROLE[wx];
            const st = labelState[wx] || '均衡';
            const pct = labelPct[wx];
            const stCls = st === '偏旺' ? 'st-strong' : st === '偏弱' ? 'st-weak' : st === '缺失' ? 'st-lack' : 'st-normal';
            const stTag = st === '偏旺' ? `⬆️ ${st}` : st === '偏弱' ? `⬇️ ${st}` : st === '缺失' ? `✕ ${st}` : `✓ ${st}`;
            const isXi = xiLabels.includes(wx);
            const isJi = jiLabels.includes(wx);
            const headTag = isXi ? '<span class="tag tag-xi">喜用</span>' : isJi ? '<span class="tag tag-ji">忌神</span>' : '';
            // 具体调候动作：按状态生成（基于 WX_ROLE）
            let action = '';
            if (st === '缺失' || st === '偏弱' || isXi) {
              action = `【扶持】${r.item}｜${r.life}`;
            } else if (st === '偏旺' || isJi) {
              action = `【疏泄】${r.whyCalm}｜建议：以克/泄五行来平衡（详见上方喜用神/忌神卡）`;
            } else {
              action = '【保持】当前五行占比均衡，规律作息即可。可按季节适当微调：' + r.season + '注意当令养护。';
            }
            const pctText = typeof pct === 'number' ? `${pct}%` : '—';
            return (
              <details key={wx} className="wxref-row" open>
                <summary className="wxref-head">
                  <span className={`wxref-state ${stCls}`}>{stTag}</span>
                  <span className="wxref-wx" style={{ color: WUXING_BG_TEXT_COLOR[wx] || 'inherit' }}>
                    {WX_ICON[wx]} {wx}
                  </span>
                  <span className="wxref-pct">{pctText}</span>
                  <span className="wxref-brief">{r.color} · {r.dir} · {r.organ.split(' · ')[0]}</span>
                  <span className="wxref-tag" dangerouslySetInnerHTML={{ __html: headTag }} />
                </summary>
                <div className="wxref-body">
                  <div className="wxref-col">
                    <div className="wxref-subtitle">五行角色</div>
                    <ul className="wxref-ul">
                      <li>季节：{r.season}</li>
                      <li>脏腑（中医）：{r.organ}</li>
                      <li>情志（情绪影响）：{r.emotion}</li>
                      <li>颜色 / 方位：{r.color} / {r.dir}</li>
                    </ul>
                  </div>
                  <div className="wxref-col">
                    <div className="wxref-subtitle">性格表现</div>
                    <div>{r.personality}</div>
                  </div>
                  <div className="wxref-col">
                    <div className="wxref-subtitle">
                      在你命盘中：
                      {st === '偏旺'
                        ? <span className="tc-red">{st}（{pctText}）</span>
                        : st === '偏弱'
                          ? <span className="tc-green">{st}（{pctText}）</span>
                          : st === '缺失'
                            ? <span className="tc-blue">{st}（0%）</span>
                            : <span className="tc-secondary">{st}（{pctText}）</span>}
                    </div>
                    <div>
                      {st === '缺失'
                        ? r.whyBoost.replace(/水气不足或缺水/, '五行缺水').replace(/金气不足或缺金/, '五行缺金').replace(/木气不足或缺木/, '五行缺木').replace(/火气不足或缺火/, '五行缺火').replace(/土气不足或缺土/, '五行缺土')
                        : st === '偏弱'
                          ? r.whyBoost
                          : st === '偏旺'
                            ? r.whyCalm
                            : `当前此五行占比均衡，是整体格局里的稳定力量。注意当令季节养护即可（${r.season}）。`}
                    </div>
                  </div>
                  <div className="wxref-col wide">
                    <div className="wxref-subtitle">具体调候建议（怎么做 + 为什么）</div>
                    <div>{action}</div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </>
  );
}
