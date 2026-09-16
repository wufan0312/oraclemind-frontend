'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Locale = 'en' | 'zh';
const STORAGE_KEY = 'om_locale';

// 中文为完整键源；英文为出海默认语言（首发市场：欧美全球）
const zh = {
  nav: {
    home: '首页', bugua: '卜卦', tarot: '塔罗', horoscope: '星座',
    numerology: '数字密码', ming: '测字·起名·合婚', dream: '周公解梦',
    fengshui: '风水', healing: '疗愈', trajectory: '成长轨迹',
    report: '我的报告', member: '开通会员', login: '登录',
    profile: '个人中心', notifications: '消息通知', logout: '退出登录',
  },
  home: {
    badge: '✨ AI 驱动 · 多术数文化体验 · 传统术数的现代演绎',
    title: '探索未知的自己，从玄镜开始',
    sub1: '跨越东西方千年智慧，融汇八字、紫微、塔罗、星座、数字命理与风水之精髓',
    sub2: 'AI 为您量身推演专属命理方案，让每一步抉择皆有迹可循。',
    cta: '开始免费排盘 →',
    assistantTitle: '小玄 · 通用命理助手',
    assistantStatus: '在线 · 事业/感情/财运/健康都能聊',
    inputPlaceholder: '例如：我最近事业遇到瓶颈，不知道该不该换工作…',
    sug1: '💰 今年财运怎么样？',
    sug2: '💕 我和TA适合在一起吗？',
    sug3: '🌙 最近总是失眠做噩梦',
    sug4: '🚀 事业转型时机分析',
    sug5: '🔥 我的命格五行缺什么？',
    feat: {
      bugua: '卜卦', buguaDesc: '排盘·多术数推演 · 点击开始',
      ming: '测字起名', mingDesc: '测字·五格·起名·合婚',
      tarot: '塔罗', tarotDesc: '5种牌阵·AI情境解读',
      horoscope: '星座', horoscopeDesc: '本命盘·运势·配对',
      numerology: '数字密码', numerologyDesc: '生命灵数·九宫格·流年',
      dream: '周公解梦', dreamDesc: '梦境解析·吉凶预兆',
      fengshui: '风水', fengshuiDesc: '家居·八字喜忌·方位'
    },
  },
  footer: {
    brand: '玄镜',
    privacy: '隐私政策',
    data: '数据与删除',
    note: '玄镜为传统文化体验与心理自省工具，内容仅供娱乐参考，不构成任何医疗、法律、投资或人生决策依据；不适用于 18 岁以下用户。我们仅在本机或加密后端保存你提供的出生信息，你可随时在「个人中心」或隐私政策页删除。',
  },
  lang: { en: 'EN', zh: '中文' },
};

const en = {
  nav: {
    home: 'Home', bugua: 'Divination', tarot: 'Tarot', horoscope: 'Horoscope',
    numerology: 'Numerology', ming: 'Name & Match', dream: 'Dream',
    fengshui: 'Fengshui', healing: 'Healing', trajectory: 'Growth Trail',
    report: 'My Reports', member: 'Membership', login: 'Sign In',
    profile: 'Profile', notifications: 'Notifications', logout: 'Sign Out',
  },
  home: {
    badge: '✨ AI-powered · multi-system cultural experience · traditional arts, modern telling',
    title: 'Discover your unknown self, starting with Xuanjing',
    sub1: 'Bridging millennia of Eastern and Western wisdom — Bazi, Zi Wei, Tarot, astrology, numerology and fengshui.',
    sub2: 'AI crafts your personalized reading, so every choice has a thread to follow.',
    cta: 'Start free reading →',
    assistantTitle: 'Xuan · General Assistant',
    assistantStatus: 'Online · career / love / wealth / health',
    inputPlaceholder: "e.g. I've hit a career ceiling and wonder if I should switch jobs…",
    sug1: '💰 How is my wealth this year?',
    sug2: '💕 Are we a good match?',
    sug3: '🌙 I keep having bad dreams and insomnia',
    sug4: '🚀 Best timing for a career shift',
    sug5: '🔥 What element is my destiny missing?',
    feat: {
      bugua: 'Divination', buguaDesc: 'Charting · multi-system reading · start now',
      ming: 'Name & Match', mingDesc: 'Character reading · name analysis · matchmaking',
      tarot: 'Tarot', tarotDesc: '5 spreads · AI situational reading',
      horoscope: 'Astrology', horoscopeDesc: 'Natal chart · transits · synastry',
      numerology: 'Numerology', numerologyDesc: 'Life path · grid · yearly cycle',
      dream: 'Dream', dreamDesc: 'Dream analysis · omens',
      fengshui: 'Fengshui', fengshuiDesc: 'Home · elemental preference · directions'
    },
  },
  footer: {
    brand: 'Xuanjing',
    privacy: 'Privacy Policy',
    data: 'Data & Deletion',
    note: 'Xuanjing is a cultural experience and self-reflection tool. Content is for entertainment only and is not medical, legal, financial or life advice. Not for users under 18. We store only the birth info you provide, locally or in an encrypted backend, and you may delete it anytime from Profile or the Privacy Policy page.',
  },
  lang: { en: 'EN', zh: '中文' },
};

const DICTS = { en, zh } as const;

function lookup(dict: any, path: string): string | undefined {
  const v = path.split('.').reduce((o: any, k: string) => (o == null ? undefined : o[k]), dict);
  return typeof v === 'string' ? v : undefined;
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === 'en' || saved === 'zh') setLocaleState(saved);
    } catch { /* ignore */ }
  }, []);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN';
    }
  }, []);
  const t = useCallback((path: string, fallback?: string) => {
    const v = lookup(DICTS[locale], path);
    if (v != null) return v;
    const z = lookup(DICTS.zh, path);
    if (z != null) return z;
    return fallback ?? path;
  }, [locale]);
  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const c = useContext(I18nContext);
  if (!c) throw new Error('useI18n must be used within I18nProvider');
  return c;
}
