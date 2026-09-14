'use client';

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/** 距底部多少 px 以内算「贴底」；留出余量避免亚像素误差导致误判 */
const STICK_THRESHOLD = 64;

/** smooth 滚动期间忽略位置判断的时长，避免中间态把「跟随」自己关掉 */
const SMOOTH_LOCK_MS = 800;

/**
 * 程序化写入 scrollTop 后的「屏蔽窗」时长。
 * 自家贴底写入也会派发 scroll 事件，而该事件可能在 DOM 又长高之后才到达，
 * 此时读到的是旧位置（距底 = 本帧新增高度），若超过阈值就会把「跟随」误关掉，
 * 表现为「发出的消息 / 正在生成的回复不再自动往下跟随」。
 * 必须 ≥「写入 → scroll 事件派发」的一帧，又不能长到吞掉用户真实上滑。
 */
const PROGRAMMATIC_LOCK_MS = 120;

export interface UseAutoScrollResult<T extends HTMLElement> {
  /**
   * 挂到滚动容器上。用 callback ref 而非 RefObject：
   * 聊天容器经常是「有消息才渲染」，普通 useRef 在首次 effect 时还是 null，
   * 监听会永久漏绑。
   */
  ref: (node: T | null) => void;
  /** 当前是否贴在底部（可用于显示「回到底部」按钮） */
  atBottom: boolean;
  /** 手动滚到底部并恢复跟随 */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

/**
 * 聊天类滚动容器的「自动贴底」行为。
 *
 * 解决两类问题：
 * 1. 流式输出过程中视口不跟随 —— 每个 chunk 都会让内容变高，必须每次重新贴底，
 *    否则用户看到的永远是最开始那几句，当前正在生成的语句跑到可视区外。
 * 2. 用户往上翻历史时被强行拽回底部 —— 手动上滑自动暂停跟随，滑回底部附近自动恢复。
 *
 * 实现要点：
 * - 跟随用 `behavior: 'auto'`：smooth 动画会被下一个 chunk 不断打断，反而滞后且卡顿；
 *   只有一次性跳动（切模式、收尾）才适合 smooth。
 * - 同一帧内的多次 chunk 用 requestAnimationFrame 合并，避免高频 scrollTo。
 * - smooth 滚动进行中会持续触发 scroll 事件，中间态距底部很远，若据此判断会把跟随关掉，
 *   所以 smooth 期间加锁忽略位置判断。
 * - **订阅（scroll 监听）必须由 effect 建立、由 effect cleanup 拆除**，不能写在 ref 回调里：
 *   React StrictMode（本项目 next.config `reactStrictMode: true`）在开发态会「挂载 → 卸载 → 挂载」，
 *   只重跑 effect，**不会重新调用 ref 回调**。若把订阅写在 ref 回调里、把解绑写在 effect cleanup 里，
 *   双调用后订阅会被拆掉且再也补不回来，`nodeRef` 也被置空 —— 整条自动贴底链路静默失效
 *   （2026-09-10 首页「AI 回复不往上走 / 看不到最后一条回复」的真实根因）。
 *   现在 ref 回调只负责把节点写入 nodeRef 并 setNode，effect 依据 [node, onScroll] 订阅，
 *   无论双调用、节点重建都能严格配对。
 *
 * @param deps 内容变化依赖（如 `[messages, streaming]`），变化即尝试贴底
 */
export function useAutoScroll<T extends HTMLElement = HTMLDivElement>(
  deps: DependencyList
): UseAutoScrollResult<T> {
  const nodeRef = useRef<T | null>(null);
  /** 节点状态：作为订阅 effect 的开关，保证订阅随节点的挂载/重建/卸载严格配对 */
  const [node, setNode] = useState<T | null>(null);
  const stickRef = useRef(true); // 是否跟随底部
  const rafRef = useRef<number | null>(null);
  const lockUntilRef = useRef(0); // smooth 滚动锁的到期时间戳
  const pinUntilRef = useRef(0); // 自家贴底写入的屏蔽窗到期时间戳
  const [atBottom, setAtBottom] = useState(true);

  const computeAtBottom = useCallback(() => {
    const el = nodeRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD;
  }, []);

  /** 手动滚到底：无条件恢复跟随，供「发新消息 / 切模式」等场景调用 */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    stickRef.current = true;
    setAtBottom(true);
    const el = nodeRef.current;
    if (!el) return;
    if (behavior === 'smooth') lockUntilRef.current = Date.now() + SMOOTH_LOCK_MS;
    // 本次写入引发的 scroll 事件不该被当成「用户上滑」
    pinUntilRef.current = Date.now() + PROGRAMMATIC_LOCK_MS;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const onScroll = useCallback(() => {
    // smooth 滚动的中间态不算数，否则跟随会被自己关掉
    if (Date.now() < lockUntilRef.current) return;
    // 自家贴底写入引发的 scroll 不算「用户上滑」（见 PROGRAMMATIC_LOCK_MS 注释）
    if (Date.now() < pinUntilRef.current) return;
    const bottom = computeAtBottom();
    stickRef.current = bottom;
    setAtBottom(bottom);
  }, [computeAtBottom]);

  /**
   * 用户主动滚动 → 立即暂停跟随。
   * 只看输入意图（滚轮上滚 / 触摸拖动 / 翻页键），不依赖位置判断：
   * 位置判断会被自家贴底写入和布局变化干扰，输入意图不会。
   */
  const pauseFollow = useCallback(() => {
    if (!stickRef.current) return;
    stickRef.current = false;
    setAtBottom(false);
  }, []);

  // callback ref：只记录节点并驱动订阅 effect（**不要在这里直接订阅**，见上方实现要点）
  const ref = useCallback((n: T | null) => {
    nodeRef.current = n;
    setNode(n);
  }, []);

  // 订阅 scroll / 用户输入意图：由 effect 建立与拆除，StrictMode 双调用与节点重建都安全
  useEffect(() => {
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      // 向上滚 = 要回看历史，立即暂停跟随；向下滚交给 onScroll 到达底部后自动恢复
      if (e.deltaY < 0) pauseFollow();
    };
    const onTouch = () => pauseFollow();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === 'Home') pauseFollow();
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    node.addEventListener('wheel', onWheel, { passive: true });
    node.addEventListener('touchstart', onTouch, { passive: true });
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('scroll', onScroll);
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('touchstart', onTouch);
      node.removeEventListener('keydown', onKey);
    };
  }, [node, onScroll, pauseFollow]);

  // 内容变化（或容器挂载）→ 贴底。同一帧内多次变化合并成一次滚动。
  useEffect(() => {
    if (!stickRef.current) return;
    if (rafRef.current != null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = nodeRef.current;
      if (!el || !stickRef.current) return;
      // 直接赋 scrollTop 而非 scrollTo({behavior:'auto'})：
      // 容器的 CSS 曾设 scroll-behavior:smooth，而 scrollTo 的 'auto' 会继承该 smooth，
      // 流式期间每个 chunk 触发的平滑动画互相打断，导致视图滞后、看不到最新回复。
      // 直接赋值必为瞬时贴底，保证「发出/收到消息」时稳定跟随到底部。
      pinUntilRef.current = Date.now() + PROGRAMMATIC_LOCK_MS;
      el.scrollTop = el.scrollHeight;
    });
    // 依赖里额外带上 node：容器挂载的瞬间也要贴一次底（如刷新后恢复长对话）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, node]);

  // 卸载时只需取消未执行的 rAF（订阅由上面的 effect cleanup 负责，别再置空 nodeRef）
  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    []
  );

  return { ref, atBottom, scrollToBottom };
}
