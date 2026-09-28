/**
 * 全站页脚 · 合规免责声明
 * 2026-09-17 合规重定位（refactor/compliance-reposition 分支）：
 * 玄镜从「命理占卜」重定位为「自我觉察与情绪梳理」平台，页脚常驻免责声明，
 * 明确「非诊断 / 非吉凶预测 / 非医疗建议」，并引导专业帮助（合规三要件：拆吉凶结论 + 拆消灾开运 + 拆获利引流）。
 */
export default function SiteFooter() {
  return (
    <footer
      style={{
        marginTop: 48,
        padding: '28px 20px',
        borderTop: '1px solid var(--line, #ece7df)',
        background: 'var(--soft, #f4f1ea)',
        color: 'var(--sub, #6b6660)',
        fontSize: 13,
        lineHeight: 1.8,
        textAlign: 'center',
      }}
    >
      <p style={{ maxWidth: 760, margin: '0 auto 8px', padding: '0 12px' }}>
        免责声明：玄镜提供的内容仅供<strong>自我觉察、情绪梳理与个人成长</strong>参考，
        不构成医疗、心理或法律诊断建议，也不对未来吉凶祸福作出预测。
        如遇持续的情绪困扰、焦虑或压力，请及时向专业心理咨询师或正规医疗机构寻求帮助。
      </p>
      <p style={{ margin: 0, opacity: 0.8 }}>
        © 2026 玄镜 OracleMind · 内容由 AI 生成，仅供参考
      </p>
    </footer>
  );
}
