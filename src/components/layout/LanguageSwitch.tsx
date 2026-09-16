'use client';

import { useI18n } from '@/lib/i18n';

/**
 * 语言切换 —— EN / 中文。
 * 挂在 TopNav 右侧，随 AppShell 全站可见。
 */
export default function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button
        type="button"
        className={'lang-btn' + (locale === 'en' ? ' active' : '')}
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >EN</button>
      <button
        type="button"
        className={'lang-btn' + (locale === 'zh' ? ' active' : '')}
        aria-pressed={locale === 'zh'}
        onClick={() => setLocale('zh')}
      >中文</button>
    </div>
  );
}
