/**
 * 跨页共享类型层（P3-1）。
 * ----------------------------------------------------------------
 * 把散落在各页 / 模块里的「真正跨页共享」类型收口到一处，形成统一入口。
 *
 * 设计红线（踩坑结论）：
 *  - 同名异形的类型**不可强行合并**。例如：
 *      · BaziWuxing —— api.ts 是 UI 展示 {label,pct,icon}，ceming.ts 是算法内部 {map,lacking}；
 *      · SynastryResult —— horoscope 合婚与 numerology 合盘字段完全不同。
 *    强行合并会破坏编译，因此各自保留、仅在此层声明「以某处为权威」。
 *  - 排盘结果类型目前集中在 @/lib/api，此处再导出一次形成统一导入面（向后兼容）。
 *  - 各页仍可从 @/lib/api 取这些类型，旧导入无需改动。
 */

/** 卜卦页可选术数模块键（bugua 页与 modules 共享，原定义于 app/bugua/shared.tsx） */
export type ModuleKey =
  | 'bazi'
  | 'ziwei'
  | 'liuyao'
  | 'meihua'
  | 'qimen'
  | 'liuren'
  | 'taiyi';

// ---- 排盘 / 解读共享类型：以 @/lib/api 为权威源，统一再导出 ----
export type {
  PaipanRequest,
  InterpretModule,
  InterpretResponse,
  BaziAPIResult,
  ZiweiAPIResult,
  LiuyaoAPIResult,
  MeihuaAPIResult,
  QimenAPIResult,
  LiuRenAPIResult,
  TaiyiAPIResult,
  QimenPalace,
  ZiweiPalace,
  LiuRenPanCell,
  TaiYiGongCell,
} from '@/lib/api';
