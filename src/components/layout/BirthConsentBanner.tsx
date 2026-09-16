'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { storage } from '@/lib/storage';

const CONSENT_KEY = 'om_birth_consent';

/**
 * 出生信息单独同意条（PIPL：敏感个人信息需单独同意）。
 * 首次进入且本地无同意记录时展示；点击「我已知悉并继续」后写入本地标记，不再打扰。
 * 用户可随时在个人中心 / 隐私政策页删除已提供的数据并撤回。
 */
export default function BirthConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!storage.getItem(CONSENT_KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const accept = () => {
    try {
      storage.setItem(CONSENT_KEY, '1');
    } catch {
      /* 隐私模式忽略 */
    }
    setShow(false);
  };

  return (
    <div className="birth-consent" role="dialog" aria-label="出生信息使用同意">
      <div className="birth-consent-inner">
        <span className="birth-consent-text">
          玄镜会读取你填写的出生日期/时辰用于排盘推算，属敏感个人信息。我们仅在本机或加密后端保存，你可随时在「个人中心」删除。继续使用即表示同意。
        </span>
        <div className="birth-consent-actions">
          <Link href="/privacy" className="birth-consent-link">
            查看隐私政策
          </Link>
          <button type="button" className="birth-consent-btn" onClick={accept}>
            我已知悉并继续
          </button>
        </div>
      </div>
    </div>
  );
}
