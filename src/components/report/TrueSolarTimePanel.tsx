import { useState, useEffect, useRef, useMemo } from 'react';
import { computeTrueSolarTime } from '@/lib/trueSolarTime';
import { computeLocalBazi, type LocalBaziResult } from '@/data/baziDayun';
import SectionIcon from '@/components/ui/SectionIcon';
import { TimePicker } from '@/components/ui/DateTimePicker';
// 出生日期统一入口（内建公历/农历双模式）
import BirthDatePicker from '@/components/ui/BirthDatePicker';
import Cascader from '@/components/ui/Cascader';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { shichenToHHmm } from '@/lib/shichen';

function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const mm = `${dt.getMonth() + 1}`.padStart(2, '0');
  const dd = `${dt.getDate()}`.padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function hourToShichenLocal(h: number): string {
  const h2 = ((h + 1) % 24 + 24) % 24;
  return ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][Math.floor(h2 / 2)] + '时';
}

function pillarStr(r: LocalBaziResult): string[] {
  return r.pillars.map((p) => p.gan + p.zhi);
}

export default function TrueSolarTimePanel() {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [prov, setProv] = useState('');
  const [city, setCity] = useState('');
  const [lng, setLng] = useState(116.4);
  const [reCast, setReCast] = useState(true);
  const [done, setDone] = useState(false);
  const { birth, loading } = useVisitor();
  const appliedRef = useRef(false);

  // 从用户/访客出生档案自动回填（只执行一次，避免覆盖用户手动修改）
  useEffect(() => {
    if (appliedRef.current || loading) return;
    if (!birth?.date) return;
    appliedRef.current = true;
    setDate(birth.date);
    setTime(shichenToHHmm(birth.time));
    if (birth.province && birth.city) {
      setProv(birth.province);
      setCity(birth.city);
      if (typeof birth.lng === 'number') setLng(birth.lng);
    }
  }, [birth, loading]);

  const result = useMemo(() => {
    if (!done || !date) return null;
    const r = computeTrueSolarTime(date, time, lng);
    let orig: LocalBaziResult | null = null;
    let corr: LocalBaziResult | null = null;
    if (reCast) {
      const oy = Number(date.split('-')[0]);
      const om = Number(date.split('-')[1]);
      const od = Number(date.split('-')[2]);
      const [hh, mm] = time.split(':').map(Number);
      orig = computeLocalBazi({ date, time: hourToShichenLocal(hh), gender: 'male' });
      const corrDate = r.dayOffset ? addDays(date, r.dayOffset) : date;
      corr = computeLocalBazi({ date: corrDate, time: r.shichen + '时', gender: 'male' });
    }
    return { r, orig, corr };
  }, [done, date, time, lng, reCast]);

  return (
    <div className="side-card tst-panel">
      <div className="tst-head">
        <div className="tst-title">
          <SectionIcon name="clock" /> 真太阳时校正
        </div>
        <span className="tst-tag">排盘专业度</span>
      </div>
      <p className="tst-desc">把「北京时间」换算成出生地「真太阳时」，校正八字时辰——东西部出生者八字可能整体偏移。</p>

      <div className="tst-form">
        <label className="tst-field">
          <span>出生日期</span>
          {/* 真太阳时校正基于太阳视位置的物理时差，必须用「公历」日历 + 北京时间（保持太阳历口径）。
              校正后的日期再喂 computeLocalBazi，由八字算法自行转农历排日柱。 */}
          <BirthDatePicker
            value={{ date }}
            onChange={(v) => { setDate(v.date); setDone(false); }}
            minYear={1900}
            maxYear={2100}
            placeholder="请选择出生日期"
            className="mb-0"
          />
        </label>
        <label className="tst-field">
          <span>出生时间（北京时间）</span>
          <TimePicker
            value={time}
            onChange={(v) => { setTime(v); setDone(false); }}
            placeholder="HH:mm"
            className="mb-0"
          />
        </label>
        <label className="tst-field tst-field-wide">
          <span>出生地</span>
          <Cascader
            value={[prov, city]}
            onChange={(p, c, _lat, cityLng) => {
              setProv(p);
              setCity(c);
              setLng(cityLng ?? 116.4);
              setDone(false);
            }}
            placeholder="请选择出生地"
            className="mb-0"
          />
        </label>
      </div>

      <label className="tst-recast">
        <input type="checkbox" checked={reCast} onChange={(e) => setReCast(e.target.checked)} />
        同步重排八字（对比时辰差异）
      </label>

      <button
        className="btn-submit tst-btn"
        disabled={!date || !prov || !city}
        onClick={() => setDone(true)}
      >
        开始校正
      </button>

      {result && (
        <div className="tst-result">
          <div className="tst-grid">
            <div className="tst-cell"><span>出生地经度</span><b>{result.r.lng.toFixed(2)}°E</b></div>
            <div className="tst-cell"><span>经度时差</span><b>{result.r.longitudeMin >= 0 ? '+' : ''}{result.r.longitudeMin} 分</b></div>
            <div className="tst-cell"><span>真平时差(EoT)</span><b>{result.r.eotMin >= 0 ? '+' : ''}{result.r.eotMin} 分</b></div>
            <div className="tst-cell"><span>总修正</span><b>{result.r.totalMin >= 0 ? '+' : ''}{result.r.totalMin} 分</b></div>
          </div>
          <div className="tst-verdict">
            <div className="tst-verdict-row">
              <span>原钟表时间</span>
              <b>{time}{result.r.dayOffset === 0 ? '' : `（${result.r.dayOffset > 0 ? '次日' : '前一日'}）`}</b>
            </div>
            <div className="tst-arrow">↓ 真太阳时</div>
            <div className="tst-verdict-row tst-verdict-hl">
              <span>真太阳时</span>
              <b>{result.r.correctedTime} · {result.r.shichen}时</b>
            </div>
          </div>

          {reCast && result.orig && result.corr && (
            <div className="tst-bazi">
              <div className="tst-bazi-title">八字四柱对比（时辰校正后）</div>
              <table className="tst-bazi-table">
                <thead>
                  <tr><th>柱</th><th>校正前</th><th>校正后</th></tr>
                </thead>
                <tbody>
                  {['年', '月', '日', '时'].map((lab, i) => {
                    const o = pillarStr(result.orig!)[i];
                    const c = pillarStr(result.corr!)[i];
                    return (
                      <tr key={lab} className={o !== c ? 'diff' : ''}>
                        <td>{lab}柱</td>
                        <td>{o}</td>
                        <td>{c}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="tst-bazi-note">
                {(() => {
                  const o = pillarStr(result.orig);
                  const c = pillarStr(result.corr);
                  const diffs = ['年', '月', '日', '时'].filter((_, i) => o[i] !== c[i]);
                  return diffs.length === 0
                    ? '四柱完全一致，本次校正未改变八字。'
                    : `校正后 ${diffs.join('、')}柱 发生变化，建议以真太阳时排盘为准。`;
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
