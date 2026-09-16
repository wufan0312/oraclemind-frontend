'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionIcon from '@/components/ui/SectionIcon';
// 出生日期统一入口（内建公历/农历双模式，与全站一致）
import BirthDatePicker from '@/components/ui/BirthDatePicker';
import { mdToHtml } from '@/lib/markdown';
import {
  ANGEL_DIGIT_MEANING,
  ANGEL_NUMBERS,
  parseAngelNumber,
  type AngelResult,
} from '@/data/angelNumbers';
import {
  parseAngelNumberAPI,
  analyzeAngelSequenceAPI,
  computePersonalAngelAPI,
  requestInterpret,
  type AngelEntry as ApiAngelEntry,
  type AngelParseResult,
  type AngelSequenceResult,
} from '@/lib/api';

/** 快捷入口：最常见的重复序列 */
const QUICK = ['111', '222', '333', '444', '555', '666', '777', '888', '999', '1111'];
const JOURNAL_KEY = 'oraclemind_angel_journal_v1';

/** 把本地 AngelResult 规整成与后端 AngelParseResult 同构的形状（供渲染/AI 复用） */
function localToParseResult(r: AngelResult): AngelParseResult {
  const digitMeaning: Record<string, string> = {};
  for (const d of r.digits) digitMeaning[String(d)] = ANGEL_DIGIT_MEANING[d] ?? '';
  return {
    raw: r.raw,
    key: r.key,
    entry: r.entry,
    isRepDigit: r.isRepDigit,
    isSequence: r.isSequence,
    digits: r.digits,
    repDigit: r.isRepDigit ? r.digits[0] : null,
    digitalRoot: r.digits.reduce((a, b) => a + b, 0) % 9 || 9,
    digitMeaning,
  };
}

/**
 * 天使数字（Angel Numbers）完整模块（P2-3）
 * 三段能力：
 *  1) 查数字：输入任意数字 / 时间（如 11:11 / 车牌 / 订单尾数），解析象征含义；
 *  2) 序列手账：记录「近期反复看到的数字」，做频次统计与主题归纳；
 *  3) 个人天使数：由生日按生命数法推导（民俗算法）。
 * 后端为权威实现；后端不可用时自动回退本地 angelNumbers.ts，绝不白屏。
 * AI 解读走 requestInterpret(module='angel')，含分类响应 / 全免费 / 五层去重红线。
 */
export default function AngelNumberCard() {
  // ---------- 1) 查数字 ----------
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [parseRes, setParseRes] = useState<AngelParseResult | null>(null);
  const [parseErr, setParseErr] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const submit = async () => {
    setParseErr('');
    setAiText('');
    const raw = input.trim();
    if (!raw) return;
    try {
      const r = await parseAngelNumberAPI(raw);
      setParseRes(r);
    } catch {
      const local = parseAngelNumber(raw);
      if (!local) {
        setParseErr('没识别到数字，换个输入试试（如 1111 / 11:11）');
        setParseRes(null);
        return;
      }
      setParseRes(localToParseResult(local));
    }
    setQuery(raw);
  };

  const askAI = async () => {
    if (!parseRes) return;
    setAiLoading(true);
    try {
      const resp = await requestInterpret('angel', parseRes as unknown as Record<string, unknown>, '用户查询该天使数字的含义与当下提醒');
      setAiText(resp?.text ?? '');
    } catch {
      setAiText('');
    } finally {
      setAiLoading(false);
    }
  };

  // ---------- 2) 序列手账 ----------
  const [journal, setJournal] = useState<string[]>([]);
  const [journalInput, setJournalInput] = useState('');
  const [seqRes, setSeqRes] = useState<AngelSequenceResult | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(JOURNAL_KEY);
      if (saved) setJournal(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const persistJournal = (next: string[]) => {
    setJournal(next);
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const addJournal = () => {
    const v = journalInput.trim();
    if (!v) return;
    persistJournal([...journal, v]);
    setJournalInput('');
  };

  const removeJournal = (i: number) => persistJournal(journal.filter((_, idx) => idx !== i));

  const analyzeJournal = async () => {
    if (journal.length === 0) return;
    try {
      const r = await analyzeAngelSequenceAPI(journal);
      setSeqRes(r);
    } catch {
      // 降级：后端不可用时，本地逐条解析给出简单频率统计
      const freq: Record<string, number> = {};
      for (const item of journal) {
        const norm = (item.match(/\d/g) || []).join('');
        if (norm) freq[norm] = (freq[norm] || 0) + 1;
      }
      const items = Object.entries(freq)
        .map(([raw, count]) => {
          const local = parseAngelNumber(raw);
          return {
            raw,
            count,
            ratio: count / journal.length,
            key: local?.key ?? raw,
            title: local?.entry.title ?? raw,
            isRepDigit: local?.isRepDigit ?? false,
            isSequence: local?.isSequence ?? false,
          };
        })
        .sort((a, b) => b.count - a.count);
      const total = journal.length;
      setSeqRes({
        total,
        unique: items.length,
        invalid: [],
        items,
        top: items.filter((i) => i.count === items[0]?.count),
        topKey: items[0]?.key ?? '',
        topEntry: ANGEL_NUMBERS[items[0]?.key ?? '111'] ?? ANGEL_NUMBERS['111'],
        themes: [],
        keyFrequency: {},
        digitFrequency: {},
        summary: `（本地降级）共 ${total} 条记录，出现最多的是 ${items[0]?.raw ?? '-'}（${items[0]?.count ?? 0} 次）。`,
      });
    }
  };

  // ---------- 3) 个人天使数 ----------
  const [birth, setBirth] = useState('');
  const [personal, setPersonal] = useState<ApiAngelEntry | null>(null);

  const calcPersonal = async () => {
    if (!birth.trim()) return;
    try {
      const r = await computePersonalAngelAPI(birth.trim());
      setPersonal(r.entry);
    } catch {
      const digits = (birth.match(/\d/g) || []).join('');
      if (digits.length !== 8) {
        setPersonal(null);
        return;
      }
      const sum = digits.split('').reduce((a, b) => a + Number(b), 0);
      const root = sum % 9 || 9;
      const key = String(root).repeat(3);
      setPersonal(ANGEL_NUMBERS[key] ?? ANGEL_NUMBERS['111']);
    }
  };

  const parseView = useMemo(() => parseRes, [parseRes]);

  return (
    <div className="mood-tracker angel-card" id="angel">
      <div className="result-card-title">
        <SectionIcon name="sparkles" /> 天使数字
      </div>
      <div className="angel-tip">
        最近是不是总看到同一串数字？把反复出现的序列填进来（时间、车牌、尾号都算）。
      </div>

      {/* —— 查数字 —— */}
      <div className="angel-sections">
      <div className="angel-section">
        <div className="angel-subtitle">🔎 查询天使数字</div>
        <div className="angel-quick">
          {QUICK.map((q) => (
            <button key={q} className="angel-chip" onClick={() => { setInput(q); }}>
              {q}
            </button>
          ))}
        </div>
        <div className="angel-input-row">
          <input
            className="form-input"
            placeholder="输入数字或时间，如 11:11"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="btn-submit" onClick={submit}>解读</button>
        </div>
        {parseErr && <div className="angel-err">{parseErr}</div>}
        {parseView && (
          <div className="angel-result">
            <div className="angel-result-head">
              <span className="angel-key">{parseView.key}</span>
              <span className="angel-title">{parseView.entry.title}</span>
              {parseView.isRepDigit && <span className="angel-badge rep">全同重复</span>}
              {parseView.isSequence && <span className="angel-badge seq">连续递增</span>}
            </div>
            <p className="angel-core">{parseView.entry.core}</p>
            <p className="angel-advice"><b>建议：</b>{parseView.entry.advice}</p>
            {parseView.entry.love && <p className="angel-love">💞 {parseView.entry.love}</p>}
            {parseView.entry.career && <p className="angel-career">💼 {parseView.entry.career}</p>}
            {parseView.digits.length > 1 && (
              <div className="angel-digits">
                {parseView.digits.map((d) => (
                  <span key={d} className="angel-digit">{d}→{parseView.digitMeaning[String(d)]}</span>
                ))}
              </div>
            )}
            <button className="btn-submit ghost" onClick={askAI} disabled={aiLoading}>
              {aiLoading ? 'AI 解读中…' : '✨ AI 解读'}
            </button>
            {aiText && (
              <div
                className="angel-ai"
                dangerouslySetInnerHTML={{ __html: mdToHtml(aiText) }}
              />
            )}
          </div>
        )}
      </div>

      {/* —— 序列手账 —— */}
      <div className="angel-section">
        <div className="angel-subtitle">📓 我的数字手账</div>
        <div className="angel-input-row">
          <input
            className="form-input"
            placeholder="如 11:11、888、444"
            value={journalInput}
            onChange={(e) => setJournalInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addJournal()}
          />
          <button className="btn-submit" onClick={addJournal}>记录</button>
        </div>
        {journal.length > 0 && (
          <div className="angel-journal-list">
            {journal.map((j, i) => (
              <span key={i} className="angel-journal-item">
                {j}
                <button className="angel-x" onClick={() => removeJournal(i)}>×</button>
              </span>
            ))}
            <button className="btn-submit ghost" onClick={analyzeJournal}>分析这段序列</button>
          </div>
        )}
        {seqRes && (
          <div className="angel-seq">
            <p className="angel-seq-summary">{seqRes.summary}</p>
            <table className="angel-seq-table">
              <thead>
                <tr><th>序列</th><th>次数</th><th>占比</th><th>含义</th></tr>
              </thead>
              <tbody>
                {seqRes.items.map((it) => (
                  <tr key={it.raw}>
                    <td>{it.raw}</td>
                    <td>{it.count}</td>
                    <td>{Math.round(it.ratio * 100)}%</td>
                    <td>{it.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {seqRes.themes.length > 0 && (
              <div className="angel-themes">主题：{seqRes.themes.join('、')}</div>
            )}
          </div>
        )}
      </div>

      {/* —— 个人天使数 —— */}
      <div className="angel-section">
        <div className="angel-subtitle">🌟 我的个人天使数</div>
        <div className="angel-input-row">
          <BirthDatePicker
            value={{ date: birth }}
            onChange={(v) => setBirth(v.date)}
            placeholder="出生日期 YYYY-MM-DD"
          />
          <button className="btn-submit" onClick={calcPersonal}>推算</button>
        </div>
        {personal && (
          <div className="angel-personal-result">
            <span className="angel-key">{personal.n}</span>
            <span className="angel-title">{personal.title}</span>
            <p className="angel-core">{personal.core}</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
