'use client';

import type { LiuyaoAPIResult, LiuyaoLine, LiuyaoBianLine } from '@/lib/api';
import SectionIcon from '@/components/ui/SectionIcon';
import { ModuleProps, ApiBadge, LIUYAO_LINES } from '../shared';

/** 模块4：六爻起卦 */
export function LiuyaoModule({ data, status }: ModuleProps<LiuyaoAPIResult>) {
  const ben = data?.benGua;
  const bian = data?.bianGua ?? null;
  const lines = data?.lines ?? LIUYAO_LINES;
  const ys = data?.yongshen;
  const qg = data?.qigua;
  const methodLabel = data?.method === 'coin' ? '摇钱法' : data?.method === 'manual' ? '手动' : '时间起卦';
  const dongYaos = data?.dongYaos && data.dongYaos.length ? data.dongYaos : (data?.dongYao ? [data.dongYao] : []);
  const dongLabel = dongYaos.length === 0 ? '六爻安静' : '第' + dongYaos.join('、第') + '爻';
  const special = data?.special;

  // 用神旺衰颜色映射
  const strengthColor = (s?: string) => {
    if (!s) return 'var(--text-muted)';
    if (s === '旺' || s === '相') return 'var(--accent-green)';
    if (s === '死' || s === '囚') return '#ff6b6b';
    return 'var(--accent-gold)';
  };

  // 爻位白话释义（从下往上数，本质是「远近·内外·尊卑·始终」的相对概念）
  const POS_MEANING: Record<string, string> = {
    '初爻': '最底下、最贴近自己的一爻，主事情的开端、根基和最近身的地方。',
    '二爻': '从下往上第二爻，比初爻稍往外一步，主内里、近处的事。',
    '三爻': '中间偏下、处在内外过渡的位置，主身边、进退之间。',
    '四爻': '中间偏上、已经偏向外头，主稍远的事、外处。',
    '五爻': '第五爻，卦里最尊贵的「君位」，主关键、主导和大事。',
    '上爻': '最顶上、最外最远的一爻，主结果、收尾和大环境。',
  };
  // 六亲白话释义
  const SHISHEN_MEANING: Record<string, string> = {
    '父母': '生我者，主长辈、文书、庇护，也带点操劳。',
    '官鬼': '克我者，主事业、官职、规矩，也主压力和约束。',
    '妻财': '我克者，主钱财、收入、妻室，也主享受和实在的好处。',
    '子孙': '我生者，主后代、福气、解忧，是轻松快活的一颗星。',
    '兄弟': '同我者，主同辈、朋友，也主分夺、竞争和帮衬。',
    '世': '就是你自己（世爻），问卦人自身的落点。',
  };
  // 六神白话释义
  const LIUSHEN_MEANING: Record<string, string> = {
    '青龙': '喜神，主吉庆、生机和美善，遇之多顺。',
    '朱雀': '主口舌、文书和喧闹，也管消息传话。',
    '勾陈': '主牵连、阻滞和土地田宅，事情容易拖。',
    '螣蛇': '主虚惊、缠绕和怪异，像被什么事情缠住。',
    '白虎': '凶神，主刑伤、血光和肃杀，遇之要当心。',
    '玄武': '主隐秘、盗失和暧昧，也管暗地里的事。',
  };

  // 每一爻一句话白话解说（内联到爻行下方）
  const lineOneLiner = (l: LiuyaoLine): string => {
    const yinYang = l.yao === 'yang' ? '阳爻' : '阴爻';
    const ss = l.shishen || '';
    const ssNote = SHISHEN_MEANING[l.shishen] || '';
    const lsNote = l.liushen ? `${l.liushen}主${LIUSHEN_MEANING[l.liushen] || ''}` : '';
    let core: string;
    if (l.gold) {
      const bian = l.bianGan ? `化出${l.bianGan}${l.bianZhi}·${l.bianWuxing}` : '起了变化';
      const tail: string[] = [];
      if (l.jinTui) tail.push(l.jinTui);
      if (l.houtou) tail.push(l.houtou);
      core = `发动、${bian}${tail.length ? `（${tail.join('、')}）` : ''}，这一爻动了，事情有转机`;
    } else {
      core = '安静无变，这一爻暂未发动';
    }
    const extra: string[] = [];
    if (l.yuePo) extra.push('逢月破');
    if (l.anDong) extra.push('有暗动');
    if (l.ruMu) extra.push('入墓');
    if (l.huaMu) extra.push('化墓');
    if (l.changsheng) extra.push('临' + l.changsheng);
    const posNote = POS_MEANING[l.pos] || '';
    return `${l.pos}（${yinYang}）属${ss}${ssNote ? '，' + ssNote : ''}${lsNote ? '，' + lsNote : ''}。${posNote}${core}${extra.length ? '；另外' + extra.join('、') : ''}。`;
  };

  // 变卦每一爻一句话白话解说（化出之爻的六亲 / 六神 / 旺衰）
  const bianLineOneLiner = (l: LiuyaoBianLine): string => {
    const yinYang = l.yao === 'yang' ? '阳爻' : '阴爻';
    const ss = l.shishen || '';
    const ssNote = SHISHEN_MEANING[l.shishen] || '';
    const lsNote = l.liushen ? `${l.liushen}主${LIUSHEN_MEANING[l.liushen] || ''}` : '';
    const tail = `旺衰为「${l.strength}」${l.isEmpty ? '，且空亡（有力难施）' : '，不空'}`;
    const posNote = POS_MEANING[l.pos] || '';
    if (l.isBian) {
      return `${l.pos}（${yinYang}）化出为${ss}${ssNote ? '，' + ssNote : ''}${lsNote ? '，' + lsNote : ''}；${posNote}这是动爻所化出之爻，${tail}——转机与结局在此。`;
    }
    return `${l.pos}（${yinYang}）属${ss}${ssNote ? '，' + ssNote : ''}${lsNote ? '，' + lsNote : ''}；${posNote}${tail}。`;
  };

  return (
    <>
      {/* ===== 卡片1：本卦与变卦 + 起卦过程 ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="hexagram" /> 六爻起卦 · 本卦与变卦 <ApiBadge status={status} />
        </div>

        {/* 起卦信息概览 */}
        {data && (
          <div className="qimen-intro">
            用神：<strong className="tc-secondary">{ys?.name}</strong>（{ys?.meaning}）
            {' '}| 起卦：<strong className="tc-secondary">{methodLabel}</strong>
            {' '}| 动爻：<strong className="tc-secondary">{dongLabel}</strong> | 农历：{data.lunar}
            {data.timeText && <>{' '}| 时辰：{data.timeText}</>}
          </div>
        )}

        {/* 本卦与变卦 */}
        <div className="liuyao-hexagram-grid">
          <div className="hexagram-card">
            <div className="hexagram-label">📖 本卦</div>
            <div className="hexagram-symbol">{ben?.symbol || ''}</div>
            <div className="hexagram-name">{ben?.name || ''}</div>
            <div className="hexagram-desc">{ben?.desc || ''}</div>
            {ben?.guaCi && <div className="hexagram-guaci">《{ben.guaCi}》</div>}
            {ben?.gong && (
              <div className="hexagram-meta">{ben.gong}宫·{ben.gongWuxing || ''}</div>
            )}
            {ben?.shiPos != null && ben?.yingPos != null && (
              <div className="hexagram-shiying">
                世在第{ben.shiPos}爻 · 应在第{ben.yingPos}爻
              </div>
            )}
          </div>
          <div className="hexagram-card change">
            <div className="hexagram-label">🔄 变卦</div>
            <div className="hexagram-symbol">{bian?.symbol || ''}</div>
            <div className="hexagram-name pink">{bian?.name || ''}</div>
            <div className="hexagram-desc">{bian?.desc || ''}</div>
            {bian?.guaCi && <div className="hexagram-guaci">《{bian.guaCi}》</div>}
            {bian?.gong && (
              <div className="hexagram-meta">{bian.gong}宫·{bian.gongWuxing || ''}</div>
            )}
          </div>
        </div>

        {/* 起卦计算过程 */}
        {qg?.calc && (
          <div className="liuyao-qigua-process">
            <div className="sub-sec-title">起卦推演</div>
            <div className="liuyao-qigua-calc">{qg.calc}</div>
            <div className="liuyao-qigua-detail">
              <span>年支：{qg.yearZhi}</span>
              <span>农历月：{qg.lunarMonth}</span>
              <span>农历日：{qg.lunarDay}</span>
              <span>时支：{qg.timeZhi}</span>
              <span>上卦数：{qg.shangNum}</span>
              <span>下卦数：{qg.xiaNum}</span>
              <span>动爻：第{qg.dongYao}爻</span>
            </div>
          </div>
        )}

        {/* 本卦 / 变卦 / 用神 解说 */}
        <div className="liuyao-jieshuo">
          <div className="sub-sec-title">卦象与用神解说</div>
          <div className="liuyao-js-block">
            <div className="liuyao-js-label">📖 本卦</div>
            <div className="liuyao-js-text">
              本卦为所问之事的当下本体与起始之象。「{ben?.name}」（{ben?.gong}宫·{ben?.gongWuxing}）：{ben?.desc}
              {ben?.guaCi && <>卦辞：《{ben.guaCi}》</>}
            </div>
          </div>
          <div className="liuyao-js-block">
            <div className="liuyao-js-label">🔄 变卦</div>
            {bian ? (
              <div className="liuyao-js-text">
                变卦为事物发展之结局与转机之象。「{bian.name}」（{bian.gong}宫·{bian.gongWuxing}）：{bian.desc}
                {bian?.guaCi && <>卦辞：《{bian.guaCi}》</>}
              </div>
            ) : (
              <div className="liuyao-js-text">六爻安静、无变卦——事态尚未发动，宜静观其变、待机而行。</div>
            )}
          </div>
          {ys && (
            <div className="liuyao-js-block">
              <div className="liuyao-js-label">🎯 用神</div>
              <div className="liuyao-js-text">
                用神为所问之事的核心用爻，断卦以用神旺衰为枢。以「{ys.name}」（{ys.category}）为用神——{ys.meaning}，居第{ys.position}爻（{ys.wuxing}行）。
                {ys.yaoCi && <>用神为动爻，其爻辞：《{ys.yaoCi}》</>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== 卡片2：六爻卦象详解（干支/五行/十神分行） ===== */}
      <div className="result-card">
        <div className="result-card-title">
          <SectionIcon name="hexagram" /> 六爻卦象详解
        </div>
        <div className="liuyao-trigram">
          {lines.map((l) => (
            <div className={'liuyao-line' + (l.gold ? ' liuyao-line-dong' : '')} key={l.pos}>
              <div className="liuyao-line-pos">{l.pos}</div>
              <div className={'liuyao-line-yao ' + l.yao}>{l.text}</div>
              <div className="liuyao-line-detail">
                <span className="liuyao-line-gz">{l.gan}{l.zhi}</span>
                <span className="liuyao-line-wx">{l.wuxing}</span>
                <span className="liuyao-line-ss">{l.shishen}</span>
                {l.liushen && <span className="liuyao-line-ls">{l.liushen}</span>}
              </div>
              {(l.nayin || (l.shensha && l.shensha.length) || l.yaoCi) && (
                <div className="liuyao-line-tags">
                  {l.nayin && <span className="liuyao-tag nayin">{l.nayin}</span>}
                  {l.shensha?.map((s) => (
                    <span key={s} className="liuyao-tag shensha">{s}</span>
                  ))}
                  {l.yaoCi && <span className="liuyao-tag yaoci">爻辞：{l.yaoCi}</span>}
                </div>
              )}
              <div className="liuyao-line-fufu">
                飞 {l.gan}{l.zhi}·{l.shishen} ｜ 伏 {l.fuGan}{l.fuZhi}·{l.fuShishen}
              </div>
              {l.right && <div className={'liuyao-right' + (l.gold ? ' gold' : l.pink ? ' pink' : '')}>{l.right}</div>}
              <div className="liuyao-line-note">{lineOneLiner(l)}</div>
            </div>
          ))}
        </div>

        {/* 变卦逐爻装卦（G4）：化出之爻的六亲 / 六神 / 旺衰 */}
        {data?.bianLines && data.bianLines.length > 0 && (
          <>
            <div className="sub-sec-title">🔄 变卦（化出之象）逐爻装卦</div>
            <div className="liuyao-ys-hint">
              变卦六亲按【本卦宫五行】推（用神体系不变），干支按变卦自身宫纳甲；粉色「变爻」即动爻所化出之爻，是吉凶转机所在。
            </div>
            <div className="liuyao-trigram liuyao-trigram-bian">
              {data.bianLines.map((l) => (
                <div className={'liuyao-line' + (l.isBian ? ' liuyao-line-bian' : '')} key={l.pos}>
                  <div className="liuyao-line-pos">{l.pos}</div>
                  <div className={'liuyao-line-yao ' + l.yao}>{l.text}</div>
                  <div className="liuyao-line-detail">
                    <span className="liuyao-line-gz">{l.gan}{l.zhi}</span>
                    <span className="liuyao-line-wx">{l.wuxing}</span>
                    <span className="liuyao-line-ss">{l.shishen}</span>
                    {l.liushen && <span className="liuyao-line-ls">{l.liushen}</span>}
                    <span className="liuyao-line-strength" style={{ color: strengthColor(l.strength) }}>{l.strength}</span>
                  </div>
                  {(l.nayin || (l.shensha && l.shensha.length)) && (
                    <div className="liuyao-line-tags">
                      {l.nayin && <span className="liuyao-tag nayin">{l.nayin}</span>}
                      {l.shensha?.map((s) => (
                        <span key={s} className="liuyao-tag shensha">{s}</span>
                      ))}
                    </div>
                  )}
                  {l.right && <div className={'liuyao-right' + (l.isBian ? ' pink' : '')}>{l.right}</div>}
                  {l.isBian && <div className="liuyao-line-note">{bianLineOneLiner(l)}</div>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* 各爻解说已内联到每爻行下方（liuyao-line-note） */}
      </div>

      {/* ===== 卡片2.5：互卦 / 错卦 / 综卦（G9） ===== */}
      {data?.guaBianhua && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="hexagram" /> 卦变关系 · 互 / 错 / 综
          </div>
          <div className="liuyao-ys-hint">
            互卦（二三四爻为下、三四五爻为上）、错卦（阴阳全反）、综卦（上下翻转），三者辅助参看本卦所藏之象与变易之机。
          </div>
          {(['hu', 'cuo', 'zong'] as const).map((k) => {
            const LABELS: Record<string, string> = { hu: '互卦', cuo: '错卦', zong: '综卦' };
            const benH = data.guaBianhua?.ben[k];
            const bianH = data.guaBianhua?.bian?.[k];
            if (!benH) return null;
            return (
              <div className="liuyao-hc-row" key={k}>
                <div className="liuyao-hc-type">{LABELS[k]}</div>
                <div className="liuyao-hc-ben">
                  <span className="liuyao-hc-symbol">{benH.symbol}</span>
                  <span className="liuyao-hc-name">{benH.name}</span>
                  <span className="liuyao-hc-desc">{benH.desc}</span>
                </div>
                {bianH && (
                  <div className="liuyao-hc-bian">
                    <span className="liuyao-hc-symbol pink">{bianH.symbol}</span>
                    <span className="liuyao-hc-name pink">{bianH.name}</span>
                    <span className="liuyao-hc-desc">{bianH.desc}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== 卡片3：用神详情面板 ===== */}
      {ys && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="layers" /> 用神详解 · 旺衰与生克
          </div>

          {/* 用神基本信息 */}
          <div className="liuyao-ys-overview">
            <div className="liuyao-ys-cell">
              <div className="liuyao-ys-label">用神</div>
              <div className="liuyao-ys-val">{ys.name}</div>
              <div className="liuyao-ys-sub">{ys.category}</div>
            </div>
            <div className="liuyao-ys-cell">
              <div className="liuyao-ys-label">五行</div>
              <div className="liuyao-ys-val">{ys.wuxing}</div>
              <div className="liuyao-ys-sub">{ys.gan}{ys.zhi}·第{ys.position}爻</div>
            </div>
            <div className="liuyao-ys-cell">
              <div className="liuyao-ys-label">旺衰</div>
              <div className="liuyao-ys-val" style={{ color: strengthColor(ys.strength) }}>{ys.strength || '—'}</div>
              <div className="liuyao-ys-sub">月令{ys.monthZhi || '—'}</div>
            </div>
            <div className="liuyao-ys-cell">
              <div className="liuyao-ys-label">旬空</div>
              <div className="liuyao-ys-val" style={{ color: ys.isEmpty ? '#ff6b6b' : 'var(--accent-green)' }}>
                {ys.isEmpty ? '空亡' : '不空'}
              </div>
              <div className="liuyao-ys-sub">{ys.isEmpty ? '有力难施' : '可用'}</div>
            </div>
          </div>

          {/* 日辰关系 */}
          <div className="sub-sec-title">日辰关系</div>
          <div className="liuyao-ys-hint">日辰（当日的地支）生用神则帮、克用神则损，是看旺衰的第二把尺子（第一把是月令）。</div>
          <div className="liuyao-ys-row">
            <span className="liuyao-ys-row-label">日柱</span>
            <span className="liuyao-ys-row-val">{ys.dayGan}{ys.dayZhi}</span>
            <span className="liuyao-ys-row-label">关系</span>
            <span className="liuyao-ys-row-val">{ys.dayRelation}</span>
          </div>
          {ys.emptyNote && (
            <div className="liuyao-ys-note">{ys.emptyNote}</div>
          )}

          {/* 原神/忌神/仇神 */}
          <div className="sub-sec-title">原神 · 忌神 · 仇神</div>
          <div className="liuyao-ys-hint">原神生扶用神、忌神克伤用神、仇神生忌神而克原神——三者合力，决定用神到底强还是弱。</div>
          <div className="liuyao-san-grid">
            <div className="liuyao-san-cell yuan">
              <div className="liuyao-san-label">原神</div>
              <div className="liuyao-san-wx">{ys.yuanShen?.wuxing || '—'}</div>
              <div className="liuyao-san-ss">{ys.yuanShen?.shishen || '—'}</div>
              <div className="liuyao-san-note">{ys.yuanShen?.note || ''}</div>
            </div>
            <div className="liuyao-san-cell jin">
              <div className="liuyao-san-label">忌神</div>
              <div className="liuyao-san-wx">{ys.jiShen?.wuxing || '—'}</div>
              <div className="liuyao-san-ss">{ys.jiShen?.shishen || '—'}</div>
              <div className="liuyao-san-note">{ys.jiShen?.note || ''}</div>
            </div>
            <div className="liuyao-san-cell chou">
              <div className="liuyao-san-label">仇神</div>
              <div className="liuyao-san-wx">{ys.chouShen?.wuxing || '—'}</div>
              <div className="liuyao-san-ss">{ys.chouShen?.shishen || '—'}</div>
              <div className="liuyao-san-note">{ys.chouShen?.note || ''}</div>
            </div>
          </div>

          {/* 世应辅助 */}
          <div className="sub-sec-title">世应辅助</div>
          <div className="liuyao-ys-hint">世爻代表你（问卦人自身），应爻代表对方或所问之事——看世应谁强，就知道你和这事谁占上风。</div>
          <div className="liuyao-ys-row">
            <span className="liuyao-ys-row-label">世爻</span>
            <span className="liuyao-ys-row-val">{ys.shiNote}</span>
          </div>
          <div className="liuyao-ys-row">
            <span className="liuyao-ys-row-label">应爻</span>
            <span className="liuyao-ys-row-val">{ys.yingNote}</span>
          </div>

          {/* 综合吉凶 */}
          <div className="sub-sec-title">综合吉凶倾向</div>
          <div className="liuyao-tendency">
            <div className="liuyao-tendency-text">{ys.tendency}</div>
            {ys.hostNote && <div className="liuyao-tendency-host">{ys.hostNote}</div>}
          </div>

          {/* 世爻旺衰（问卦人自身根基，P1-1） */}
          <div className="sub-sec-title">世爻旺衰（问卦人自身根基）</div>
          <div className="liuyao-ys-hint">世爻代表你本人，它的旺衰决定自身有没有底气扛住这件事——和用神旺衰一样关键。</div>
          <div className="liuyao-tendency">
            <div className="liuyao-tendency-text" style={{ color: strengthColor(ys?.shiStrength) }}>{ys?.shiStrength || '—'}</div>
            {ys?.shiStrengthNote && <div className="liuyao-tendency-host">{ys.shiStrengthNote}</div>}
          </div>

          {/* 应爻旺衰（G10：所问之事/对方） */}
          <div className="sub-sec-title">应爻旺衰（所问之事 / 对方）</div>
          <div className="liuyao-ys-hint">应爻代表对方或所问之事体，与世爻旺衰对比——世旺应衰则我强彼弱、事易成；应旺世衰则宜待自身转旺。</div>
          <div className="liuyao-tendency">
            <div className="liuyao-tendency-text" style={{ color: strengthColor(ys?.yingStrength) }}>{ys?.yingStrength || '—'}</div>
            {ys?.yingStrengthNote && <div className="liuyao-tendency-host">{ys.yingStrengthNote}</div>}
          </div>

          {/* 飞伏可视化（G12：用神不上卦时） */}
          {ys?.feifu && (
            <>
              <div className="sub-sec-title">飞伏（用神不上卦）</div>
              <div className="liuyao-ys-hint">用神「{ys.feifu.shiShenName}」未现于本卦，伏于本宫「{ys.feifu.gong}」卦；下表飞神在上、伏神在下，须审伏神之旺衰以断。</div>
              <div className="liuyao-feifu">
                <div className="liuyao-feifu-row">
                  <span className="liuyao-feifu-label">飞神（第{ys.feifu.flyPos}爻）</span>
                  <span className="liuyao-feifu-val">{ys.feifu.flyGan}{ys.feifu.flyZhi}·{ys.feifu.flyWuxing}·{ys.feifu.flyShishen}</span>
                </div>
                <div className="liuyao-feifu-row">
                  <span className="liuyao-feifu-label">伏神（第{ys.feifu.fuPos}爻）</span>
                  <span className="liuyao-feifu-val">{ys.feifu.fuGan}{ys.feifu.fuZhi}·{ys.feifu.fuWuxing}·{ys.feifu.fuShishen}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}


      {/* ===== 卡片3.5：应期推断（G5） ===== */}
      {data?.yingqi && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="hexagram" /> 应期推断（事之成败时机）
          </div>
          <div className="liuyao-ys-hint">
            应期为传统六爻定应之经验法则：据用神旺衰、旬空、月破、进退神、入墓、三合局综合推演，多因素交参，仅供参考而非绝对断语。
          </div>
          {data.yingqi.summary && (
            <div className="liuyao-yingqi-summary">{data.yingqi.summary}</div>
          )}
          <div className="liuyao-yingqi-points">
            {data.yingqi.points.map((p) => (
              <div className="liuyao-yingqi-point" key={p.label}>
                <span className="liuyao-yingqi-label">{p.label}</span>
                <span className="liuyao-yingqi-text">{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 卡片4：卦体特殊 & 全局合冲（P2） ===== */}
      {special && (() => {
        const guahunParts: string[] = [];
        if (special.guahun) guahunParts.push(`本卦为「${special.guahun}」卦`);
        if (special.bianGuahun) guahunParts.push(`变卦为「${special.bianGuahun}」卦`);
        if (special.fan) guahunParts.push('本变卦内外卦相冲（反呤）：事多反复、进退两难');
        if (special.fu) guahunParts.push('本变卦同体（伏呤）：事滞不进、旧事缠绕');
        const gs = special.guashen;
        const hasAny =
          guahunParts.length > 0 ||
          !!gs ||
          (special.sanhe?.length ?? 0) > 0 ||
          (special.liuhe?.length ?? 0) > 0 ||
          (special.liuchong?.length ?? 0) > 0 ||
          (special.involved?.length ?? 0) > 0;
        if (!hasAny) return null;
        return (
          <div className="result-card">
            <div className="result-card-title">
              <SectionIcon name="hexagram" /> 卦体特殊 · 全局合冲
            </div>

            {guahunParts.length > 0 && (
              <>
                <div className="sub-sec-title">卦体特殊（游魂 / 归魂 / 反伏）</div>
                <div className="liuyao-special-list">
                  {guahunParts.map((t, i) => (
                    <div key={i} className="liuyao-special-item">{t}</div>
                  ))}
                </div>
              </>
            )}

            {gs && (
              <>
                <div className="sub-sec-title">卦身</div>
                <div className="liuyao-special-list">
                  <div className="liuyao-special-item">月卦身：第{gs.yuePos}爻（月建 {gs.yueZhi}）</div>
                  <div className="liuyao-special-item">日卦身：第{gs.riPos}爻（日辰 {gs.riZhi}）</div>
                  {gs.note && <div className="liuyao-special-item liuyao-special-note">{gs.note}</div>}
                </div>
              </>
            )}

            {(special.sanhe?.length || special.liuhe?.length || special.liuchong?.length) ? (
              <>
                <div className="sub-sec-title">全局合冲（三合 / 六合 / 六冲）</div>
                <div className="liuyao-special-grid">
                  {special.sanhe && special.sanhe.length > 0 && (
                    <div className="liuyao-special-cell san">
                      <div className="liuyao-special-cell-label">三合局</div>
                      {special.sanhe.map((wx) => (
                        <div key={wx} className="liuyao-special-cell-val">
                          {special.sanheCheng?.[wx] ? '成局' : '现局待成'}：{wx}局
                        </div>
                      ))}
                    </div>
                  )}
                  {special.liuhe && special.liuhe.length > 0 && (
                    <div className="liuyao-special-cell he">
                      <div className="liuyao-special-cell-label">六合</div>
                      {special.liuhe.map((p) => (
                        <div key={p} className="liuyao-special-cell-val">{p}（和合）</div>
                      ))}
                    </div>
                  )}
                  {special.liuchong && special.liuchong.length > 0 && (
                    <div className="liuyao-special-cell chong">
                      <div className="liuyao-special-cell-label">六冲</div>
                      {special.liuchong.map((p) => (
                        <div key={p} className="liuyao-special-cell-val">{p}（冲散）</div>
                      ))}
                    </div>
                  )}
                </div>
                {special.involved && special.involved.length > 0 && (
                  <div className="liuyao-special-involved">世应参与：{special.involved.join('；')}</div>
                )}
              </>
            ) : null}
          </div>
        );
      })()}

      {/* ===== 卡片5：卦理详解（后端 9 段结构化解读） ===== */}
      {data?.analysis && data.analysis.length > 0 && (
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="hexagram" /> 卦理详解
          </div>
          <div className="duangua-text">
            {data.analysis.map((a) => (
              <p key={a.title}><strong className="tc-text-primary">{a.title}：</strong>{a.text}</p>
            ))}
          </div>
        </div>
      )}

    </>
  );
}
