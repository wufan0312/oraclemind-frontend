'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  requestMingAgentStream,
  requestPoster,
  saveReport,
  fetchReports,
  fetchReport,
  type PosterResult,
  type PaipanRequest,
  type MingAgentBirthHint,
} from '@/lib/api';
import { storage } from '@/lib/storage';
import { setCloudItem, removeCloudItem } from '@/lib/cloudStore';
import { pushTrajectory, getTrajectory } from '@/lib/trajectory';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { useAuth } from '@/contexts/AuthContext';
import { mdToHtml } from '@/lib/markdown';
import { applyTextDedup } from '@/lib/textDedup';
import { printDocument } from '@/lib/print';
import LightFollowUp from '@/components/ai-chat/LightFollowUp';
import Modal from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import ShareLoginGate from '@/components/share/ShareLoginGate';
import type {
  CeziResult,
  XingmingResult,
  HehunResult,
  NameCandidate,
  PoetryNameCandidate,
  NameDetailResult,
  CharDictResult,
} from '@/lib/ceming';

export type MingTab = 'cezi' | 'name' | 'hehun' | 'qiming';

export const MING_DISCLAIMER =
  '本测算为传统民俗文化的趣味推演，结果仅供参考与娱乐，不构成任何专业建议。';

/* ============================================================================
 * AI 解读结果缓存
 * --------------------------------------------------------------------------
 * 模块级缓存：切 Tab / 「换个说法」来回切换时不再重复请求，
 * 既不烧 token 也不会让已经读到的内容闪一下重新流式。
 * ==========================================================================*/
const AI_CACHE = new Map<string, string>();

/** 清空缓存（换输入、重算时由调用方决定是否需要） */
export function clearMingAiCache(): void {
  AI_CACHE.clear();
}

/* ============================================================================
 * 起名点评专用：按已知候选名做确定性递增编号
 * --------------------------------------------------------------------------
 * 直接放在本文件内联，避免跨模块 HMR 失效导致浏览器端运行旧代码。
 * 对每行剥掉前导 markdown 标记（# / **）与已有数字编号后，若该行以某个
 * 候选名开头，就把编号替换为「该候选名在列表中的序号」。
 * ==========================================================================*/
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renumberByAnchors(text: string, anchors: string[]): string {
  if (!text || anchors.length === 0) return text;
  const lines = text.split('\n');
  // 长名优先，避免「武殿」抢先命中「武殿瑞」所在行
  const ordered = [...anchors].sort((a, b) => b.length - a.length);
  const used = new Set<number>();
  const renumbered: Array<[number, number]> = [];
  for (const anchor of ordered) {
    const re = new RegExp(
      '^(\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*(?:\\d+\\.\\s*)?)' + escapeRegExp(anchor)
    );
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      if (re.test(lines[i])) {
        used.add(i);
        renumbered.push([i, anchors.indexOf(anchor) + 1]);
        break;
      }
    }
  }
  if (renumbered.length === 0) return text;
  const out = lines.slice();
  for (const [idx, num] of renumbered) {
    out[idx] = out[idx].replace(
      /^(\s*(?:#{1,6}\s*)?(?:\*\*)?\s*)(?:\d+\.\s*)?/,
      `$1${num}. `
    );
  }
  return out.join('\n');
}

/* ============================================================================
 * AI 解读面板：流式渲染 + 换个说法 + 失败重试 + 追问
 * ==========================================================================*/
export function MingAIPanel({
  cacheKey,
  message,
  title = '小玄陪你看看',
  birthHint,
  orderedNames,
}: {
  /** 稳定缓存键（同一结果复用同一份解读） */
  cacheKey: string;
  /** 发给 AI 的提示词 */
  message: string;
  title?: string;
  /** 追问预设胶囊（保留以兼容调用方传入，结果区对话已移除，详见 M31） */
  chips?: string[];
  /** 出生信息提示，避免 Agent 自行假设时辰 */
  birthHint?: MingAgentBirthHint;
  /** 起名点评专用：按推荐序传入候选名，用于确定性递增编号（不依赖 AI 输出格式） */
  orderedNames?: string[];
}) {
  const [salt, setSalt] = useState(0); // 0 = 首次；>0 = 第 N 次换个说法
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!message || !cacheKey) return;
    const key = salt > 0 ? `${cacheKey}#v${salt}` : cacheKey;

    const cached = AI_CACHE.get(key);
    if (cached != null) {
      setText(cached);
      setFailed(false);
      setLoading(false);
      return;
    }

    let aborted = false;
    const ctrl = new AbortController();
    setLoading(true);
    setFailed(false);
    setText('');

    // 「换个说法」换个切入点，避免模型复述上一版
    const payload =
      salt > 0
        ? `${message}\n\n（这是第 ${salt} 次重新解读：请换一个全新的切入点与表述结构，不要复述上一次的内容。）`
        : message;

    requestMingAgentStream(payload, {
      signal: ctrl.signal,
      onDelta: (_chunk, full) => {
        if (!aborted) setText(full);
      },
    }, birthHint)
      .then((r) => {
        if (aborted) return;
        setText(r.text);
        setLoading(false);
        if (r.text) AI_CACHE.set(key, r.text);
      })
      .catch(() => {
        if (aborted) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      aborted = true;
      ctrl.abort();
    };
  }, [cacheKey, message, salt, birthHint]);

  return (
    <div className="ming-ai-panel">
      <div className="ming-ai-head">
        <div className="ming-ai-title">{title}</div>
        <div className="ming-ai-ops">
          {loading && <span className="ming-ai-tip">推演中…</span>}
          {!loading && text && (
            <button type="button" className="ming-ai-op" onClick={() => setSalt((s) => s + 1)}>
              <span aria-hidden>↻</span> 换个说法
            </button>
          )}
          {!loading && failed && (
            <button type="button" className="ming-ai-op" onClick={() => setSalt((s) => s + 1)}>
              <span aria-hidden>↻</span> 重试
            </button>
          )}
        </div>
      </div>

      <div className="ming-ai-body">
        {loading && !text && <div className="ming-ai-loading">小玄在认真推演…</div>}
        {text && (
          <div
            dangerouslySetInnerHTML={{
              __html: mdToHtml(
                orderedNames && orderedNames.length > 0
                  ? renumberByAnchors(applyTextDedup(text), orderedNames)
                  : applyTextDedup(text)
              ),
            }}
          />
        )}
        {loading && text && <span className="ming-ai-caret" aria-hidden />}
        {!loading && !text && (
          <div className="ming-ai-fallback">
            小玄暂时连接不上
            <button type="button" className="ming-ai-op" onClick={() => setSalt((s) => s + 1)}>
              重试
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

/* ============================================================================
 * 页面级常驻对话：小玄起名顾问
 * --------------------------------------------------------------------------
 * 与结果区的 MingAIPanel 是两种不同定位，互不替代：
 * - MingAIPanel：结果驱动，自动把本次测算喂 AI 生成解读；M31 已移除其底部追问框，
 *   不再是与 MingPageChat 重复的第二个对话窗口，位于结果区底部。
 * - MingPageChat：不依赖任何测算结果，进页面即可开聊，是页面上唯一的 AI 对话窗口。
 *
 * 注意：LightFollowUp 内部 `disabled = !context || !context.trim()`，
 * 空 context 会整个禁用入口。所以这里传入的是「场景化站点上下文」，
 * 而不是某次结果的解读文本。
 * ==========================================================================*/
const MING_CHAT_SCENE: Record<string, { label: string; brief: string; chips: string[] }> = {
  cezi: {
    label: '测字',
    brief: '一字观象：拆字、五行、卦象、字义与运势倾向',
    chips: ['测字准不准，有依据吗？', '这个字适合用在名字里吗？', '想测个字，选什么字好？'],
  },
  name: {
    label: '姓名',
    brief: '五格剖象：天格人格地格外格总格、三才配置、数理吉凶',
    chips: ['名字分数低一定要改吗？', '改名真的能改变运势吗？', '怎么配字能让名字更好？'],
  },
  qiming: {
    label: '起名',
    brief: '风格起名 / 诗词起名 / 生肖起名',
    chips: ['属龙的男孩取什么名字好？', '诗词起名该怎么挑选？', '起名要避开哪些坑？'],
  },
  hehun: {
    label: '合婚',
    brief: '生肖、日干、夫妻宫、五行互补四个维度看契合度',
    chips: ['生肖相冲真的不能在一起吗？', '合婚分数低该怎么看待？', '哪一年适合结婚？'],
  },
  zidian: {
    label: '字典',
    brief: '起名字典：笔画、五行、字义、组词典故、入名宜忌',
    chips: ['这个字适合男孩还是女孩？', '有哪些同义字可以推荐？', '它和哪些字搭配成好名？'],
  },
};

export function MingPageChat({ tab }: { tab: MingTab }) {
  const scene = MING_CHAT_SCENE[tab] ?? MING_CHAT_SCENE.cezi;
  const context = `你现在是玄镜「测字起名」页面的起名顾问小玄。用户当前位于「${scene.label}」功能区（${scene.brief}）。用户可能还没有做任何测算，也可能刚看完测算结果。请围绕汉字文化、五行、姓名学、起名取名、生肖民俗等话题，以小玄温柔专业的口吻作答；涉及不确定的内容或民俗说法时请说明其性质，不要编造典籍出处。`;

  return (
    <div className="ming-page-chat">
      <LightFollowUp
        module="wuxing"
        context={context}
        chips={scene.chips}
        title="小玄在线 · 随时开聊"
        placeholder={`关于${scene.label}，想问点什么？`}
      />
    </div>
  );
}

/* ============================================================================
 * 结果操作条：导出报告 / 复制链接 / 生成海报
 * ==========================================================================*/
export function MingActions({
  title,
  markdown,
  posterKeyword,
  posterContext,
}: {
  /** 报告标题（同时作为打印窗口标题） */
  title: string;
  /** 报告正文 Markdown（不含标题与免责声明，组件自动补） */
  markdown: string;
  /** 海报关键词（如「测字 · 福」） */
  posterKeyword: string;
  /** 海报用的解读文本 */
  posterContext: string;
}) {
  const [poster, setPoster] = useState<PosterResult | null>(null);
  const [posterOpen, setPosterOpen] = useState(false);
  const [posterLoading, setPosterLoading] = useState(false);
  /** 分享门禁：未登录时点击保存 / 分享先弹登录（与 bugua/dream/tarot 一致） */
  const [gateOpen, setGateOpen] = useState(false);
  const { isAuthed } = useAuth();
  const requireAuth = useCallback(
    (fn: () => void) => {
      if (!isAuthed) {
        setGateOpen(true);
        return;
      }
      fn();
    },
    [isAuthed],
  );

  const handleExport = () => {
    printDocument({
      title,
      html: mdToHtml([`# ${title}`, '', markdown, '', `> ${MING_DISCLAIMER}`].join('\n')),
    });
  };

  /** M27：海报单独打印——生成海报后直接走打印窗口（对标 numerology 海报单独打印） */
  const handlePrintPoster = async () => {
    setPosterLoading(true);
    try {
      const p = poster ?? (await requestPoster(posterKeyword, posterContext));
      setPoster(p);
      if (p?.imageUrl) {
        printDocument({
          title: `玄镜海报 · ${posterKeyword}`,
          html: `<div style="text-align:center"><img src="${p.imageUrl}" style="max-width:100%;height:auto" /></div>`,
        });
      } else {
        showToast('海报图片暂不可用，暂无法打印', 'error');
      }
    } catch {
      showToast('海报生成失败，请稍后重试', 'error');
    } finally {
      setPosterLoading(false);
    }
  };

  const handleCopy = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showToast('链接已复制，可直接分享给朋友', 'success');
    } catch {
      showToast('复制失败，请手动复制地址栏链接', 'error');
    }
  }, []);

  const handlePoster = async () => {
    setPosterOpen(true);
    if (poster) return;
    setPosterLoading(true);
    try {
      setPoster(await requestPoster(posterKeyword, posterContext));
    } catch {
      showToast('海报生成失败，请稍后重试', 'error');
      setPosterOpen(false);
    } finally {
      setPosterLoading(false);
    }
  };

  const handleDownloadPoster = async () => {
    if (!poster?.imageUrl) return;
    try {
      const blob = await (await fetch(poster.imageUrl)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `玄镜-${posterKeyword}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('图片下载失败', 'error');
    }
  };

  const handleCopyPosterText = async () => {
    const text = poster?.shareText ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast('文案已复制', 'success');
    } catch {
      showToast('复制失败', 'error');
    }
  };

  return (
    <>
      <div className="ming-actions">
        <button type="button" className="ming-action-btn" onClick={() => requireAuth(handleExport)}>
          <span aria-hidden>📄</span> 导出报告
        </button>
        <button type="button" className="ming-action-btn" onClick={() => requireAuth(handleCopy)}>
          <span aria-hidden>🔗</span> 复制链接
        </button>
        <button type="button" className="ming-action-btn" onClick={() => requireAuth(handlePoster)}>
          <span aria-hidden>🖼️</span> 生成海报
        </button>
        <button type="button" className="ming-action-btn" onClick={() => requireAuth(handlePrintPoster)} disabled={posterLoading}>
          <span aria-hidden>🖨️</span> 打印海报
        </button>
      </div>

      {/* 分享门禁：未登录用户点击保存 / 分享时原地展示登录注册表单 */}
      <Modal open={gateOpen} onClose={() => setGateOpen(false)} variant="share" icon="🔒" title="登录后保存 / 分享">
        <ShareLoginGate context="保存 / 分享" onSuccess={() => setGateOpen(false)} />
      </Modal>

      <Modal
        open={posterOpen}
        onClose={() => setPosterOpen(false)}
        variant="share"
        icon="🖼️"
        title="分享海报"
      >
        {posterLoading && <div className="poster-loading">海报生成中，请稍候…</div>}
        {!posterLoading && poster?.imageUrl && (
          <div className="poster-preview">
            <img className="poster-img" src={poster.imageUrl} alt="分享海报" loading="lazy" decoding="async" />
          </div>
        )}
        {!posterLoading && poster && !poster.imageUrl && (
          <div className="poster-fallback-note">
            图片生成暂不可用（{poster.imageError || '服务繁忙'}），可复制下方文案分享。
          </div>
        )}
        {poster?.shareText && <div className="poster-share-text">{poster.shareText}</div>}
        {poster && (
          <div className="ming-share-btns">
            {poster.imageUrl && (
              <button type="button" className="btn-submit" onClick={handleDownloadPoster}>
                下载海报
              </button>
            )}
            <button type="button" className="ming-action-btn" onClick={handleCopyPosterText}>
              复制文案
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ============================================================================
 * 历史记录：覆盖全部 Tab，带 schema 版本校验 + 管理弹层
 * ==========================================================================*/
export const MING_HISTORY_KEY = 'om_ming_history';
/** schema 版本：结构变更时 +1，旧数据读取时自动丢弃（避免脏数据崩溃） */
export const MING_HISTORY_SCHEMA = 2;
const MING_HISTORY_LIMIT = 20;

export interface MingHistoryItem {
  v: number;
  /** 所属 Tab */
  tab: MingTab;
  /** 主输入（列表大字，如「福」「王伟」） */
  input: string;
  /** 副标题（列表小字，如「火行 离卦 偏吉」） */
  summary: string;
  time: number;
  /** 回放所需的全部入参 */
  params: Record<string, string>;
}

function readHistory(): MingHistoryItem[] {
  try {
    const raw = storage.getItem(MING_HISTORY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as MingHistoryItem[];
    if (!Array.isArray(list)) return [];
    return list.filter((it) => it && it.v === MING_HISTORY_SCHEMA && it.tab && it.input && (it.tab as string) !== 'zidian');
  } catch {
    return [];
  }
}

function writeHistory(list: MingHistoryItem[]): void {
  try {
    setCloudItem(MING_HISTORY_KEY, JSON.stringify(list.slice(0, MING_HISTORY_LIMIT)));
    // 命运轨迹：仅当最新一条尚未记录时追加，避免删除/重排时重复写入（竞品留存体系）
    const top = list[0];
    if (top && (top.tab as string) !== 'zidian') {
      const items = getTrajectory();
      if (!items.length || items[0]?.ts !== top.time) {
        pushTrajectory({ type: 'ming', label: '测字·起名', summary: `${top.input} · ${top.summary}` });
      }
    }
  } catch {
    /* 隐私模式 / 配额满：忽略 */
  }
}

export function useMingHistory() {
  const [history, setHistory] = useState<MingHistoryItem[]>([]);

  // localStorage 只能客户端读，挂载后再恢复，避免 SSR/CSR 结构不一致
  useEffect(() => setHistory(readHistory()), []);

  const add = useCallback((item: Omit<MingHistoryItem, 'v' | 'time'>) => {
    setHistory((prev) => {
      const next = [
        { ...item, v: MING_HISTORY_SCHEMA, time: Date.now() },
        ...prev.filter((x) => !(x.tab === item.tab && x.input === item.input)),
      ].slice(0, MING_HISTORY_LIMIT);
      writeHistory(next);
      return next;
    });
  }, []);

  const remove = useCallback((time: number) => {
    setHistory((prev) => {
      const next = prev.filter((x) => x.time !== time);
      writeHistory(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    try {
      removeCloudItem(MING_HISTORY_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /** 只清空某个 Tab 的记录（历史弹层的「清空当前模块」） */
  const clearTab = useCallback((tab: MingTab) => {
    setHistory((prev) => {
      const next = prev.filter((x) => x.tab !== tab);
      writeHistory(next);
      return next;
    });
  }, []);

  return { history, add, remove, clear, clearTab };
}

/* ============================================================================
 * 候选名收藏（M25）：localStorage 持久化，跨起名 Tab 切换不丢
 * ==========================================================================*/
export interface MingFavName {
  full: string;
  given: string;
  surname: string;
  gender: string;
  /** 起名模式：style / poetry / zodiac */
  mode: string;
  py: string;
}
const MING_FAV_KEY = 'om_ming_favs';

export function useMingFavorites() {
  const [favs, setFavs] = useState<MingFavName[]>([]);

  useEffect(() => {
    try {
      const raw = storage.getItem(MING_FAV_KEY);
      if (raw) setFavs(JSON.parse(raw) as MingFavName[]);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback((n: MingFavName) => {
    setFavs((prev) => {
      const exists = prev.some((f) => f.full === n.full && f.mode === n.mode);
      const next = exists
        ? prev.filter((f) => !(f.full === n.full && f.mode === n.mode))
        : [...prev, n].slice(-50);
      try {
        setCloudItem(MING_FAV_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const has = useCallback(
    (full: string, mode: string) => favs.some((f) => f.full === full && f.mode === mode),
    [favs],
  );

  const clear = useCallback(() => {
    setFavs([]);
    try {
      removeCloudItem(MING_FAV_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { favs, toggle, has, clear };
}

/** 各 Tab 面板的公共 props */
export interface MingPanelProps {
  /** 是否为当前激活 Tab（首次激活时才做恢复） */
  active: boolean;
  history: MingHistoryItem[];
  onAdd: (item: Omit<MingHistoryItem, 'v' | 'time'>) => void;
  onRemove: (time: number) => void;
  onClearTab: () => void;
  /** 跨 Tab 跳转：切到目标 Tab 并预填参数（由 MingPage 统一调度） */
  onJump?: (tab: MingTab, params?: Record<string, string>) => void;
  /** 打开字典弹窗（起名辅助工具，不再作为独立 Tab） */
  onZidian?: (char: string) => void;
  /**
   * 其他 Tab 跳转过来时携带的预填参数。
   * 优先级高于本地存档恢复——用户刚点「用此字起名」，就该看到这个字，而不是上次的存档。
   */
  seed?: Record<string, string>;
}

/** 历史弹层：回放 / 单条删除 / 清空 */
export function MingHistoryModal({
  open,
  onClose,
  history,
  activeTab,
  onPick,
  onRemove,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  history: MingHistoryItem[];
  activeTab: MingTab | 'zidian';
  onPick: (item: MingHistoryItem) => void;
  onRemove: (time: number) => void;
  onClear: () => void;
}) {
  const items = history.filter((h) => h.tab === activeTab);
  return (
    <Modal open={open} onClose={onClose} icon="🕘" title={`历史记录（${items.length}）`}>
      {items.length === 0 ? (
        <div className="ming-history-empty">当前模块还没有查询记录</div>
      ) : (
        <div className="ming-history-list">
          {items.map((h) => (
            <div className="ming-history-item" key={h.time}>
              <button
                type="button"
                className="ming-history-main"
                onClick={() => {
                  onPick(h);
                  onClose();
                }}
              >
                <span className="ming-history-char">{h.input}</span>
                <span className="ming-history-sum">{h.summary}</span>
                <span className="ming-history-time">{new Date(h.time).toLocaleString('zh-CN')}</span>
              </button>
              <button
                type="button"
                className="ming-history-del"
                onClick={() => onRemove(h.time)}
                aria-label="删除这条记录"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="ming-history-footer">
          <button type="button" className="ming-action-btn" onClick={onClear}>
            清空当前模块记录
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================================
 * URL 参数：结果可直达、可分享
 * ==========================================================================*/
/** 把当前查询写进地址栏（replaceState，不污染浏览器历史） */
export function writeMingUrl(params: Record<string, string | undefined>): void {
  if (typeof window === 'undefined') return;
  const sp = new URLSearchParams(window.location.search);
  Object.entries(params).forEach(([k, v]) => {
    if (v) sp.set(k, v);
    else sp.delete(k);
  });
  const qs = sp.toString();
  window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}

export function readMingUrl(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}

/* ============================================================================
 * 报告 Markdown 构建器（各 Tab 一版）
 * ==========================================================================*/
export function buildCeziReport(r: CeziResult, topicLabel: string): string {
  return [
    `## 测字 · ${r.char}`,
    '',
    `- **五行**：${r.element}行`,
    `- **卦象**：${r.trigram.sym} ${r.trigram.name}卦（${r.trigram.nature}）`,
    `- **倾向**：偏${r.tendency.word}`,
    `- **笔画**：${r.strokes ?? '—'}`,
    r.pinyin ? `- **拼音**：${r.pinyin}` : '',
    '',
    '### 运势签',
    `**${r.omen.level}** —— ${r.omen.text}`,
    '',
    `### 拆字`,
    r.chaizi,
    '',
    `### 字象`,
    r.zixiang,
    '',
    `### ${topicLabel}趣解`,
    r.topicText,
    '',
    ...(r.words.length ? ['### 组词', r.words.join('、'), ''] : []),
    ...(r.idiom ? ['### 成语', r.idiom, ''] : []),
    ...(r.allusion ? ['### 典故', r.allusion, ''] : []),
    ...(r.nameFit ? ['### 入名宜忌', `**${r.nameFit.fit}入名** —— ${r.nameFit.text}`, ''] : []),
    `### 卦象详解`,
    r.trigram.desc,
  ].join('\n');
}

export function buildNameReport(r: XingmingResult, d: NameDetailResult | null): string {
  const g = r.grids;
  const lines = [
    `## 姓名 · ${r.surname}${r.given}`,
    '',
    `**综合评分：${r.score} / 100**`,
    '',
    '### 五格数理',
    '',
    '| 格局 | 笔画 | 数理 | 吉凶 |',
    '| --- | --- | --- | --- |',
    [g.tian, g.ren, g.di, g.wai, g.zong]
      .map((x) => `| ${x.label} | ${x.num} | ${x.k} | ${x.ji} |`)
      .join('\n'),
    '',
    `### 三才配置`,
    `${r.threeTalent.tian} · ${r.threeTalent.ren} · ${r.threeTalent.di}（天 · 人 · 地）—— ${r.threeTalent.text}`,
    '',
    '### 格局评语',
    '',
    ...r.comments.map((c) => `- **${c.label}**（${c.ji}）：${c.text}`),
  ];

  if (d) {
    lines.push('', '### 姓名详批', '');
    d.dims.forEach((x) => lines.push(`- **${x.label}**（${x.ji}）：${x.text}`));
  }
  if (r.incomplete) lines.push('', '> 注：部分字未能取到笔画数，评分为估算。');
  return lines.join('\n');
}

export function buildHehunReport(
  r: HehunResult,
  mName: string,
  fName: string,
  advice: string,
): string {
  return [
    `## 合婚 · ${mName} × ${fName}`,
    '',
    `**契合度：${r.total} / 100（${r.tier}）**`,
    '',
    '### 分项得分',
    '',
    ...r.subs.map((s) => `- **${s.label}**：${s.score}`),
    '',
    '### 配对明细',
    '',
    `| 维度 | 双方 | 结论 |`,
    `| --- | --- | --- |`,
    `| 生肖 | ${r.mSX} × ${r.fSX} | ${r.sx.text}（${r.sx.score}） |`,
    `| 日干 | ${r.mDM} × ${r.fDM} | ${r.gan.text}（${r.gan.score}） |`,
    `| 夫妻宫 | ${r.mZhi || '—'} × ${r.fZhi || '—'} | ${r.palace.text}（${r.palace.score}） |`,
    `| 五行互补 | — | ${r.wu.score} |`,
    '',
    '### 合婚总评',
    r.analysis,
    '',
    '### 相处建议',
    advice,
  ].join('\n');
}

export function buildQimingReport(
  surname: string,
  gender: string,
  mode: 'style' | 'poetry' | 'zodiac' | 'dict',
  names: NameCandidate[],
  poetryNames: PoetryNameCandidate[],
  styleLabel: string,
  zodiac: string,
): string {
  const head = [
    `## 起名 · ${surname}（${gender}）`,
    '',
    mode === 'style'
      ? `**模式**：风格起名 · ${styleLabel}`
      : mode === 'poetry'
        ? `**模式**：诗词起名`
        : mode === 'dict'
          ? `**模式**：字典起名（定字入名）`
          : `**模式**：生肖起名 · ${zodiac}`,
    '',
  ];

  if (mode === 'style' && names.length) {
    return [
      ...head,
      '### 候选佳名',
      '',
      ...names.map((n, i) => `${i + 1}. **${n.full}** —— ${n.reason}`),
      '',
      '### 起名小贴士',
      '起名宜兼顾音、形、义、五行与八字所缺；避生僻拗口、避谐音不雅；双字名音调错落更添韵律。',
    ].join('\n');
  }

  if (mode === 'poetry' && poetryNames.length) {
    return [
      ...head,
      '### 诗词佳名',
      '',
      ...poetryNames.map(
        (n, i) => `${i + 1}. **${n.full}** —— 「${n.quote}」《${n.title}》${n.author}。${n.meaning}`,
      ),
      '',
      '### 起名小贴士',
      '诗词起名重意境出处，宜先辨性别与寓意，再查笔画五行是否相配；忌断章取义、忌与原诗悲意相左。',
    ].join('\n');
  }

  if (mode === 'zodiac' && names.length) {
    return [
      ...head,
      '### 生肖佳名',
      '',
      ...names.map((n, i) => `${i + 1}. **${n.full}** —— ${n.reason}`),
      '',
      '### 起名小贴士',
      '生肖起名以十二生肖习性为据，取其喜用字根、避其冲克字形，属传统民俗取义，需结合八字五行综合衡量。',
    ].join('\n');
  }

  if (mode === 'dict' && names.length) {
    return [
      ...head,
      '### 字典佳名',
      '',
      ...names.map((n, i) => `${i + 1}. **${n.full}** —— ${n.reason}`),
      '',
      '### 起名小贴士',
      '字典起名以选定之字为定字，生成全部包含该字的候选名；宜再核对其字义、五行与音律，结合生辰八字取舍为佳。',
    ].join('\n');
  }

  return head.join('\n');
}

export function buildZidianReport(r: CharDictResult): string {
  return [
    `## 字典 · ${r.char}`,
    '',
    `- **五行**：${r.element}行`,
    `- **笔画**：${r.strokes} 画`,
    r.gender ? `- **宜用**：${r.gender}` : '',
    '',
    '### 字义详解',
    r.meaning
      ? `「${r.char}」：${r.meaning}。此字${r.strokes}画，属${r.element}行；${r.wxNote || '于姓名学中寓意温和，宜搭配音律和谐之字取名。'}`
      : `「${r.char}」字义暂未收录，按${r.strokes}画、${r.element}行推演。${r.wxNote || ''}`,
    '',
    '### 五行属性',
    r.wxNote || '（暂无补注）',
    r.words.length ? '' : '',
    r.words.length ? `### 组词\n\n${r.words.join('、')}` : '',
    r.idiom ? `### 成语\n\n${r.idiom}` : '',
    r.allusion ? `### 典故\n\n${r.allusion}` : '',
    r.nameFit ? `### 入名宜忌\n\n**${r.nameFit.fit}入名** —— ${r.nameFit.text}` : '',
    r.famous.length ? '' : '',
    r.famous.length ? `### 同字名人\n\n${r.famous.map((f) => `- ${f}`).join('\n')}` : '',
  ]
    .filter((x) => x !== undefined)
    .join('\n');
}

/* ============================================================================
 * 持久化：URL 参数（直达 / 分享）+ 云存档（刷新可恢复）
 * --------------------------------------------------------------------------
 * 取数优先级：URL > 云存档。分享链接必须还原链接里的那条结果，
 * 否则别人点开看到的是自己的历史，属于事故。
 * ==========================================================================*/
export interface MingPersistApi {
  visitorId: string;
  /** 存：写地址栏 + 落云存档（失败静默，绝不打断用户） */
  persist: (
    tab: MingTab,
    params: Record<string, string>,
    results: Record<string, unknown>,
    title: string,
  ) => void;
  /** 取：返回回放入参；无则 null */
  restore: (tab: MingTab) => Promise<Record<string, string> | null>;
}

export function useMingPersist(): MingPersistApi {
  const { visitorId } = useVisitor();

  const persist = useCallback<MingPersistApi['persist']>(
    (tab, params, results, title) => {
      writeMingUrl({ t: tab, ...params });
      if (!visitorId) return;
      void saveReport({
        visitorId,
        title,
        params: { type: 'ming', tab, ...params } as unknown as PaipanRequest,
        results,
      }).catch(() => {});
    },
    [visitorId],
  );

  const restore = useCallback<MingPersistApi['restore']>(
    async (tab) => {
      const sp = readMingUrl();
      // 只有 t（如 ?t=cezi）说明是空 tab 直连，不算可回放参数
      if (sp.get('t') === tab && Array.from(sp.keys()).length > 1) {
        const out: Record<string, string> = {};
        sp.forEach((v, k) => {
          out[k] = v;
        });
        return out;
      }

      if (!visitorId) return null;
      try {
        const list = await fetchReports(visitorId, 20);
        const mine = list.find((r) => {
          const p = r.params as unknown as { type?: string; tab?: string } | undefined;
          return p?.type === 'ming' && p?.tab === tab;
        });
        if (!mine) return null;
        const detail = await fetchReport(mine.id, visitorId);
        return (detail.params as unknown as Record<string, string>) ?? null;
      } catch {
        return null;
      }
    },
    [visitorId],
  );

  return useMemo(() => ({ visitorId, persist, restore }), [visitorId, persist, restore]);
}

/* ============================================================================
 * 结果区骨架屏
 * ==========================================================================*/
export function MingSkeleton({ lines = 4, tip }: { lines?: number; tip?: string }) {
  return (
    <div className="ming-skeleton" aria-busy="true">
      {Array.from({ length: lines }, (_, i) => (
        <div className="ming-skeleton-line" key={i} style={{ width: `${100 - i * 9}%` }} />
      ))}
      {tip && <div className="ming-skeleton-tip">{tip}</div>}
    </div>
  );
}
