import { useState, useMemo, useEffect, useCallback } from 'react';
import { tarotDeck, SUIT_LABEL, type TarotSuit } from '@/data/tarotData';
import SectionIcon from '@/components/ui/SectionIcon';

type Mode = 'flash' | 'quiz';
type SuitFilter = 'all' | TarotSuit;

const DECK_NAMES = Object.keys(tarotDeck);

/** 洗牌：Fisher–Yates，返回新数组（不修改入参） */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TarotStudy() {
  const [mode, setMode] = useState<Mode>('flash');
  const [filter, setFilter] = useState<SuitFilter>('all');
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // 测验模式
  const [quizQueue, setQuizQueue] = useState<string[]>([]);
  const [qPos, setQPos] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState(0);

  const filtered = useMemo(
    () => (filter === 'all' ? DECK_NAMES : DECK_NAMES.filter((n) => tarotDeck[n].suit === filter)),
    [filter]
  );

  // filter 变化后 idx 越界保护
  useEffect(() => {
    if (idx >= filtered.length) setIdx(0);
  }, [filtered.length, idx]);

  const current = filtered[idx];
  const cur = current ? tarotDeck[current] : null;

  const go = (step: number) => {
    setFlipped(false);
    setIdx((i) => (i + step + filtered.length) % filtered.length);
  };

  // ===== 测验模式逻辑 =====
  const startQuiz = useCallback(() => {
    const queue = shuffle(filtered).slice(0, Math.min(10, filtered.length));
    setQuizQueue(queue);
    setQPos(0);
    setPicked(null);
    setScore(0);
    setWrong(0);
  }, [filtered]);

  useEffect(() => {
    if (mode === 'quiz' && quizQueue.length === 0) startQuiz();
  }, [mode, quizQueue.length, startQuiz]);

  const quizName = quizQueue[qPos];
  const quizCard = quizName ? tarotDeck[quizName] : null;

  const options = useMemo(() => {
    if (!quizCard) return [];
    const correct = quizCard.upright;
    const others = DECK_NAMES.filter((n) => n !== quizName).map((n) => tarotDeck[n].upright);
    const picked3 = shuffle(others).slice(0, 3);
    return shuffle([correct, ...picked3]);
  }, [quizName, quizCard]);

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (quizCard && opt === quizCard.upright) setScore((s) => s + 1);
    else setWrong((w) => w + 1);
  };

  const nextQuiz = () => {
    if (qPos + 1 >= quizQueue.length) {
      // 一轮结束，重置队列再开一轮
      startQuiz();
    } else {
      setQPos((p) => p + 1);
      setPicked(null);
    }
  };

  const filters: { k: SuitFilter; label: string }[] = [
    { k: 'all', label: '全部' },
    { k: 'major', label: SUIT_LABEL.major },
    { k: 'wands', label: '权杖' },
    { k: 'cups', label: '圣杯' },
    { k: 'swords', label: '宝剑' },
    { k: 'pentacles', label: '星币' },
  ];

  return (
    <div className="side-card tarot-study">
      <div className="tarot-study-head">
        <div className="tarot-study-title">
          <SectionIcon name="book-open" /> 牌义学习
        </div>
        <div className="tarot-study-tabs">
          <button className={'ts-tab' + (mode === 'flash' ? ' active' : '')} onClick={() => setMode('flash')}>
            闪卡
          </button>
          <button className={'ts-tab' + (mode === 'quiz' ? ' active' : '')} onClick={() => setMode('quiz')}>
            测验
          </button>
        </div>
      </div>

      <div className="tarot-study-filter">
        {filters.map((f) => (
          <button
            key={f.k}
            className={'ts-chip' + (filter === f.k ? ' active' : '')}
            onClick={() => setFilter(f.k)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {mode === 'flash' && cur && (
        <div className="tarot-study-body">
          <div className={'ts-flashcard' + (flipped ? ' flipped' : '')} onClick={() => setFlipped((f) => !f)}>
            <div className="ts-flash-inner">
              <div className="ts-flash-face ts-flash-front">
                <div className="ts-flash-sym">{cur.sym}</div>
                <div className="ts-flash-name">{current}</div>
                <div className="ts-flash-suit">{SUIT_LABEL[cur.suit]}</div>
                <div className="ts-flash-tip">点击翻面看牌义</div>
              </div>
              <div className="ts-flash-face ts-flash-back">
                <div className="ts-flash-back-name">
                  {current}
                  <span className="ts-flash-back-suit">{SUIT_LABEL[cur.suit]}</span>
                </div>
                <div className="ts-flash-line">
                  <span className="ts-tag up">正位</span>
                  {cur.upright}
                </div>
                <div className="ts-flash-line">
                  <span className="ts-tag rev">逆位</span>
                  {cur.rev}
                </div>
                <div className="ts-flash-kw">
                  {cur.kw.map((k) => (
                    <span key={k} className="ts-kw">{k}</span>
                  ))}
                </div>
                <div className="ts-flash-tip">点击翻回</div>
              </div>
            </div>
          </div>

          <div className="tarot-study-nav">
            <button className="nav-btn btn-ghost" onClick={() => go(-1)}>
              ‹ 上一张
            </button>
            <span className="tarot-study-progress">
              {idx + 1} / {filtered.length}
            </span>
            <button className="nav-btn btn-ghost" onClick={() => go(1)}>
              下一张 ›
            </button>
          </div>
          <button className="ts-flip-btn" onClick={() => setFlipped((f) => !f)}>
            {flipped ? '看牌面' : '翻面看牌义'}
          </button>
        </div>
      )}

      {mode === 'quiz' && quizCard && (
        <div className="tarot-study-body">
          <div className="ts-quiz-progress">
            第 {qPos + 1} / {quizQueue.length} 题 · 对 {score} · 错 {wrong}
          </div>
          <div className="ts-quiz-card">
            <div className="ts-quiz-sym">{quizCard.sym}</div>
            <div className="ts-quiz-name">{quizName}</div>
            <div className="ts-quiz-q">这张牌的「正位」含义是？</div>
          </div>
          <div className="ts-quiz-opts">
            {options.map((opt) => {
              const isCorrect = opt === quizCard.upright;
              const cls =
                picked === null
                  ? ''
                  : isCorrect
                  ? ' correct'
                  : picked === opt
                  ? ' wrong'
                  : ' dim';
              return (
                <button
                  key={opt}
                  className={'ts-quiz-opt' + cls}
                  disabled={picked !== null}
                  onClick={() => choose(opt)}
                >
                  {opt}
                  {picked !== null && isCorrect && <span className="ts-quiz-mark">✓</span>}
                  {picked === opt && !isCorrect && <span className="ts-quiz-mark">✕</span>}
                </button>
              );
            })}
          </div>
          {picked && (
            <div className="ts-quiz-feedback">
              <div className="ts-quiz-fb-text">
                {picked === quizCard.upright ? '✅ 答对了！' : `✅ 正确答案：${quizCard.upright}`}
              </div>
              <div className="ts-quiz-fb-kw">
                关键词：{quizCard.kw.join(' · ')}
                {quizCard.element && ` · 对应 ${quizCard.element}`}
              </div>
              <button className="btn-submit ts-quiz-next" onClick={nextQuiz}>
                {qPos + 1 >= quizQueue.length ? '再来一轮 ↺' : '下一题 ›'}
              </button>
            </div>
          )}
          <button className="ts-quiz-restart" onClick={startQuiz}>
            重新出题
          </button>
        </div>
      )}

      {mode === 'flash' && !cur && <div className="tarot-study-empty">该花色暂无卡牌</div>}
    </div>
  );
}
