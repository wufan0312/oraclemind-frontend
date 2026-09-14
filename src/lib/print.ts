/**
 * 统一「导出 PDF」工具
 * ----------------------------------------------------------------
 * 整站所有「导出报告 / 导出海报 / 导出星盘」最终都产出 PDF：
 * 做法 = 打开一个独立打印窗口，注入浅色中文打印样式，自动触发浏览器打印，
 * 用户在打印对话框选「另存为 PDF」即可。
 *
 * 为什么用打印窗口而不是 jsPDF/html2canvas：
 *  - 零第三方依赖，站点深色主题 + 现代 CSS 不会失真；
 *  - 中文用系统字体原生渲染，文字可选中、体积最小、跨页自动分页；
 *  - 与「整站导出改 PDF」诉求完全契合，且实现最稳。
 *
 * 调用方负责把要打印的内容渲染成一段 HTML 字符串（文本报告用 mdToHtml，
 * 图片/星盘用 <img>/内联 <svg>），传入 html 即可。
 */

/** HTML 特殊字符转义，防止报告内容破坏打印文档结构 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

/** 独立打印窗口的浅色打印样式（与站点深色主题隔离） */
const PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #ffffff; color: #1a1a1a;
    font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB",
      system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13.5px; line-height: 1.8;
  }
  .doc { max-width: 820px; margin: 0 auto; padding: 8px 4px; }
  h1 { font-size: 22px; margin: 0 0 14px; color: #5b3df5;
    border-bottom: 2px solid #5b3df5; padding-bottom: 8px; }
  h2 { font-size: 16px; margin: 22px 0 10px; color: #5b3df5; }
  h3 { font-size: 14px; margin: 16px 0 8px; color: #333; }
  p { margin: 0 0 10px; }
  ul, ol { margin: 0 0 10px; padding-left: 22px; }
  li { margin: 0 0 5px; }
  strong { color: #5b3df5; font-weight: 600; }
  blockquote { margin: 12px 0; padding: 8px 14px; border-left: 3px solid #5b3df5;
    background: #f4f1ff; color: #555; }
  img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  .chart-wrap svg { width: 100%; height: auto; max-width: 680px;
    display: block; margin: 0 auto; }
  hr { border: none; border-top: 1px solid #eee; margin: 16px 0; }
  a { color: #5b3df5; }
  @page { margin: 16mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

export interface PrintDocumentOptions {
  /** 打印窗口标题（同时作为浏览器标签名） */
  title: string;
  /** 要打印的内容 HTML（文本报告用 mdToHtml；图片用 <img>；星盘用内联 <svg>） */
  html: string;
}

/**
 * 打开独立打印窗口并触发打印（用户可在对话框「另存为 PDF」）。
 *
 * @param opts.title 文档标题
 * @param opts.html  已渲染好的内容 HTML
 */
export function printDocument(opts: PrintDocumentOptions): void {
  const win = window.open('', '_blank', 'width=900,height=1100,menubar=no,toolbar=no');
  if (!win) {
    // 弹窗被拦截（多数浏览器需用户手势；此处已在点击回调内，通常是被插件拦截）
    window.alert('导出 PDF 需要允许浏览器弹出窗口，请在地址栏右侧允许后重试。');
    return;
  }
  const doc = win.document;
  doc.open();
  doc.write(
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />' +
      `<title>${escapeHtml(opts.title)}</title><style>${PRINT_CSS}</style></head>` +
      `<body><div class="doc">${opts.html}</div>` +
      '<scr' + 'ipt>window.onload=function(){setTimeout(function(){try{window.print();}catch(e){}},300);};' +
      'window.onafterprint=function(){window.close();};</scr' + 'ipt></body></html>',
  );
  doc.close();
}
