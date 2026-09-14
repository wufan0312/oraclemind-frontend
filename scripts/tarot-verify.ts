/**
 * 塔罗模块零依赖校验脚本（node --experimental-strip-types 运行，无需 vitest/jest）
 *
 * 覆盖：
 *   1. 牌库完整性：78 张、字段无缺失、同花色 num 唯一、牌阵 positions/positionDesc 等长
 *   2. 分维度牌义：78 张牌名对齐、四维度（感情/事业/财运/健康）非空
 *   3. 符号健康：无 ZWJ 组合 emoji、无重复 sym
 *   4. 抽牌分布：5000 次凯尔特十字，每张牌出现频次 σ 合理、逆位比例 ~32%
 *   5. 重抽有效性：同 seed 换 nonce，重合率低且无完全相同的两副牌
 *   6. 结论卡正则：与后端 formatter 输出格式「**🔮 结论**\n\n**倾向**：X　**能量分**：N/100」对齐
 *   7. 每日三牌逆位开关：切换「允许逆位」只改变正逆位，不得改变抽到哪几张牌
 *
 * 用法：npm run verify:tarot
 * （此前这些校验都是散落在会话里的内联命令，问题回归时无从复跑 —— 此脚本固化下来）
 */

import {
  tarotDeck, spreadData, drawCardsFromDeck, generateDailyTarot, DECK_SIZE,
} from '../src/data/tarotData.ts';
import { CARD_DIMENSIONS, DIMENSION_META } from '../src/data/tarotDimensions.ts';

let failed = 0;
const ok = (name: string, detail: string) => console.log(`  ✓ ${name}  ${detail}`);
const bad = (name: string, detail: string) => {
  failed++;
  console.error(`  ✗ ${name}  ${detail}`);
};

console.log('== 1. 牌库完整性 ==');
const names = Object.keys(tarotDeck);
if (names.length === 78 && DECK_SIZE === 78) ok('张数', '78/78'); else bad('张数', `${names.length} 张, DECK_SIZE=${DECK_SIZE}`);

const missing = names.filter((n) => {
  const c = tarotDeck[n];
  return !c.upright || !c.rev || !c.kw?.length || !c.sym || !c.element;
});
missing.length === 0 ? ok('字段完整性', 'upright/rev/kw/sym/element 全部非空') : bad('字段完整性', JSON.stringify(missing));

const bySuit: Record<string, number[]> = {};
for (const n of names) (bySuit[tarotDeck[n].suit] ??= []).push(tarotDeck[n].num);
for (const [s, nums] of Object.entries(bySuit)) {
  const dup = nums.filter((x, i) => nums.indexOf(x) !== i);
  dup.length === 0 ? ok(`num 唯一 · ${s}`, `${nums.length} 张`) : bad(`num 唯一 · ${s}`, `重复: ${dup}`);
}

for (const [k, s] of Object.entries(spreadData)) {
  s.count === s.positions.length && s.positions.length === s.positionDesc.length
    ? ok(`牌阵结构 · ${k}`, `${s.count} 位`)
    : bad(`牌阵结构 · ${k}`, `count=${s.count}, positions=${s.positions.length}, desc=${s.positionDesc.length}`);
}

console.log('== 2. 分维度牌义 ==');
{
  const dimNames = Object.keys(CARD_DIMENSIONS);
  const lack = names.filter((n) => !CARD_DIMENSIONS[n]);
  const extra = dimNames.filter((n) => !tarotDeck[n]);
  const blank: string[] = [];
  for (const n of names) {
    const d = CARD_DIMENSIONS[n] ?? {};
    for (const { key } of DIMENSION_META) {
      if (!(d[key] || '').trim()) blank.push(`${n}.${key}`);
    }
  }
  lack.length === 0 && extra.length === 0
    ? ok('牌名对齐', `${dimNames.length}/78 张，无多余项`)
    : bad('牌名对齐', `缺失: ${lack.join(',')} 多余: ${extra.join(',')}`);
  blank.length === 0
    ? ok('四维度非空', `${names.length * 4} 条全部有内容`)
    : bad('四维度非空', blank.slice(0, 6).join(','));
}

console.log('== 3. 符号健康 ==');
const zwj = names.filter((n) => tarotDeck[n].sym.includes('\u200d'));
zwj.length === 0 ? ok('无 ZWJ 组合', 'Windows/老内核不会碎成两截') : bad('ZWJ 组合', zwj.join(','));

const syms = names.map((n) => tarotDeck[n].sym);
const dupSym = [...new Set(syms.filter((s, i) => syms.indexOf(s) !== i))];
dupSym.length === 0 ? ok('符号不重复', '78 个 sym 互异') : bad('符号重复', dupSym.join(' '));

console.log('== 4. 抽牌分布（5000 次凯尔特十字）==');
const cnt: Record<string, number> = {};
names.forEach((n) => (cnt[n] = 0));
let rev = 0, total = 0;
for (let i = 0; i < 5000; i++) {
  for (const c of drawCardsFromDeck(spreadData.celtic, `probe:celtic:q${i}#0`)) {
    cnt[c.name]++;
    total++;
    if (c.isRev) rev++;
  }
}
const vals = Object.values(cnt);
const avg = total / 78;
const sd = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / 78);
sd < 60 ? ok('分布均匀', `均值 ${avg.toFixed(1)}, σ=${sd.toFixed(1)}, min=${Math.min(...vals)}, max=${Math.max(...vals)}`) : bad('分布均匀', `σ=${sd.toFixed(1)}`);
const revRate = (rev / total) * 100;
revRate > 28 && revRate < 36 ? ok('逆位比例', `${revRate.toFixed(1)}% (设定 32%)`) : bad('逆位比例', `${revRate.toFixed(1)}%`);

console.log('== 5. 重抽有效性（同 seed 换 nonce）==');
let overlapSum = 0, pairs = 0, identical = 0;
for (let t = 0; t < 100; t++) {
  let prev: string | null = null;
  for (let n = 0; n < 10; n++) {
    const sig = drawCardsFromDeck(spreadData.celtic, `probe:celtic:redraw${t}#${n}`)
      .map((c) => c.name + c.isRev).join('|');
    if (prev) {
      pairs++;
      if (prev === sig) identical++;
      const a = new Set(prev.split('|'));
      overlapSum += sig.split('|').filter((x) => a.has(x)).length / 10;
    }
    prev = sig;
  }
}
identical === 0 ? ok('无完全相同的两副', `${pairs} 组对比`) : bad('存在完全相同', `${identical} 次`);
const rate = (overlapSum / pairs) * 100;
rate < 25 ? ok('重合率', `${rate.toFixed(1)}% < 25%`) : bad('重合率', `${rate.toFixed(1)}%`);

console.log('== 6. 结论卡正则（与后端 formatter 约定格式对齐）==');
const VERDICT_RE = /\*\*🔮\s*结论\*\*\s*\n+\s*\*\*倾向\*\*：\s*(宜|中性|不宜)\s*　\s*\*\*能量分\*\*：\s*(\d{1,3})\s*\/\s*100/;
const samples = [
  '**🔮 结论**\n\n**倾向**：宜　**能量分**：75/100\n\n**整体概述**\n…',
  '**🔮 结论**\n\n**倾向**：不宜　**能量分**：18/100',
];
let allOk = true;
for (const s of samples) {
  const m = VERDICT_RE.exec(s);
  if (!m) { allOk = false; console.error(`    提取失败: ${JSON.stringify(s.slice(0, 30))}`); }
  else console.log(`    提取成功: ${m[1]} / ${m[2]}`);
}
allOk ? ok('正则提取', '2/2 样例通过') : bad('正则提取', '有样例提取失败');

const noVerdict = '普通文本解读，没有结论段';
VERDICT_RE.test(noVerdict) ? bad('降级安全', '误匹配了无结论文本') : ok('降级安全', '无结论段时不渲染卡片');

console.log('== 7. 每日三牌「允许逆位」开关 ==');
{
  const dates = ['2026-01-01', '2026-06-15', '2026-12-31'];
  let nameStable = true;
  let revCleared = true;
  for (const d of dates) {
    const on = generateDailyTarot(d, true);
    const off = generateDailyTarot(d, false);
    // 开关只影响正逆位，不能改变抽到哪几张牌（否则「同一天同一副牌」就不成立了）
    const sig = (x: typeof on) => [x.theme.name, ...x.cards.map((c) => c.name)].join('|');
    if (sig(on) !== sig(off)) nameStable = false;
    if (off.theme.isRev || off.cards.some((c) => c.isRev)) revCleared = false;
  }
  nameStable ? ok('牌面不受开关影响', `${dates.length} 个日期比对`) : bad('牌面受开关影响', '关闭逆位后抽到的牌变了');
  revCleared ? ok('关闭后无逆位', '主题牌 + 三张牌均为正位') : bad('关闭后仍有逆位', '开关没生效');

  let revN = 0;
  let total = 0;
  for (let i = 0; i < 300; i++) {
    const d = `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
    const deal = generateDailyTarot(d, true);
    total += 4;
    if (deal.theme.isRev) revN++;
    revN += deal.cards.filter((c) => c.isRev).length;
  }
  const r = (revN / total) * 100;
  r > 20 && r < 45 ? ok('开启时逆位比例', `${r.toFixed(1)}%（设定 32%）`) : bad('开启时逆位比例', `${r.toFixed(1)}%`);
}

console.log(failed === 0 ? '\n全部通过 ✓' : `\n${failed} 项失败 ✗`);
process.exit(failed === 0 ? 0 : 1);
