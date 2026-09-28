/**
 * 玄镜 frontend —— Harness Boundary: XSS 转义 / HTML 净化
 * 落点：oraclemind/src/lib/xss.ts
 *
 * 说明：src/lib/markdown.ts 的 mdToHtml 已经对 `& < >` 做转义、并只重建白名单标签
 * （strong/em/code/table/ul/ol/li/blockquote/p/h），输出直接进 dangerouslySetInnerHTML
 * 不会放行原始 HTML。本模块作为「第二道防线」与统一入口加固：
 *   - escapeHtml：对不走 markdown 渲染、直接落 dangerouslySetInnerHTML 的纯文本兜底转义；
 *   - sanitizeHtml：剥离 <script>/on* 事件/javascript: 协议/非白名单标签。
 *
 * 用法：任何要喂给 dangerouslySetInnerHTML 的内容，先过 sanitizeHtml(mdToHtml(x)) 或
 * escapeHtml(x)。生产建议：本项目内容源为自有 AI 服务，轻量净化足够；若后续放开 UGC
 * 或第三方内容，请改用 DOMPurify（npm i dompurify）做标准净化。
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

export function escapeHtml(input: string): string {
  if (typeof input !== "string") return "";
  return input.replace(/[&<>"'`=/]/g, (ch) => HTML_ENTITY_MAP[ch] ?? ch);
}

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "em", "b", "i", "u", "code", "pre", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "a", "span", "div",
  "hr", "table", "thead", "tbody", "tr", "td", "th",
]);
const ALLOWED_ATTRS = new Set(["href", "title", "class"]);

export function sanitizeHtml(html: string): string {
  if (typeof html !== "string") return "";
  // 1) 直接剥掉危险标签（含成对与自闭合）
  let out = html.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/(?:\1)>/gi, "");
  out = out.replace(/<(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, "");
  // 2) 去掉所有 on* 事件属性 与 javascript: 协议
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
  // 3) 非白名单标签丢弃；白名单标签仅保留白名单属性
  out = out.replace(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (_, tag: string, attrs: string) => {
    if (!ALLOWED_TAGS.has(tag.toLowerCase())) return "";
    const kept = attrs.replace(
      /([a-zA-Z-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g,
      (am: string, an: string, av: string) => (ALLOWED_ATTRS.has(an.toLowerCase()) ? `${an}=${av}` : ""),
    );
    return `<${tag}${kept}>`;
  });
  return out;
}
