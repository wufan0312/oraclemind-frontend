'use client';

import type { InterpretMeta, InterpretResponse, SummaryResponse, LiuyaoLine } from '@/lib/api';
import { mdToHtml } from '@/lib/markdown';

/* ============================= 类型 ============================= */

/** 排盘来源状态：loading=请求中 / online=后端服务 / offline=降级演示数据 */
export type ModuleStatus = 'loading' | 'online' | 'offline';
// ModuleKey 已收口至跨页类型层 @/types（P3-1），此处 import 并再导出保持向后兼容。
import type { ModuleKey } from '@/types';
export type { ModuleKey };

export interface ModuleProps<T> {
  data?: T;
  status?: ModuleStatus;
}

export type SummaryState = SummaryResponse | 'loading' | 'error' | null;

/* ============================= 常量 ============================= */

/** 模块标签 id → AI 解读 module 名（mod-wuxing 复用 bazi 数据；mod-summary 暂不接入） */
export const TAB_TO_MODULE: Record<string, ModuleKey> = {
  'mod-bazi': 'bazi',
  'mod-wuxing': 'bazi',
  'mod-ziwei': 'ziwei',
  'mod-liuyao': 'liuyao',
  'mod-meihua': 'meihua',
  'mod-qimen': 'qimen',
  'mod-liuren': 'liuren',
  'mod-taiyi': 'taiyi',
};

/** 五行能量条背景（后端返回无 bg 字段，按五行映射原型配色） */
export const WUXING_BG: Record<string, string> = {
  '火': 'linear-gradient(90deg,#ff6b6b,#ff8e53)',
  '水': 'linear-gradient(90deg,#5ce1e6,#5b8def)',
  '土': 'linear-gradient(90deg,#d4a853,#e8c97e)',
  '木': 'linear-gradient(90deg,#4ade80,#6ee7b7)',
  '金': 'linear-gradient(90deg,#a0a0b8,#d4d4e8)',
};

/** 五行文本主色（用于对照表标题文字等） */
export const WUXING_BG_TEXT_COLOR: Record<string, string> = {
  '火': '#ff6b6b',
  '水': '#5b8def',
  '土': '#d4a853',
  '木': '#4ade80',
  '金': '#a0a0b8',
};

/** 五行图标 */
export const WX_ICON: Record<string, string> = { '金': '⚙️', '木': '🌳', '水': '🌊', '火': '🔥', '土': '🌍' };

/** 六爻爻线：原型演示数据已清空（liushen 及十二长生/月破/暗动/进退神等均为后端新增字段） */
export const LIUYAO_LINES: LiuyaoLine[] = [];

/** 奇门九宫：原型演示数据已清空 */
export const QIMEN_PALACES: { dir: string; star?: string; starColor?: string; door?: string; doorColor?: string; god?: string; comb?: string; combColor?: string; border?: string; bg?: string }[] = [];

/** 奇门三奇：原型演示数据已清空 */
export const QIMEN_QI: { title: string; text?: string; color?: string; bg?: string; border?: string }[] = [];

/** 综合共识度：AI 不可用时的本地兜底模板（通用，非针对具体排盘） */
export const SUMMARY_VERIFY: { label: string; pct: number; color: string; bg: string }[] = [
  { label: '事业运', pct: 80, color: '#4ade80', bg: 'linear-gradient(90deg,#4ade80,#5ce1e6)' },
  { label: '财运', pct: 76, color: '#d4a853', bg: 'linear-gradient(90deg,#d4a853,#e8c97e)' },
  { label: '感情运', pct: 72, color: '#ff6b9d', bg: 'linear-gradient(90deg,#ff6b9d,#ff8e53)' },
  { label: '健康', pct: 85, color: '#4ade80', bg: 'linear-gradient(90deg,#4ade80,#a78bfa)' },
  { label: '学业/成长', pct: 78, color: '#5ce1e6', bg: 'linear-gradient(90deg,#5ce1e6,#5b8def)' },
  { label: '人际/贵人', pct: 82, color: '#a78bfa', bg: 'linear-gradient(90deg,#a78bfa,#ff6b9d)' },
];

/** 综合卡片：AI 不可用时的本地兜底模板 */
export const SUMMARY_CARDS: { icon?: string; name: string; score?: string; scoreColor?: string; desc?: string }[] = [
  { icon: '📈', name: '近期趋势', score: '→ 平稳', scoreColor: 'var(--accent-gold)', desc: '当前处于蓄力期，宜深耕积累，不宜贸然变动。' },
  { icon: '🎯', name: '关键决策期', score: '待定', scoreColor: 'var(--primary-light)', desc: '需结合更多维度信息确定最佳行动窗口期。' },
  { icon: '⚠️', name: '风险提示', score: '中', scoreColor: '#ff6b6b', desc: '注意情绪管理，避免冲动决策。' },
  { icon: '💎', name: '天赋优势', score: '待发掘', scoreColor: 'var(--accent-green)', desc: '结合命盘格局，发掘自身独特天赋。' },
];

/** AI 行动建议：AI 不可用时的本地兜底模板 */
export const SUMMARY_ADVICE: { title: string; icon?: string; color?: string; bg?: string; border?: string; items?: string[] }[] = [
  { title: '立即行动', icon: '\u26A1', items: ['整理当前最紧迫的一件事，今天先迈出一小步', '记录今日心境与关键决策，便于后续复盘', '保持规律作息，先安顿身心再谈规划'] },
  { title: '短期（1-3月）', icon: '\uD83D\uDCC5', items: ['围绕核心目标深耕一项可落地的技能', '主动修复一段重要关系或解除一个心结', '建立简单的情绪 / 目标记录习惯'] },
  { title: '中长期（2027+）', icon: '\uD83D\uDE80', items: ['把握自身运势向上的窗口期，考虑进阶 / 转轨', '做稳健的中长期财务与职业规划', '定期关注健康，防患于未然'] },
];

/* ============================= 工具函数 ============================= */

/** AI 解读来源徽章文案 */
export function providerLabel(p: string): string {
  if (p === 'local-rules') return '本地规则';
  if (p === 'cache') return '';
  const names: Record<string, string> = { aliyun: '阿里云', deepseek: 'DeepSeek' };
  return names[p] || p;
}

/** 极简 Markdown → HTML（AI 服务输出受限格式：段落 / **加粗** / - 列表 / > 引用），不引入额外依赖 */
/** AI 服务会把免责声明内嵌在 text 尾部（withDisclaimer：`\n\n---\n免责声明`），
 *  而前端又单独渲染 disclaimer 字段 → 同一句显示两次。
 *  渲染前剥离内嵌版本（含前面的 --- 分隔线），保留样式化 disclaimer 块为唯一展示。 */
const INTERP_DISCLAIMER_TEXT = '以上内容由 AI 生成，仅供娱乐与传统文化参考，不构成任何决策、医疗、法律或投资依据。';
export function stripInterpDisclaimer(md: string): string {
  if (!md) return md;
  const idx = md.lastIndexOf(INTERP_DISCLAIMER_TEXT);
  if (idx === -1) return md;
  return md
    .slice(0, idx)
    .replace(/\n\s*-{3,}\s*$/, '')
    .replace(/\s+$/, '');
}

/** 流式占位 meta：AI 文本还在逐 chunk 生成中时，先给一个可被 InterpretResponse 类型接受的 meta（模块级，供各 Module 复用） */
export function makePlaceholderMeta(module: ModuleKey): InterpretMeta {
  return {
    requestId: 'bugua-streaming-placehold',
    module,
    promptVersion: 'streaming',
    provider: 'streaming',
    model: 'streaming',
    cacheHit: false,
    degraded: false,
    degradedReason: null,
    tokens: null,
    costYuan: 0,
    latencyMs: 0,
    truncated: false,
  };
}

/* ============================= 组件 ============================= */

/** 在线/离线来源标记徽章（模块卡片标题旁） —— 产品要求：全站不再展示此类标签 */
export function ApiBadge({ status }: { status?: ModuleStatus }) {
  return null;
}
