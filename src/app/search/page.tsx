'use client';

import '@/styles/search.scss';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// 功能入口索引（与首页宫格 + 全站路由对齐，独立维护避免与首页耦合）
const FEATURE_INDEX: { href: string; name: string; desc: string; icon: string }[] = [
  { href: '/bugua', name: '卜卦', desc: '梅花易数 · 奇门遁甲 · 多术数排盘推演', icon: '☯' },
  { href: '/ming', name: '测字起名', desc: '测字 · 五格 · 起名 · 合婚', icon: '✒️' },
  { href: '/tarot', name: '塔罗', desc: '5 种牌阵 · AI 情境解读 · 塔罗日记 · 牌义学习', icon: '🎴' },
  { href: '/horoscope', name: '星座', desc: '本命盘 · 运势 · 配对 · 太阳返照', icon: '✨' },
  { href: '/numerology', name: '数字密码', desc: '生命灵数 · 九宫格 · 流年 · 合盘', icon: '🔢' },
  { href: '/numerology', name: '天使数字', desc: '反复出现的数字序列解读 · 序列手账 · 个人天使数', icon: '👼' },
  { href: '/dream', name: '周公解梦', desc: '梦境解析 · 吉凶预兆 · 梦境日记', icon: '🌙' },
  { href: '/fengshui', name: '风水', desc: '家居 · 八字喜忌 · 方位罗盘 · 九宫飞星', icon: '🧭' },
  { href: '/healing', name: '疗愈', desc: '冥想引导 · 助眠声景 · 情绪追踪 · 诵经', icon: '🪷' },
  { href: '/report', name: '我的报告', desc: '综合报告 · 真太阳时校正 · 合婚合盘', icon: '📊' },
  { href: '/profile', name: '个人中心', desc: '账号资料 · 成长概览 · 修行足迹 · 占卜档案', icon: '👤' },
  { href: '/notifications', name: '通知中心', desc: '系统消息 · 功能更新 · 成长提醒', icon: '🔔' },
];

// 各模块本地记录源（结构可能差异，统一按 JSON 全文匹配，展示时提取常见字段）
const RECORD_SOURCES: { key: string; label: string; href: string; icon: string }[] = [
  { key: 'om_tarot_history', label: '塔罗占卜', href: '/tarot', icon: '🎴' },
  { key: 'om_tarot_diary', label: '塔罗日记', href: '/tarot', icon: '📔' },
  { key: 'om_dream_diary', label: '梦境日记', href: '/dream', icon: '🌙' },
  { key: 'om_numerology_history', label: '数字命理', href: '/numerology', icon: '🔢' },
  { key: 'om_ming_history', label: '测字起名', href: '/ming', icon: '✒️' },
  { key: 'om_cross_readings', label: '跨术数推演', href: '/report', icon: '🔮' },
];

function extractTitle(item: unknown, fallback: string): string {
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    for (const k of ['question', 'title', 'text', 'content', 'name', 'summary', 'q']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 60);
    }
  }
  if (typeof item === 'string') return item.slice(0, 60);
  return fallback;
}

function matchRecords(kw: string): { source: (typeof RECORD_SOURCES)[number]; title: string }[] {
  if (typeof window === 'undefined' || !kw) return [];
  const lower = kw.toLowerCase();
  const out: { source: (typeof RECORD_SOURCES)[number]; title: string }[] = [];
  for (const src of RECORD_SOURCES) {
    try {
      const raw = window.localStorage.getItem(src.key);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      // 倒序（最新在前），最多取 5 条
      for (let i = arr.length - 1; i >= 0 && out.filter((o) => o.source.key === src.key).length < 5; i--) {
        const s = JSON.stringify(arr[i]).toLowerCase();
        if (s.includes(lower)) {
          out.push({ source: src, title: extractTitle(arr[i], '（记录）') });
        }
      }
    } catch {
      /* 忽略解析失败 */
    }
  }
  return out;
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q') || '';
  const [input, setInput] = useState(q);

  useEffect(() => {
    setInput(q);
  }, [q]);

  const kw = q.trim().toLowerCase();

  const features = useMemo(() => {
    if (!kw) return FEATURE_INDEX;
    return FEATURE_INDEX.filter(
      (f) => f.name.toLowerCase().includes(kw) || f.desc.toLowerCase().includes(kw) || f.href.includes(kw)
    );
  }, [kw]);

  const records = useMemo(() => matchRecords(kw), [kw]);

  const submit = (val: string) => {
    const v = val.trim();
    router.push(v ? `/search?q=${encodeURIComponent(v)}` : '/search');
  };

  return (
    <div className="page active search-page">
      <div className="search-head">
        <h1 className="search-title">🔍 全局搜索</h1>
        <div className="search-box">
          <span className="search-box-icon">🔍</span>
          <input
            className="search-box-input"
            placeholder="搜索功能、或你过去的占卜记录…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(input);
            }}
          />
          <button className="search-box-btn" onClick={() => submit(input)}>搜索</button>
        </div>
      </div>

      {!kw ? (
        <div className="search-section">
          <div className="search-section-title">全部功能</div>
          <div className="search-features">
            {FEATURE_INDEX.map((f) => (
              <Link key={f.href} href={f.href} className="search-feature">
                <span className="search-feature-icon">{f.icon}</span>
                <span className="search-feature-main">
                  <span className="search-feature-name">{f.name}</span>
                  <span className="search-feature-desc">{f.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="search-meta">
            关键词「<strong>{q}</strong>」· 功能 {features.length} 项 · 记录 {records.length} 条
          </div>

          <div className="search-section">
            <div className="search-section-title">功能入口</div>
            {features.length === 0 ? (
              <div className="search-empty">没有匹配的功能</div>
            ) : (
              <div className="search-features">
                {features.map((f) => (
                  <Link key={f.href} href={f.href} className="search-feature">
                    <span className="search-feature-icon">{f.icon}</span>
                    <span className="search-feature-main">
                      <span className="search-feature-name">{f.name}</span>
                      <span className="search-feature-desc">{f.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="search-section">
            <div className="search-section-title">你的记录</div>
            {records.length === 0 ? (
              <div className="search-empty">
                没有匹配的记录
                <div className="search-empty-hint">记录来自本机存储的历史（塔罗 / 梦境 / 命理 / 测字 / 跨术数）</div>
              </div>
            ) : (
              <div className="search-records">
                {records.map((r, i) => (
                  <Link key={`${r.source.key}-${i}`} href={r.source.href} className="search-record">
                    <span className="search-record-src">{r.source.icon} {r.source.label}</span>
                    <span className="search-record-title">{r.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="page active search-page"><div className="search-head"><h1 className="search-title">🔍 全局搜索</h1></div></div>}>
      <SearchInner />
    </Suspense>
  );
}
