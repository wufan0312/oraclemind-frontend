'use client';

/**
 * 玄镜 · 付费权益（付费墙数据层）
 * --------------------------------------------------------------------------
 * 设计要点：
 * 1. 玄镜全部基础功能**永久免费**（含 AI 解读），付费项只覆盖「更长、更深的进阶内容」。
 * 2. 支付渠道未配置（stub）时：下单仅记录意图，用户可直接继续查看 —— 与后端
 *    `/donations` 在 stub 渠道下的语义一致（"支付通道正在接入中，可完整免费查看"）。
 * 3. 渠道一旦配置为微信（凭证到位），前端自动切到「扫码 + 轮询 paid」，
 *    **无需改业务代码**。
 * 4. 解锁状态落 `om_premium_unlocks`（本地 + 上云），是权益发放的**真源**；
 *    订单只是留痕，便于后续对账。
 *
 * 后端已就绪（2026-09-10）：`premium_orders` 表 + `/api/v1/premium`（plans / orders /
 * orders/{no} / orders/{no}/claim / notify / entitlements），金额由服务端商品目录定价，
 * 只传 itemId。下一步：把下单与轮询从 `createDonation/fetchDonation` 换成
 * `createPremiumOrder/fetchPremiumOrder`（api.ts 补封装），解锁判定可再叠加
 * `GET /premium/entitlements`（服务端真源，只认 status=paid）。
 */

import { setCloudItem } from '@/lib/cloudStore';

export type PremiumItemId =
  | 'tarot_deep'
  | 'astro_full'
  | 'all_access'
  | 'xinzhai_member'
  | 'dream_member'
  | 'resilience_assess';

export interface PremiumPlan {
  id: PremiumItemId;
  name: string;
  icon: string;
  priceYuan: number;
  tagline: string;
  perks: string[];
}

export const PREMIUM_PLANS: PremiumPlan[] = [
  {
    id: 'tarot_deep',
    name: '塔罗深度解读',
    icon: '🎴',
    priceYuan: 39,
    tagline: '单次解锁 · 针对这一局牌面',
    perks: [
      '逐牌长文解读（正逆位 / 牌阵位 / 元素互动）',
      '情境化行动建议与时间点提示',
      '可导出 PDF 留存',
    ],
  },
  {
    id: 'astro_full',
    name: '占星完整解读',
    icon: '🌟',
    priceYuan: 59,
    tagline: '本命盘 + 年度返照完整报告',
    perks: [
      '本命盘全维度解读（性格 / 事业 / 感情 / 财富）',
      '年度太阳返照主题与月度提示',
      '星盘与报告 PDF 导出',
    ],
  },
  {
    id: 'all_access',
    name: '全站通卡',
    icon: '👑',
    priceYuan: 99,
    tagline: '一次解锁 · 全模块进阶内容',
    perks: [
      '含塔罗深度解读 + 占星完整解读',
      '全模块进阶内容无限次查看',
      '优先体验新功能',
    ],
  },
  {
    id: 'xinzhai_member',
    name: '心斋会员',
    icon: '🪷',
    priceYuan: 19,
    tagline: '把心斋的安宁，带在身边',
    perks: [
      '专属心镜 · 每月一次的深度照见',
      '疗愈心斋全模块进阶内容',
      '优先体验冥想 / 共修新功能',
    ],
  },
  {
    id: 'dream_member',
    name: '解梦会员',
    icon: '🌙',
    priceYuan: 19,
    tagline: '更深的梦境照见 · 互助同梦',
    perks: [
      '解梦全视角深度档案（荣格 / 弗洛伊德 / 认知）',
      '梦境相似匹配与互助社区',
      '优先体验专家人工解读',
    ],
  },
  {
    // 合规付费（2026-09-18）：唯一在售的「新方向」商品——完全脱离生辰命盘，
    // 基于自评问卷出自我觉察报告，不给诊断、不算吉凶。不计入 PAUSED_ITEMS。
    id: 'resilience_assess',
    name: '复原力测评报告',
    icon: '🌱',
    priceYuan: 9.9,
    tagline: '单份 · 基于你此刻的自评（与生辰命盘无关）',
    perks: [
      '四维自我觉察报告（事业 / 关系 / 家庭 / 自我）',
      '压力—资源平衡快照 + 本周可做的三个微行动',
      '不给诊断、不算吉凶；报告可导出留存',
    ],
  },
];

/** 合规重定位（2026-09-17）：以下占卜类商品暂停销售，切断「获利引流」合规要件；
 *  保留 xinzhai_member / dream_member（疗愈·解梦，属自我觉察方向）。 */
export const PAUSED_ITEMS: PremiumItemId[] = ['tarot_deep', 'astro_full', 'all_access'];
export function isItemPaused(item: PremiumItemId): boolean {
  return (PAUSED_ITEMS as readonly string[]).includes(item);
}

/** 免费已包含的能力（付费墙必须写清楚，避免用户误以为基础功能要钱） */
export const FREE_PERKS: string[] = [
  '全部基础自我觉察工具与 AI 解读（卜卦 / 塔罗 / 星座 / 数字 / 解梦 / 疗愈）',
  '完整牌阵、每日塔罗、塔罗日记与牌义学习',
  '梦境日记、清醒梦引导、修行成长与签到',
  '报告保存、导出与跨设备同步',
];

// ===== 个人微信收款码支付（不走商户号，无自动回调，人工核对）=====
// 图片默认放 public/images/pay/wechat-qr.png；也可用 env NEXT_PUBLIC_PAY_QR_URL 指定外链。
// 个人收款码无法自动回调，因此采用「付款备注填核对码 + 用户点已完成 → 本地解锁 + 订单留痕」模式，
// 订单留痕用于后续人工对账（订单号含金额与套餐价对应关系）。
export const PAY_QR_URL = process.env.NEXT_PUBLIC_PAY_QR_URL || '/images/pay/wechat-qr.png';

/** 收款码支付步骤说明 */
export const PAY_QR_STEPS: string[] = [
  '用微信扫描下方收款码',
  '付款金额请与页面显示保持一致',
  '在付款备注中填写核对码（便于人工对账）',
  '完成后点「我已完成支付」即时解锁',
];

export const PREMIUM_KEY = 'om_premium_unlocks';

export interface UnlockRecord {
  item: PremiumItemId;
  orderNo: string;
  channel: string;
  amountFen: number;
  at: string; // ISO
}

export function planOf(item: PremiumItemId): PremiumPlan {
  return PREMIUM_PLANS.find((p) => p.id === item) || PREMIUM_PLANS[0];
}

export function loadUnlocks(): UnlockRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PREMIUM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 全站通卡解锁即视为全部解锁 */
export function isUnlocked(item: PremiumItemId): boolean {
  const list = loadUnlocks();
  return list.some((r) => r.item === item || r.item === 'all_access');
}

export function recordUnlock(rec: UnlockRecord): void {
  try {
    const next = [rec, ...loadUnlocks().filter((r) => r.item !== rec.item)].slice(0, 50);
    const val = JSON.stringify(next);
    window.localStorage.setItem(PREMIUM_KEY, val);
    setCloudItem(PREMIUM_KEY, val);
    window.dispatchEvent(new CustomEvent('om:premium-change'));
  } catch {
    /* 忽略 */
  }
}
