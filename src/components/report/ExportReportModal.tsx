'use client';

import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { mdToHtml } from '@/lib/markdown';
import { showToast } from '@/components/ui/Toast';

export interface ExportReportModalProps {
  open: boolean;
  onClose: () => void;
  /** 报告标题（用于文件名与离屏渲染容器） */
  title?: string;
  /** 已渲染好的报告全文 Markdown（四种格式共用同一份内容） */
  markdown: string;
}

/** 纯文本 → Canvas 长图 PNG（零第三方库） */
function exportTextPng(title: string, body: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const lines = body.split('\n');
      const W = 900;
      const PAD = 48;
      const LH = 30;
      const TITLE_LH = 42;
      const measure = document.createElement('canvas').getContext('2d');
      if (!measure) {
        resolve(false);
        return;
      }
      measure.font = '16px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      const wrapped: { text: string; bold: boolean }[] = [];
      const maxW = W - PAD * 2;
      for (const raw of lines) {
        const isHead = raw.startsWith('#');
        const text = raw.replace(/^#+\s*/, '').replace(/\*\*/g, '');
        if (!text.trim()) {
          wrapped.push({ text: '', bold: false });
          continue;
        }
        let cur = '';
        for (const ch of text) {
          if (measure.measureText(cur + ch).width > maxW) {
            wrapped.push({ text: cur, bold: isHead });
            cur = ch;
          } else {
            cur += ch;
          }
        }
        if (cur) wrapped.push({ text: cur, bold: isHead });
      }
      const H = PAD * 2 + TITLE_LH + 20 + wrapped.length * LH + 60;
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(false);
        return;
      }
      ctx.scale(scale, scale);
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#fbfaff');
      grad.addColorStop(1, '#f4f1ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7c5cff';
      ctx.fillRect(0, 0, W, 6);
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 28px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(title.slice(0, 30), PAD, PAD + 30);
      ctx.strokeStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.moveTo(PAD, PAD + TITLE_LH + 6);
      ctx.lineTo(W - PAD, PAD + TITLE_LH + 6);
      ctx.stroke();
      let y = PAD + TITLE_LH + 20 + LH;
      for (const ln of wrapped) {
        if (ln.bold) {
          ctx.fillStyle = '#7c5cff';
          ctx.font = 'bold 19px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        } else {
          ctx.fillStyle = '#374151';
          ctx.font = '16px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        }
        ctx.fillText(ln.text, PAD, y);
        y += LH;
      }
      ctx.fillStyle = '#9ca3af';
      ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('玄镜 OracleMind · 多术数交叉验证 · 仅供娱乐与自我觉察参考', PAD, H - 24);
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.slice(0, 20)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

export default function ExportReportModal({
  open,
  onClose,
  title = '综合自我觉察报告',
  markdown,
}: ExportReportModalProps) {
  const pdfRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const close = () => {
    if (!exporting) onClose();
  };

  /** Markdown：直接打包成 .md Blob 下载 */
  const handleMarkdown = () => {
    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('已下载 Markdown 文件', 'success');
      onClose();
    } catch {
      showToast('下载失败，请稍后重试', 'error');
    }
  };

  /** Word：HTML + Word MIME，生成 .doc 下载（无需 docx 库） */
  const handleWord = () => {
    try {
      const html = mdToHtml(markdown);
      const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title.replace(/[<>&]/g, '')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.8;color:#1f2937}
h1{font-size:22px;color:#7c5cff;border-bottom:2px solid #ede9fe;padding-bottom:8px}
h2{font-size:17px;color:#5b4bd6;margin-top:18px}
h3{font-size:15px;color:#374151}
li{margin:4px 0}
blockquote{color:#6b7280;border-left:3px solid #ddd6fe;padding-left:10px;margin:12px 0}
</style></head><body>${html}</body></html>`;
      const blob = new Blob(['﻿', doc], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.slice(0, 20)}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('已下载 Word 文档', 'success');
      onClose();
    } catch {
      showToast('下载失败，请稍后重试', 'error');
    }
  };

  /** PNG 长图：复用 Canvas 绘制（零依赖） */
  const handlePng = async () => {
    const ok = await exportTextPng(title, markdown);
    showToast(ok ? '已下载 PNG 长图' : '图片生成失败，请重试', ok ? 'success' : 'error');
    onClose();
  };

  /** PDF：html2canvas 截图离屏渲染容器 + jsPDF 直接生成并下载（不走打印窗口） */
  const handlePdf = async () => {
    if (!pdfRef.current) {
      showToast('PDF 内容未就绪', 'error');
      return;
    }
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const node = pdfRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`${title}.pdf`);
      showToast('已下载 PDF 文件', 'success');
      onClose();
    } catch {
      showToast('PDF 生成失败，请重试', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} variant="share" icon="⬇️" title="导出报告">
      <div className="share-options">
        <div className="share-option" role="button" tabIndex={0} onClick={handleMarkdown}>
          <span className="share-icon">📄</span>
          <span className="share-label">Markdown</span>
        </div>
        <div className="share-option" role="button" tabIndex={0} onClick={handleWord}>
          <span className="share-icon">📝</span>
          <span className="share-label">Word</span>
        </div>
        <div className="share-option" role="button" tabIndex={0} onClick={() => void handlePng()}>
          <span className="share-icon">🖼️</span>
          <span className="share-label">PNG 长图</span>
        </div>
        <div className="share-option" role="button" tabIndex={0} onClick={() => void handlePdf()}>
          <span className="share-icon">📑</span>
          <span className="share-label">{exporting ? '生成中…' : 'PDF'}</span>
        </div>
      </div>
      <div className="share-hint">选择格式后将直接下载到本地；PDF 由浏览器本地生成。</div>

      {/* 离屏渲染容器：PDF 截图的源（html2canvas 复制节点渲染，不依赖是否在视口内） */}
      <div
        ref={pdfRef}
        className="pdf-render"
        aria-hidden
        style={{
          position: 'fixed',
          left: '-10000px',
          top: '0',
          width: '794px',
          background: '#ffffff',
          padding: '32px 28px',
          fontFamily:
            '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif',
          fontSize: '13.5px',
          lineHeight: 1.8,
          zIndex: -1,
          pointerEvents: 'none',
        }}
        dangerouslySetInnerHTML={{ __html: mdToHtml(markdown || '') }}
      />
    </Modal>
  );
}
