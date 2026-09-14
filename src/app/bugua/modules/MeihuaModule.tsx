'use client';

import type { MeihuaAPIResult, TrigramLeiXiang } from '@/lib/api';
import SectionIcon from '@/components/ui/SectionIcon';
import { ModuleProps, ApiBadge } from '../shared';

/** 月令旺相休囚死配色 */
function wsColor(w: string): string {
  if (w === '旺' || w === '相') return 'var(--accent-gold, #d4a24c)';
  if (w === '休') return 'var(--text-secondary, #8b8b8b)';
  return 'var(--danger, #c0392b)'; // 囚 / 死
}

/** 综合气势配色（与六爻旺衰表一致） */
function strengthColor(s: string): string {
  if (s === '极旺' || s === '偏旺') return 'var(--accent-gold, #d4a24c)';
  if (s === '中和') return 'var(--text-secondary, #8b8b8b)';
  return 'var(--danger, #c0392b)'; // 偏衰 / 极衰
}

/** 万物类象展示顺序（M3） */
const LEIXIANG_ROWS: { label: string; key: keyof TrigramLeiXiang & string }[] = [
  { label: '天时', key: 'tianshi' },
  { label: '地理', key: 'dili' },
  { label: '人物', key: 'renwu' },
  { label: '人事', key: 'renshi' },
  { label: '身体', key: 'shenghti' },
  { label: '动物', key: 'dongwu' },
  { label: '静物', key: 'wu' },
  { label: '方位', key: 'fangwei' },
  { label: '数字', key: 'shuzi' },
  { label: '五味', key: 'weiwei' },
  { label: '五色', key: 'se' },
];

/** 吉凶配色（用于四卦矩阵等） */
function jiColor(j: string): string {
  if (j === '吉' || j === '小吉') return 'var(--accent-gold, #d4a24c)';
  if (j === '凶' || j === '小凶') return 'var(--danger, #c0392b)';
  return 'var(--text-secondary, #8b8b8b)'; // 平
}

/** 模块5：梅花易数 */
export function MeihuaModule({ data, status }: ModuleProps<MeihuaAPIResult>) {
  const ben = data?.benGua;
  const bian = data?.bianGua ?? null;
  const hu = data?.huGua ?? null;
  const ti = data?.ti;
  const yong = data?.yong;
  const tiYong = data?.tiYong;
  const tiWang = data?.tiWang;
  const yongWang = data?.yongWang;
  const analysis = data?.analysis;
  const shang = ben?.upper;
  const xia = ben?.lower;
  const dong = data?.dongYao;

  return (
    <>
      {/* ===== 卡片1：起卦信息概览 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="flower" /> 梅花易数 · 起卦 <ApiBadge status={status} />
        </div>

        {/* 上卦/下卦/动爻 */}
        <div className="meihua-qigua-grid">
          <div className="qigua-card">
            <div className="qigua-label">上卦</div>
            <div className="qigua-symbol">{shang?.symbol || ''}</div>
            <div className="qigua-name">{shang ? `${shang.name}（${shang.symbol}）` : ''}</div>
            <div className="qigua-meta">{shang ? `数：${shang.num} · 五行：${shang.wuxing}` : ''}</div>
            {shang?.meaning && <div className="qigua-meaning">{shang.meaning}</div>}
            {shang?.virtue && <div className="qigua-virtue">德：{shang.virtue}</div>}
          </div>
          <div className="qigua-card water">
            <div className="qigua-label">下卦</div>
            <div className="qigua-symbol">{xia?.symbol || ''}</div>
            <div className="qigua-name cyan">{xia ? `${xia.name}（${xia.symbol}）` : ''}</div>
            <div className="qigua-meta">{xia ? `数：${xia.num} · 五行：${xia.wuxing}` : ''}</div>
            {xia?.meaning && <div className="qigua-meaning">{xia.meaning}</div>}
            {xia?.virtue && <div className="qigua-virtue">德：{xia.virtue}</div>}
          </div>
          <div className="qigua-card dong">
            <div className="qigua-label">动爻</div>
            <div className="qigua-symbol">⚡</div>
            <div className="qigua-name gold">{dong ? `第${dong}爻动` : ''}</div>
            <div className="qigua-meta">{data?.qigua || ''}</div>
          </div>
        </div>
      </div>

      {/* ===== 卡片2：本卦·变卦·互卦 ===== */}
      <div className="meihua-card">
        <div className="meihua-gua">
          <div className="meihua-gua-symbol">{ben?.symbol || ''}</div>
          <div className="meihua-gua-name">{ben?.name || ''}</div>
          <div className="meihua-gua-desc">{ben ? `${ben.desc} · 本卦` : ''}</div>
          {ben?.guaCi && <div className="hexagram-guaci">《{ben.guaCi}》</div>}
          {ben?.gong && <div className="meihua-gua-gong">{ben.gong}宫</div>}
        </div>
        <div className="meihua-gua change">
          <div className="meihua-gua-symbol">{bian?.symbol || ''}</div>
          <div className="meihua-gua-name">{bian?.name || ''}</div>
          <div className="meihua-gua-desc">{bian ? `${bian.desc} · 变卦` : ''}</div>
          {bian?.guaCi && <div className="hexagram-guaci">《{bian.guaCi}》</div>}
          {bian?.gong && <div className="meihua-gua-gong">{bian.gong}宫</div>}
        </div>
        <div className="meihua-detail">
          <div className="meihua-detail-title">互卦分析</div>
          {hu ? (
            <div className="hugua-row">
              <div className="hugua-cell">
                <div className="hugua-symbol">{hu.upper.symbol}</div>
                <div className="hugua-name">{hu.upper.name}（{hu.upper.wuxing}）</div>
                {hu.upper.meaning && <div className="hugua-meaning">{hu.upper.meaning}</div>}
              </div>
              <div className="hugua-plus">+</div>
              <div className="hugua-cell">
                <div className="hugua-symbol">{hu.lower.symbol}</div>
                <div className="hugua-name">{hu.lower.name}（{hu.lower.wuxing}）</div>
                {hu.lower.meaning && <div className="hugua-meaning">{hu.lower.meaning}</div>}
              </div>
              <div className="hugua-result">互卦：{hu.name} → {hu.desc}</div>
              {hu.guaCi && <div className="hexagram-guaci">《{hu.guaCi}》</div>}
              {hu.gong && <div className="hugua-gong">{hu.gong}宫</div>}
            </div>
          ) : null}
          {/* 断语独立于互卦渲染（Bug-3 解耦）：互卦缺失时结论仍可展示 */}
          <div className="duangua-text">
            {analysis && analysis.length ? analysis.map((a) => (
              <p key={a.title}><strong className="tc-text-primary">{a.title}：</strong>{a.text}</p>
            )) : (
              <p style={{ color: 'var(--text-muted)' }}>排盘数据生成中…断卦结论将在排盘完成后展示。</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== 卡片3：体用分析 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="layers" /> 梅花易数 · 体用分析
        </div>
        <div className="tiyong-grid">
          <div className="tiyong-cell">
            <div className="tiyong-label">体卦</div>
            <div className="tiyong-value">{ti ? `${ti.symbol}${ti.name}` : ''}</div>
            <div className="tiyong-label">代表自己</div>
            {ti?.wuxing && <div className="tiyong-sub">五行：{ti.wuxing}</div>}
            {ti?.virtue && <div className="tiyong-sub">卦德：{ti.virtue}</div>}
          </div>
          <div className="tiyong-cell">
            <div className="tiyong-label">用卦</div>
            <div className="tiyong-value cyan">{yong ? `${yong.symbol}${yong.name}` : ''}</div>
            <div className="tiyong-label">代表环境</div>
            {yong?.wuxing && <div className="tiyong-sub">五行：{yong.wuxing}</div>}
            {yong?.virtue && <div className="tiyong-sub">卦德：{yong.virtue}</div>}
          </div>
          <div className="tiyong-cell">
            <div className="tiyong-label">体用关系</div>
            <div className="tiyong-value green">{tiYong?.relation || ''}</div>
            <div className="tiyong-label">{tiYong ? (tiYong.ji === '吉' || tiYong.ji === '小吉' ? '吉 ✅' : '凶 ⚠️') : ''}</div>
          </div>
          <div className="tiyong-cell">
            <div className="tiyong-label">动爻方位</div>
            <div className="tiyong-value gold">{tiYong?.dongNote || ''}</div>
            <div className="tiyong-label">{tiYong ? '决定体用归属' : ''}</div>
          </div>
        </div>

        {/* 吉凶修正提示（M1：体卦旺衰会修正吉凶） */}
        {tiYong?.jiAdjusted && tiYong.rawJi && (
          <div className="meihua-ji-adjust">
            <span className="meihua-ji-adjust-tag">旺衰修正</span>
            体卦{tiWang?.strength}，吉凶由「{tiYong.rawJi}」修正为「{tiYong.ji}」
            ——{tiWang?.strength === '极衰' || tiWang?.strength === '偏衰'
              ? '体衰不受生助，纵吉亦减' : '体旺能任受克，纵凶亦减'}
          </div>
        )}

        {/* 体用关系详述 */}
        {tiYong?.desc && (
          <div className="meihua-tiyong-desc">
            <div className="sub-sec-title">体用生克详述</div>
            <div className="meihua-tiyong-desc-text">{tiYong.desc}</div>
          </div>
        )}

        {/* ===== 体用旺衰（M1） ===== */}
        {(tiWang || yongWang) && (
          <div className="meihua-wangshuai">
            <div className="sub-sec-title">
              体用旺衰
              {data?.wangshuai && (
                <span className="meihua-ws-meta">
                  月令{data.wangshuai.monthZhi} · 日辰{data.wangshuai.dayGan}{data.wangshuai.dayZhi}
                  （{data.wangshuai.dayWuxing}） · 旬空{data.wangshuai.xunkong}
                </span>
              )}
            </div>
            <div className="meihua-ws-hint">
              梅花以「体卦宜旺不宜衰」为要：体旺则能任受克，体衰则纵遇生助亦难成。
            </div>
            <div className="meihua-ws-grid">
              {tiWang && (
                <div className="meihua-ws-cell ti">
                  <div className="meihua-ws-label">体卦（自己）</div>
                  <div className="meihua-ws-name">{tiWang.name}·{tiWang.wuxing}</div>
                  <div className="meihua-ws-row">
                    <span>月令</span>
                    <span className="meihua-ws-val" style={{ color: wsColor(tiWang.yueWang) }}>{tiWang.yueWang}</span>
                  </div>
                  <div className="meihua-ws-row">
                    <span>日辰</span>
                    <span className="meihua-ws-day">{tiWang.dayRelation}</span>
                  </div>
                  <div className="meihua-ws-row strength">
                    <span>气势</span>
                    <span className="meihua-ws-val" style={{ color: strengthColor(tiWang.strength) }}>{tiWang.strength}</span>
                  </div>
                  {data?.wangshuai?.tiEmpty && <div className="meihua-ws-empty">体卦落旬空，事多虚而不实</div>}
                </div>
              )}
              {yongWang && (
                <div className="meihua-ws-cell yong">
                  <div className="meihua-ws-label">用卦（环境/对方）</div>
                  <div className="meihua-ws-name">{yongWang.name}·{yongWang.wuxing}</div>
                  <div className="meihua-ws-row">
                    <span>月令</span>
                    <span className="meihua-ws-val" style={{ color: wsColor(yongWang.yueWang) }}>{yongWang.yueWang}</span>
                  </div>
                  <div className="meihua-ws-row">
                    <span>日辰</span>
                    <span className="meihua-ws-day">{yongWang.dayRelation}</span>
                  </div>
                  <div className="meihua-ws-row strength">
                    <span>气势</span>
                    <span className="meihua-ws-val" style={{ color: strengthColor(yongWang.strength) }}>{yongWang.strength}</span>
                  </div>
                  {data?.wangshuai?.yongEmpty && <div className="meihua-ws-empty">用卦落旬空，外力虚而不实</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 卦象含义（体卦 / 用卦 + 解说） */}
        {(ti || yong) && (
          <div className="meihua-trigram-meaning">
            <div className="sub-sec-title">卦象含义</div>
            <div className="meihua-meaning-grid">
              {ti && (
                <div className="meihua-meaning-card ti">
                  <div className="meihua-meaning-head">
                    <span className="meihua-meaning-symbol">{ti.symbol}</span>
                    <span className="meihua-meaning-name">{ti.name} · {ti.wuxing}</span>
                    <span className="meihua-meaning-virtue">德：{ti.virtue}</span>
                  </div>
                  <div className="meihua-meaning-body">
                    <span className="meihua-meaning-label">象</span>
                    <span className="meihua-meaning-text">{ti.meaning || '—'}</span>
                  </div>
                  <div className="meihua-meaning-desc">
                    体为{ti.symbol}{ti.name}（{ti.wuxing}），性{ti.virtue}，主问者自身状态。
                  </div>
                </div>
              )}
              {yong && (
                <div className="meihua-meaning-card yong">
                  <div className="meihua-meaning-head">
                    <span className="meihua-meaning-symbol">{yong.symbol}</span>
                    <span className="meihua-meaning-name">{yong.name} · {yong.wuxing}</span>
                    <span className="meihua-meaning-virtue">德：{yong.virtue}</span>
                  </div>
                  <div className="meihua-meaning-body">
                    <span className="meihua-meaning-label">象</span>
                    <span className="meihua-meaning-text">{yong.meaning || '—'}</span>
                  </div>
                  <div className="meihua-meaning-desc">
                    用为{yong.symbol}{yong.name}（{yong.wuxing}），性{yong.virtue}，主所问之事/外部环境。
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== 卡片4：万物类象（M3） ===== */}
      {(ti?.leiXiang || yong?.leiXiang) && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="flower" /> 梅花易数 · 万物类象
          </div>
          <div className="meihua-leixiang-hint">
            梅花以象断事：八卦对应天地万物，问「所失何在」「来者何人」皆可据此取象。
          </div>
          <div className="meihua-leixiang-grid">
            {ti?.leiXiang && (
              <div className="meihua-leixiang-col">
                <div className="meihua-lx-head">体卦 {ti.symbol}{ti.name}（{ti.wuxing}）</div>
                {LEIXIANG_ROWS.map((r) => (
                  <div className="meihua-lx-row" key={`ti-${r.key}`}>
                    <span className="meihua-lx-label">{r.label}</span>
                    <span className="meihua-lx-val">{ti.leiXiang![r.key]}</span>
                  </div>
                ))}
              </div>
            )}
            {yong?.leiXiang && (
              <div className="meihua-leixiang-col">
                <div className="meihua-lx-head cyan">用卦 {yong.symbol}{yong.name}（{yong.wuxing}）</div>
                {LEIXIANG_ROWS.map((r) => (
                  <div className="meihua-lx-row" key={`yong-${r.key}`}>
                    <span className="meihua-lx-label">{r.label}</span>
                    <span className="meihua-lx-val">{yong.leiXiang![r.key]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 卡片5：错卦 · 综卦（M7） ===== */}
      {(data?.cuoGua || data?.zongGua) && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="flower" /> 梅花易数 · 错卦综卦
          </div>
          <div className="meihua-cuozong-grid">
            {data?.cuoGua && (
              <div className="meihua-cz-cell">
                <div className="meihua-cz-tag">错卦</div>
                <div className="meihua-gua-symbol">{data.cuoGua.symbol}</div>
                <div className="meihua-gua-name">{data.cuoGua.name}</div>
                <div className="meihua-gua-desc">{data.cuoGua.desc}</div>
              </div>
            )}
            {data?.zongGua && (
              <div className="meihua-cz-cell">
                <div className="meihua-cz-tag">综卦</div>
                <div className="meihua-gua-symbol">{data.zongGua.symbol}</div>
                <div className="meihua-gua-name">{data.zongGua.name}</div>
                <div className="meihua-gua-desc">{data.zongGua.desc}</div>
              </div>
            )}
          </div>
          <div className="meihua-cz-note">错卦（阴阳全反）观其对立之象，综卦（上下翻转）观其倒置之象，与互变合参。</div>
        </div>
      )}

      {/* ===== 卡片6：体用互变四卦关系矩阵（M9） ===== */}
      {data?.relationMatrix && data.relationMatrix.length > 0 && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="layers" /> 梅花易数 · 四卦关系矩阵
          </div>
          <div className="meihua-matrix">
            {data.relationMatrix.map((row, i) => (
              <div className="meihua-matrix-row" key={i}>
                <span className="meihua-matrix-from">{row.from} → {row.to}</span>
                <span className="meihua-matrix-ji" style={{ color: jiColor(row.ji) }}>{row.ji}</span>
                <span className="meihua-matrix-detail">{row.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 卡片7：应期推断（M2） ===== */}
      {data?.yingqi && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="flower" /> 梅花易数 · 应期推断
            {data.numType === 'hou' && <span className="meihua-numtype-tag">后天数</span>}
          </div>
          <div className="meihua-yingqi-summary">{data.yingqi.summary}</div>
          <div className="meihua-yingqi-points">
            {data.yingqi.points.map((p, i) => (
              <div className="meihua-yingqi-point" key={i}>
                <span className="meihua-yingqi-label">{p.label}</span>
                <span className="meihua-yingqi-text">{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
