import { useState } from 'react';
import { computeSynastry, type BirthProfile } from '@/lib/synastry';
import SectionIcon from '@/components/ui/SectionIcon';
import { TimePicker } from '@/components/ui/DateTimePicker';
// 出生日期统一入口（内建公历/农历双模式）
import BirthDatePicker from '@/components/ui/BirthDatePicker';

interface PersonState {
  name: string;
  date: string;
  time: string;
  gender: 'male' | 'female';
}

const empty = (name: string): PersonState => ({ name, date: '', time: '', gender: 'male' });

export default function SynastryPanel() {
  const [a, setA] = useState<PersonState>(empty('男方'));
  const [b, setB] = useState<PersonState>(empty('女方'));
  const [res, setRes] = useState<ReturnType<typeof computeSynastry> | null>(null);

  const canCalc = a.date && b.date;

  const calc = () => {
    if (!canCalc) return;
    const pa: BirthProfile = { name: a.name || '甲方', date: a.date, time: a.time || undefined, gender: a.gender };
    const pb: BirthProfile = { name: b.name || '乙方', date: b.date, time: b.time || undefined, gender: b.gender };
    setRes(computeSynastry(pa, pb));
  };

  return (
    <div className="side-card syn-panel">
      <div className="syn-head">
        <div className="syn-title">
          <SectionIcon name="heart-handshake" /> 合婚 · 合盘
        </div>
        <span className="syn-tag">多维合参</span>
      </div>
      <p className="syn-desc">输入两人出生信息，从生肖、星座、八字日干、生命灵数四个维度合参，给出综合缘分评分与建议。</p>

      <div className="syn-people">
        {([a, b] as PersonState[]).map((p, idx) => {
          const setP = idx === 0 ? setA : setB;
          const label = idx === 0 ? '甲方' : '乙方';
          return (
            <div key={idx} className="syn-person">
              <div className="syn-person-head">
                <div className="syn-gender">
                  {(['male', 'female'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={'syn-g' + (p.gender === g ? ' active' : '')}
                      onClick={() => setP({ ...p, gender: g })}
                    >
                      {g === 'male' ? '♂' : '♀'}
                    </button>
                  ))}
                </div>
                <input
                  className="form-input mb-0 syn-name"
                  placeholder={label + '称呼'}
                  value={p.name}
                  onChange={(e) => setP({ ...p, name: e.target.value })}
                />
                
              </div>
              <BirthDatePicker
                value={{ date: p.date }}
                onChange={(v) => setP({ ...p, date: v.date })}
                placeholder="出生日期"
              />
              <TimePicker
                value={p.time}
                onChange={(v) => setP({ ...p, time: v })}
                placeholder="出生时间（可选）"
              />
            </div>
          );
        })}
      </div>

      <button className="btn-submit syn-btn" disabled={!canCalc} onClick={calc}>
        开始合参
      </button>

      {res && (
        <div className="syn-result">
          <div className="syn-score-wrap">
            <div className="syn-score-ring" style={{ ['--p' as string]: `${res.total}%` }}>
              <div className="syn-score-inner">
                <div className="syn-score-num">{res.total}</div>
                <div className="syn-score-label">缘分分</div>
              </div>
            </div>
            <div className="syn-grade">{res.grade}</div>
          </div>

          <div className="syn-tags">
            <span className="syn-chip">生肖 {res.zodiacA} ⚭ {res.zodiacB}</span>
            {res.signA && res.signB && <span className="syn-chip">{res.signA} ⚭ {res.signB}</span>}
            <span className="syn-chip">日主 {res.dayGanA} ⚭ {res.dayGanB}</span>
            <span className="syn-chip">灵数 {res.lifePathA} ⚭ {res.lifePathB}</span>
          </div>

          <div className="syn-dims">
            {res.dimensions.map((d) => (
              <div key={d.key} className="syn-dim">
                <div className="syn-dim-head">
                  <span>{d.label}</span>
                  <span className="syn-dim-score">{d.score}</span>
                </div>
                <div className="syn-dim-bar">
                  <div className="syn-dim-fill" style={{ width: `${d.score}%` }} />
                </div>
                <div className="syn-dim-note">{d.note}</div>
              </div>
            ))}
          </div>

          <div className="syn-advice">
            <div className="syn-advice-title">合参建议</div>
            {res.advice.map((t, i) => (
              <div key={i} className="syn-advice-item">{t}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
