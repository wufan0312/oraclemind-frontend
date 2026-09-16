'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-links">
          <Link href="/privacy">{t('footer.privacy')}</Link>
          <Link href="/profile">{t('footer.data')}</Link>
        </div>
        <p className="footer-note">{t('footer.note')}</p>
      </div>
    </footer>
  );
}
