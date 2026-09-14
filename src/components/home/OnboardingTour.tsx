'use client';

import { useState, useEffect } from 'react';
import { ONBOARD_STEPS, hasOnboarded, markOnboarded } from '@/lib/onboarding';

/**
 * 新手引导浮层（onboarding）
 * 首次访问展示，讲清 5 步；完成/跳过写入 om_onboarded 不再弹出。
 */
export default function OnboardingTour() {
  const [show, setShow] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setShow(!hasOnboarded());
  }, []);

  const finish = () => {
    markOnboarded();
    setShow(false);
  };

  if (!show) return null;

  const step = ONBOARD_STEPS[idx];
  const isLast = idx === ONBOARD_STEPS.length - 1;
  const isFirst = idx === 0;

  return (
    <div className="onboard-mask" onClick={isLast ? finish : undefined}>
      <div className="onboard-card" onClick={(e) => e.stopPropagation()}>
        <div className="onboard-progress">
          {ONBOARD_STEPS.map((_, i) => (
            <span key={i} className={'onboard-dot' + (i === idx ? ' active' : '') + (i < idx ? ' done' : '')} />
          ))}
        </div>

        <div className="onboard-icon">{step.icon}</div>
        <div className="onboard-title">{step.title}</div>
        <div className="onboard-desc">{step.desc}</div>
        {step.hint && <div className="onboard-hint">💡 {step.hint}</div>}

        <div className="onboard-actions">
          <button className="onboard-skip" onClick={finish}>跳过引导</button>
          <div className="onboard-nav">
            {!isFirst && (
              <button className="onboard-prev" onClick={() => setIdx((i) => Math.max(0, i - 1))}>上一步</button>
            )}
            {isLast ? (
              <button className="onboard-next primary" onClick={finish}>开始探索 ✨</button>
            ) : (
              <button className="onboard-next primary" onClick={() => setIdx((i) => Math.min(ONBOARD_STEPS.length - 1, i + 1))}>下一步</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
