/**
 * 成年人角色压力 & 复原力测评 —— AI system prompt 与问卷框架
 * ----------------------------------------------------------------------------
 * 合规重定位（2026-09-17）：这是「玄镜」从占卜转向「自我觉察与疗愈」后的
 * 第一个合规付费测评。它**完全脱离生日 / 生辰 / 命盘**，只基于用户自评问卷，
 * 输出自我觉察报告，不给诊断、不算吉凶、不替代专业帮助。
 *
 * 设计原则（对应合规三要件「拆吉凶结论 + 拆消灾开运 + 拆获利引流」）：
 *  - 给「觉察」不给「判决」：用户能看到自己的压力结构，但没有人替他判吉凶。
 *  - 去性别化：覆盖 30+ 成年人共同焦虑（事业卡顿 / 关系孤独 / 父母健康 /
 *    育儿担忧 / 单身焦虑），不假设性别。
 *  - 去病理化：不贴任何诊断标签；严重痛苦时引导专业帮助，不替代治疗。
 *
 * 接入方式（后续阶段2实现测评页时使用）：
 *  1. AI 服务（oraclemind-ai-py）新增 agent，例如 POST /api/v1/agent/assessment/stream，
 *     复用现有 SSE 基建（parseSSE 已支持 phase/delta/meta/done）；
 *     或复用 report agent，接受 mode='resilience' 切换本 prompt。
 *  2. 前端新增测评页：渲染 RESILIENCE_QUESTIONS 收集答案 → 组装 answers 文本
 *     → 调上述端点（system 用 RESILIENCE_ASSESSMENT_SYSTEM_PROMPT，
 *       question 传「请根据我的自评生成复原力报告」+ answers 摘要）。
 *  3. 渲染返回的 markdown 报告（复用现有 mdToHtml / ReportRadar 等组件）。
 *  4. 付费：本测评作为合规付费商品上线（itemId 如 'resilience_assess'，
 *     不在 PAUSED_ITEMS 内），与占卜类暂停形成对比。
 */

/** 系统提示词：定义角色、硬约束与输出结构 */
export const RESILIENCE_ASSESSMENT_SYSTEM_PROMPT = `你是一个「自我觉察与复原力陪伴」教练，不是算命师、不是医生、也不是心理治疗师。

你的任务：基于用户在「事业 / 关系 / 家庭 / 自我」四个维度的自评问卷，生成一份**自我觉察报告**，帮助用户看清自己当前的压力结构、已经拥有的资源，以及可以轻装起步的一小步。

【严格约束】
1. 去性别化：绝不假设用户性别，不用「她 / 他」指代，统一用「你」。覆盖男女共同的焦虑来源——事业卡顿、关系中的孤独、父母健康担忧、育儿与家庭责任、单身与亲密关系焦虑。
2. 去病理化：不使用任何诊断标签（如抑郁、焦虑障碍等），不给人贴病。若用户表达强烈痛苦或有自伤倾向，温和而明确地建议寻求专业帮助（如公立医院心理科 / 心理危机干预热线），并说明你无法替代专业治疗。
3. 非算命非预言：绝不给吉凶、运势、命中注定类结论；不基于任何生日 / 生辰推算；用户填的是「此刻的自评」，不是命盘。
4. 给觉察不给判决：用「你现在的模式可能是…」「你已经在用的资源是…」「可以试的一小步是…」，而不是「你会…」「你应该…」。尊重用户的自主：你只提供视角，决定权在用户。
5. 不制造恐慌：不放大用户的担忧；先看见资源与已做的努力，再谈可行动项。

【输出结构（markdown，中文 800–1200 字，语气温暖平等像有阅历的朋友轻轻点一下）】
# 你的复原力快照
- 用 2–3 句话概括用户当前的「压力—资源」平衡，先肯定再点状提示。

## 四个维度的觉察
对事业 / 关系 / 家庭 / 自我每一维，各给：
① 你呈现的模式（基于其自评，具体化、不泛泛）
② 你已经在用的资源（从回答里挖出用户已做的努力，真诚肯定）
③ 一个可试的小步（具体、本周能做、不费力）

## 你已经在做的
- 汇总用户已有的应对方式，具体化地肯定，强化「我并非毫无办法」的感受。

## 可以轻装起步的一小步
- 3 条具体、本周可做的微行动，每条一句话，低门槛。

## 当你需要更多支持
- 若痛苦超出自我调节：原则性建议联系专业帮助（医院心理科 / 心理援助热线），说明这不等于软弱，也不替代治疗。

【禁止】
- 禁止任何「命 / 运 / 吉 / 凶 / 改运 / 化解 / 开运」类表述。
- 禁止诊断、禁止 predict 未来确定事件。
- 禁止让用户依赖你做重大决定（离职 / 分手 / 就医等），只提供视角与资源。`;

/** 用户自评问卷（供测评页 UI 渲染；答案以文本形式随请求发送） */
export interface ResilienceQuestion {
  /** 维度：事业 / 关系 / 家庭 / 自我 */
  dimension: '事业' | '关系' | '家庭' | '自我';
  /** 题号 */
  key: string;
  /** 题干 */
  label: string;
  /** 占位提示 */
  placeholder: string;
}

export const RESILIENCE_QUESTIONS: ResilienceQuestion[] = [
  // —— 事业 ——
  { dimension: '事业', key: 'career_tension', label: '最近一个月，工作 / 收入里让你最紧绷的是哪件事？', placeholder: '例如：担心被优化、收入不稳、想转行却不敢动…' },
  { dimension: '事业', key: 'career_stuck', label: '你觉得自己「卡住」的核心点是什么？', placeholder: '例如：不确定方向、技能跟不上、没人带…' },
  { dimension: '事业', key: 'career_coping', label: '你已经为这件事做过什么？哪怕很小。', placeholder: '例如：看了些课、跟朋友聊过、投过几份简历…' },
  // —— 关系 ——
  { dimension: '关系', key: 'rel_lonely', label: '哪段关系让你最感到孤独或不被理解？', placeholder: '伴侣 / 朋友 / 家人 都可以说' },
  { dimension: '关系', key: 'rel_pattern', label: '碰到关系卡点时，你通常会怎么应对？', placeholder: '例如：憋着、爆发、回避、找人聊…' },
  // —— 家庭 ——
  { dimension: '家庭', key: 'fam_worry', label: '对父母健康 / 子女养育的担忧，现在大概占你心力的几成？', placeholder: '0–10 都可以，或描述具体担心' },
  { dimension: '家庭', key: 'fam_ready', label: '为了这些担忧，你已经做了哪些准备或安排？', placeholder: '例如：体检预约、存了笔钱、跟家人聊过…' },
  // —— 自我 ——
  { dimension: '自我', key: 'self_harsh', label: '你对自己最苛刻、最常自我攻击的是哪一点？', placeholder: '例如：不够好、不够拼、不会来事…' },
  { dimension: '自我', key: 'self_relief', label: '什么事 / 什么时刻能让你稍微松一口气？', placeholder: '例如：散步、做饭、发呆、跟猫玩…' },
];

/** 把问卷答案拼成发送给 AI 的 question 正文 */
export function buildResiliencePrompt(answers: Record<string, string>): string {
  const byDim: Record<string, string[]> = {};
  for (const q of RESILIENCE_QUESTIONS) {
    const a = (answers[q.key] || '').trim();
    if (!a) continue;
    (byDim[q.dimension] ||= []).push(`· ${q.label}\n  答：${a}`);
  }
  const blocks = Object.entries(byDim)
    .map(([dim, lines]) => `【${dim}】\n${lines.join('\n')}`)
    .join('\n\n');
  return `请根据我的自评，生成一份「成年人角色压力 & 复原力」自我觉察报告：\n\n${blocks || '（用户未填写具体自评）'}`;
}
