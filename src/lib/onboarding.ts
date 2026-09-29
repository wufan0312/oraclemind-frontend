'use client';

/**
 * 玄镜 · 新手引导（onboarding）
 * --------------------------------------------------------------------------
 * 首次访问展示分步引导浮层，讲清：认识玄镜 / AI 助手 / 六大功能 /
 * 成长体系 / 隐私安全。完成或跳过后在 localStorage 写标记，不再弹出。
 */

const ONBOARD_KEY = 'om_onboarded';

export interface OnboardStep {
  icon: string;
  title: string;
  desc: string;
  /** 可选锚点提示（高亮区域描述） */
  hint?: string;
}

export const ONBOARD_STEPS: OnboardStep[] = [
  {
    icon: '🔮',
    title: '认识玄镜',
    desc: '玄镜是 AI 驱动的多术数交叉验证平台，融合卜卦、塔罗、星座、数字命理、解梦、风水与疗愈，帮你从多角度理解当下处境。',
    hint: '所有功能都从顶部导航与首页宫格进入。',
  },
  {
    icon: '🤖',
    title: '随身 AI 助手',
    desc: '首页底部的 AI 助手可回答事业、感情、财运、健康等问题，需要完整命盘时会引导你进入对应模块深入分析。',
    hint: '直接打字提问，或点上方建议问题即可开始。',
  },
  {
    icon: '🧭',
    title: '六大功能',
    desc: '卜卦（梅花易数·奇门）、塔罗（5 种牌阵）、星座（本命盘·运势）、数字密码（生命灵数）、周公解梦、风水罗盘 —— 按需取用，互为印证。',
    hint: '首页中部功能宫格一键直达。',
  },
  {
    icon: '🪷',
    title: '成长体系',
    desc: '每日签到累积灵修值，使用各模块越多境界越高（初心→问道→…→大觉）。首页底部可查看等级进度与修行足迹。',
    hint: '坚持签到还能获得连续天数加成。',
  },
  {
    icon: '🛡️',
    title: '隐私与安全',
    desc: '测算仅供娱乐参考，不构成任何决策依据。登录后出生信息等敏感资料由后端加密存储，匿名态仅留在本机。',
    hint: '随时可在「个人中心」管理你的资料。',
  },
];

export function hasOnboarded(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(ONBOARD_KEY) === '1';
  } catch {
    return true;
  }
}

export function markOnboarded(): void {
  try {
    window.localStorage.setItem(ONBOARD_KEY, '1');
  } catch {
    /* 忽略 */
  }
}

export function resetOnboarded(): void {
  try {
    window.localStorage.removeItem(ONBOARD_KEY);
  } catch {
    /* 忽略 */
  }
}

export { ONBOARD_KEY };
