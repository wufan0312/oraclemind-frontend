// ===== 卜卦 · 排盘数据 =====
// moduleAIContent 改为"动态生成"：subtitle 为固定文案；buildHtml(ctx) 基于真实排盘数据生成专属解读模板
// （不再使用原型硬编码的「五行火偏旺(30%)」等常量，避免与真实命盘严重不符）

import type {
  BaziAPIResult,
  LiuyaoAPIResult,
  LiuRenAPIResult,
  MeihuaAPIResult,
  QimenAPIResult,
  TaiyiAPIResult,
  ZiweiAPIResult,
} from '@/lib/api';

/** 动态构建 AI 解读内容的 context（按模块名分发，未知字段可选） */
export interface AIContentCtx {
  bazi?: BaziAPIResult;
  ziwei?: ZiweiAPIResult;
  liuyao?: LiuyaoAPIResult;
  meihua?: MeihuaAPIResult;
  qimen?: QimenAPIResult;
  liuren?: LiuRenAPIResult;
  taiyi?: TaiyiAPIResult;
  summaryConsensus?: string[];
  /** 用户本轮实际勾选的术数（MODULE_CHIPS 顺序）—— 综合运势兜底文案按它生成，不再写死全量术数 */
  selectedNames?: string[];
}

export interface ModuleAIContent {
  subtitle: string;
  /** 基于真实排盘数据动态渲染解读模板；无数据时返回通用稳妥文案 */
  buildHtml: (ctx: AIContentCtx) => string;
}

// ===== 工具：安全 HTML 构建 =====
const P = (s: string) => `<p style="margin-bottom:10px;">${s}</p>`;
const P_LAST = (s: string) => `<p>${s}</p>`;
const RED = (s: string) => `<strong style="color:#ff6b6b;">${s}</strong>`;
const GREEN = (s: string) => `<strong style="color:#4ade80;">${s}</strong>`;
const BLUE = (s: string) => `<strong style="color:#60a5fa;">${s}</strong>`;
const GOLD = (s: string) => `<strong style="color:#d4a853;">${s}</strong>`;
const B = (s: string) => `<strong>${s}</strong>`;

// 各五行调候建议（避免空口推荐）
const WX_TIP: Record<string, string> = {
  '金': '佩戴白水晶/银饰可有效补金气，提升决断力',
  '木': '多接触绿色植物或佩戴木质饰品补木，养肝气',
  '水': '多接触水元素（游泳、泡澡、住在近水处）以补水',
  '火': '穿红色衣物、佩戴紫水晶补火，提精神',
  '土': '佩戴黄水晶/陶瓷饰品、穿黄色衣物补土，稳脾胃',
};
const WX_CHAR: Record<string, string> = {
  '金': '金弱则决断力不足，',
  '木': '木弱则气血不畅、容易疲惫，',
  '水': '水弱则思虑过甚、睡眠不佳，',
  '火': '火多则性急、易冲动，',
  '土': '土重则思虑厚重、容易精神内耗，',
};
const WX_AVOID: Record<string, string> = {
  '金': '金过旺则易锋芒毕露，宜多柔和低调、收敛锋芒',
  '木': '木旺则易刚愎自用，宜多倾听他人意见',
  '水': '水过旺则易游移不定，宜坚持规划、聚焦主目标',
  '火': '',
  '土': '土重多疑多虑，宜果断行动、减少反复权衡',
};

// ===== 模块 1：八字 =====
function buildBaziHtml(ctx: AIContentCtx): string {
  const b = ctx.bazi;
  if (!b) {
    return P('八字排盘数据尚未生成，点击上方「开始排盘」查看专属解读。') +
      P_LAST(`也可直接查看右侧「五行能量」与「用神喜忌」卡片，掌握基础五行结构。`);
  }
  const dm = b.dayMaster || '日主';
  const dmWx = b.dayMasterWuxing || '';
  const monthZhi = b.pillars?.[1]?.zhi || '';
  const xi = b.yongshen?.xi || [];
  const ji = b.yongshen?.ji || [];
  const wx = b.wuxing || [];
  const sorted = [...wx].sort((a, b) => b.pct - a.pct);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const lack = (b.lacking && b.lacking.length) ? b.lacking : undefined;
  const cur = b.dayun?.find((d) => d.primary) || b.dayun?.[0];
  const nextLiu = b.liunian?.[0];

  const p1 = `日主${B(dm)}${dmWx ? `（${dmWx}行）` : ''}${monthZhi ? `生于${monthZhi}月` : ''}。` +
    (strongest ? `五行以${B(strongest.label)}最旺（${strongest.pct}%）` : '') +
    (weakest ? `，${GREEN(weakest.label + '最弱' + (weakest.pct != null ? `（${weakest.pct}%）` : ''))}` : '') +
    (lack ? `，${BLUE('缺' + lack.join('、'))}` : '') + '。';
  const p2 = (xi.length || ji.length)
    ? `用神取${B(xi.join('、') || '待定')}${ji.length ? `；忌${B(ji.join('、'))}` : ''}。`
    : `调候以${dmWx ? B('平衡五行为上') : B('顺势调候')}为要。`;
  const p3 =
    (cur ? `当前大运${B(cur.age)} ${cur.gan}${cur.note ? '（' + cur.note + '）' : ''}` : '') +
    (nextLiu ? `，${B(nextLiu.yr + '年')}${nextLiu.gan}${nextLiu.note ? '：' + nextLiu.note : ''}` : '') +
    '，顺势而为。';
  return P(p1) + P(p2) + P_LAST(p3);
}

// ===== 模块 2：五行能量 =====
function buildWuxingHtml(ctx: AIContentCtx): string {
  const b = ctx.bazi;
  const wx = b?.wuxing || [];
  // 无数据：返回通用提示（不写死任何假百分比）
  if (!wx.length) {
    return P('五行排盘数据尚未生成，点击上方「开始排盘」查看你的五行能量分布。') +
      P_LAST('调候总原则：缺则补之、过则抑之，五行平衡方为上。');
  }
  const sorted = [...wx].sort((a, b) => b.pct - a.pct);
  const maxWx = sorted[0];
  const minWx = sorted[sorted.length - 1];
  const strongWx = sorted.filter((w) => w.pct >= 30);
  const weakWx = sorted.filter((w) => w.pct <= 10 && w.pct > 0);
  const zeroWx = sorted.filter((w) => w.pct === 0);
  const lacks = b?.lacking && b?.lacking.length ? b.lacking : zeroWx.map((w) => w.label);

  const p1 = '五行' +
    (strongWx.length ? RED(`${strongWx.map((w) => `${w.label}偏旺（${w.pct}%）`).join('、')}`) : '') +
    ((strongWx.length && (weakWx.length || lacks.length)) ? '，' : '') +
    ((weakWx.length || lacks.length)
      ? GREEN([...lacks.map((l) => l + '缺失'), ...weakWx.map((w) => `${w.label}偏弱（${w.pct}%）`)].join('、'))
      : '') +
    (!strongWx.length && !weakWx.length && !lacks.length ? '能量较为均衡' : '') +
    '。';
  // 过旺提示
  let p2 = '';
  const overWx = strongWx[0] || maxWx;
  if (overWx) {
    const tip = WX_AVOID[overWx.label] || WX_CHAR[overWx.label];
    if (tip) p2 = P(tip + `建议多接触${B(getCounterElement(overWx.label))}元素以平衡。`);
    else p2 = P(`${overWx.label}${overWx.pct != null ? `（${overWx.pct}%）` : ''}为主导，顺势而为、不可强行压制。`);
  }
  // 补弱/补缺
  const targets = [...lacks, ...weakWx.map((w) => w.label)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 2);
  const tipTargets = targets.length ? targets : (minWx ? [minWx.label] : []);
  const tipArr: string[] = [];
  tipTargets.forEach((wx1) => {
    if (WX_TIP[wx1]) tipArr.push(WX_TIP[wx1]);
  });
  const p3 = tipArr.length ? tipArr.join('；') + '。' : '五行能量相对均衡，保持规律作息即可。';
  return P(p1) + (p2 || '') + P_LAST(p3);
}
/** 找某五行的平衡元素（克 = 抑；生 = 补弱）。弱用生扶、旺用克泄。 */
function getCounterElement(wx: string): string {
  const KE: Record<string, string> = { '木': '金', '火': '水', '土': '木', '金': '火', '水': '土' };
  const SHENG: Record<string, string> = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
  // 此处用于"过旺需抑制"，取克者
  return KE[wx] || SHENG[wx] || wx;
}

// ===== 模块 3：紫微 =====
function buildZiweiHtml(ctx: AIContentCtx): string {
  const z = ctx.ziwei;
  if (!z) {
    return P('紫微斗数排盘尚未生成，点击上方「开始排盘」查看专属星盘解读。') +
      P_LAST('紫微以命宫为核心，财帛、官禄、迁移、疾厄四宫为四大辅助宫位。');
  }
  const mg = z.mingGong || '命宫';
  const sg = z.shenGong || '身宫';
  const wj = z.wuxingJu || '';
  const zw = z.ziwei || '';
  const sihua = z.sihua || [];
  const traits = z.traits || [];
  const trait1 = traits[0];

  const p1 = `${B(mg)}坐命，身宫在${B(sg)}${wj ? `，${B(wj)}` : ''}。紫微星落在${B(zw)}宫，先天格局定位清晰。`;
  const p2 = sihua.length
    ? `四化：${sihua.slice(0, 3).map((s) => `${s.star}化${s.hua}(${s.palace})`).join('、')}，为人生关键推力。`
    : '结合四化（禄权科忌）可进一步判断各宫吉凶力量方向。';
  const p3 = trait1
    ? `${B(trait1.name)}特质突出：${trait1.stars}——发挥天赋可事半功倍。`
    : '核心特质可结合命宫主星与三方四正综合判断。';
  return P(p1) + P(p2) + P_LAST(p3);
}

// ===== 模块 4：六爻 =====
function buildLiuyaoHtml(ctx: AIContentCtx): string {
  const l = ctx.liuyao;
  if (!l) {
    return P('六爻尚未起卦，先输入想问的问题，再点击「开始排盘」。') +
      P_LAST('六爻以动爻为事机、用神为主宰，兼看世应与日辰月建。');
  }
  const ben = l.benGua;
  const bian = l.bianGua;
  const ys = (l.yongshen as any) || {};
  const ysName: string = ys.name || '（待定）';
  const ysTendency: string | undefined = (ys as any).tendency;
  const ysStrength: string | undefined = (ys as any).strength;
  const ysNote: string | undefined = (ys as any).hostNote;
  const dong = l.dongYao;
  const posNames = ['初爻', '二爻', '三爻', '四爻', '五爻', '六爻'];
  const dongName = posNames[dong - 1] || `${dong}爻`;
  const dongLine = l.lines[dong - 1];
  const p1 = `本卦「${B(ben?.name || '待定')}」${ben?.desc ? '（' + ben.desc + '）' : ''}。${B(dongName + dongLine?.shishen)}动，为事机所在。`;
  const p2 = `以${B(ysName)}为用神` + (ysNote ? `：${ysNote}` : '') +
    (ysStrength ? `；月令${B(ysStrength)}` : '') +
    (ysTendency ? `；综合${GOLD(ysTendency)}` : '') + '。';
  const p3 = bian
    ? `变出「${B(bian.name)}」，${bian.desc ? bian.desc + '；' : ''}本卦为当下之象，变卦为结局之象，察其变可知趋势。`
    : '卦逢六静，无动爻则事未发动，宜先谋后动、待机而行。';
  return P(p1) + P(p2) + P_LAST(p3);
}

// ===== 模块 5：梅花易数 =====
function buildMeihuaHtml(ctx: AIContentCtx): string {
  const m = ctx.meihua;
  if (!m) {
    return P('梅花易数尚未起卦，先输入想问的问题，再点击「开始排盘」。') +
      P_LAST('梅花以体用生克为主，互卦见中间过程，变卦定最终吉凶。');
  }
  const ben = m.benGua;
  const bian = m.bianGua;
  const hu = m.huGua;
  const ti = m.ti;
  const yong = m.yong;
  const ty = m.tiYong;
  const posNames = ['初爻', '二爻', '三爻', '四爻', '五爻', '六爻'];
  const dongName = posNames[m.dongYao - 1] || `${m.dongYao}爻`;
  const p1 = `本卦「${B(ben.name)}」${ben.desc ? '（' + ben.desc + '）' : ''}。体卦${B(ti.name + '（' + ti.wuxing + '行）')}，用卦${B(yong.name + '（' + yong.wuxing + '行）')}。`;
  const p2 = `体用关系：${B(ty?.relation || '待定')}——${ty?.desc || ''}${ty?.ji ? '，吉凶：' + GOLD(ty.ji) : ''}。`;
  const p3 = `${dongName}发动${ty?.dongNote ? '：' + ty.dongNote : ''}。` +
    (hu ? `互卦「${hu.name}」主事之过程；` : '') +
    (bian ? `变卦「${bian.name}」定事之结局。` : '卦无变爻，体用定全局。');
  return P(p1) + P(p2) + P_LAST(p3);
}

// ===== 模块 6：奇门遁甲 =====
function buildQimenHtml(ctx: AIContentCtx): string {
  const q = ctx.qimen;
  if (!q) {
    return P('奇门遁甲排盘尚未生成，点击上方「开始排盘」查看九宫格局。') +
      P_LAST('奇门以值符值使为枢，九宫八门八神合参，辨方位与行事时机。');
  }
  const vf = q.valueFu || '';
  const vs = q.valueShi || '';
  const type = q.type || '';
  const jq = q.jieqi || '';
  // 找最吉宫：以吉门(开休生)+吉神(值符/太阴/六合/九天)优先
  const palaces = q.palaces || [];
  const goodDoor = ['开门', '休门', '生门'];
  const goodGod = ['值符', '太阴', '六合', '九天'];
  const badDoor = ['死门', '惊门', '伤门', '杜门'];
  const best = palaces
    .map((p, i) => ({ p, i, s: (goodDoor.includes(p.door) ? 5 : 0) + (goodGod.includes(p.god) ? 3 : 0) + (p.jixiong === '吉' ? 2 : 0) }))
    .sort((a, b) => b.s - a.s)[0];
  const worst = palaces
    .map((p, i) => ({ p, i, s: (badDoor.includes(p.door) ? 5 : 0) + (p.jixiong === '凶' ? 2 : 0) }))
    .sort((a, b) => b.s - a.s)[0];
  const qi1 = q.qi?.[0];
  const p1 = `${B(type)}，节气${B(jq)}；值符${B(vf)}、值使${B(vs)}，格局主轴已定。`;
  const p2 = best
    ? `今日${B('最吉方位')}为${B(best.p.dir)}（${best.p.door}·${best.p.god}），利主动行事。`
    : '九宫中吉门吉神并临之宫为最佳方位。';
  const p3 = worst
    ? `避开${B(worst.p.dir)}（${worst.p.door}），此方向${GOLD('今日不宜有大动作')}。` +
      (qi1 ? `${qi1.title}：${qi1.text}` : '')
    : (qi1 ? `${qi1.title}：${qi1.text}` : '可结合八神八门九宫综合选择行动方向。');
  return P(p1) + P(p2) + P_LAST(p3);
}

// ===== 模块 7：综合运势 =====
function buildSummaryHtml(ctx: AIContentCtx): string {
  const consensus = ctx.summaryConsensus || [];
  const sel = ctx.selectedNames || [];
  const hasBazi = sel.includes('八字') || sel.includes('五行能量');
  const b = hasBazi ? ctx.bazi : undefined;
  const ys = b?.yongshen?.xi || [];
  // 兜底文案按用户实际勾选的术数生成，不再写死全量术数清单
  const p1 = consensus.length
    ? `多术数在${B('「' + consensus.join('」「') + '」')}等方面高度一致，可放心参考。`
    : sel.length >= 2
      ? `已根据你勾选的${B(sel.join('、'))}进行交叉分析，各术数结论互相印证，更具参考性。`
      : '多术数交叉验证后，结论更具参考性。';
  const p2 = ys.length ? `调候上以${B(ys.join('、'))}为喜，日常可针对性补足。` : '调候以平衡五行为第一要义。';
  const p3 = '这是一个厚积薄发型的蓄力阶段——现在做的每一点积累，都会在关键节点兑现。建议：不要焦虑于当下的瓶颈，它是你跃迁前的蓄力期。';
  return P(p1) + P(p2) + P_LAST(p3);
}

// ===== 模块 8：大六壬 =====
function buildLiurenHtml(ctx: AIContentCtx): string {
  const d = ctx.liuren;
  if (!d) {
    return P('大六壬起课数据尚未生成，点击上方「开始排盘」查看四课三传。') +
      P_LAST('大六壬以月将加占时立天地盘，由四课三传推演事机。');
  }
  const sc = d.sanChuan;
  const chu = sc.items[0];
  const p1 = `课体为${B(sc.keTi)}，取${B(sc.method)}发用；初传${chu ? B(chu.label + chu.gan + chu.zhi) : '待定'}${chu?.kongWang ? '（空亡）' : ''}。`;
  const p2 = `日辰${B(d.riGanZhi)}，月将${B(d.yueJiang)}加${B(d.zhanShi + '时')}，贵人${B(d.guiRen.zhi)}（${d.guiRen.dayNight}）。`;
  const p3 = (d.fuYin || d.fanYin)
    ? `课逢${d.fuYin ? '伏吟' : ''}${d.fanYin ? '反吟' : ''}，事多反复，宜静观其变、以守为攻。`
    : '四课三传顺布，可结合用神与课体判断事之吉凶成败。';
  return P(p1) + P(p2) + P_LAST(p3);
}

// ===== 模块 9：太乙神数 =====
function buildTaiyiHtml(ctx: AIContentCtx): string {
  const d = ctx.taiyi;
  if (!d) {
    return P('太乙神数排局数据尚未生成，点击上方「开始排盘」查看年计太乙。') +
      P_LAST('太乙以积年求宫，观主客、文昌、始击以断天地人之气。');
  }
  const p1 = `${B(d.ganZhi)}年，太乙积年${B(String(d.jiNian))}，七十二局第${B(String(d.ju))}局，${d.dun}。`;
  const p2 = `太乙居${B(d.taiYiGong.gong + '宫')}（${d.taiYiGong.pos}），主算${B(String(d.zhuSuan))} / 客算${B(String(d.keSuan))}。`;
  const p3 = d.verdict
    ? `主客判断：${B(d.verdict)}。`
    : '可据主客算、文昌始击与十六宫神位综合推断年运。';
  return P(p1) + P(p2) + P_LAST(p3);
}

/** 9 个术数模块的 AI 解读内容（全部动态渲染，不写死任何假数据） */
export const moduleAIContent: Record<string, ModuleAIContent> = {
  'mod-bazi': { subtitle: '八字四柱 · 同步解读', buildHtml: buildBaziHtml },
  'mod-wuxing': { subtitle: '五行能量 · 排盘同步解读', buildHtml: buildWuxingHtml },
  'mod-ziwei': { subtitle: '紫微斗数 · 排盘同步解读', buildHtml: buildZiweiHtml },
  'mod-liuyao': { subtitle: '六爻起卦 · 排盘同步解读', buildHtml: buildLiuyaoHtml },
  'mod-meihua': { subtitle: '梅花易数 · 排盘同步解读', buildHtml: buildMeihuaHtml },
  'mod-qimen': { subtitle: '奇门遁甲 · 排盘同步解读', buildHtml: buildQimenHtml },
  'mod-liuren': { subtitle: '大六壬 · 起课同步解读', buildHtml: buildLiurenHtml },
  'mod-taiyi': { subtitle: '太乙神数 · 排局同步解读', buildHtml: buildTaiyiHtml },
  'mod-summary': { subtitle: '综合运势 · 多术数共识总论', buildHtml: buildSummaryHtml },
};

export interface SpiritTip {
  tag: string;
  cls: string;
  text: string;
}

/** 精灵小玄提示（轮播） */
export const spiritTips: SpiritTip[] = [
  { tag: '💡 引导', cls: 'tip-tag-guide', text: '点击术数 chip 可自由组合，也可一键全选' },
  { tag: '📖 冷知识', cls: 'tip-tag-lore', text: '八字源于唐代李虚中，以年柱为主；到宋代徐子平才发展为四柱八字' },
  { tag: '🔮 小贴士', cls: 'tip-tag-fact', text: '出生时辰不确定？选「不详」，AI 会用日柱+卦象帮你补偿推算' },
  { tag: '💡 引导', cls: 'tip-tag-guide', text: '填好信息后点「开始排盘」，7 种术数结果一键全出' },
  { tag: '📖 冷知识', cls: 'tip-tag-lore', text: '紫微斗数相传为陈抟老祖所创，以紫微星为首，故称「紫微」' },
  { tag: '🔮 小贴士', cls: 'tip-tag-fact', text: '奇门遁甲中「三奇」指乙丙丁，得三奇吉门者百事可为' },
  { tag: '💡 引导', cls: 'tip-tag-guide', text: '想问感情选「八字+塔罗+梅花」，想问事业选「八字+紫微+奇门」' }
];
