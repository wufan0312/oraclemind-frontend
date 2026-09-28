'use client';

import SectionIcon from '@/components/ui/SectionIcon';
import { REALM_LEVELS, DAILY_QUESTS, type HealingSave } from '@/data/healingData';

// ============================================================================
// 修行面板（三版块共享）：道行 / 境界 / 今日修行任务 / 同修圈入口
// ============================================================================
export function RealmPanel({ save, onQuestClick }: {
  save: HealingSave;
  onQuestClick: (id: string) => void;
}) {
  let idx = 0;
  for (let i = 0; i < REALM_LEVELS.length; i++) if (save.xp >= REALM_LEVELS[i].min) idx = i;
  const lv = REALM_LEVELS[idx];
  const next = REALM_LEVELS[idx + 1];
  const pct = next ? Math.min(100, Math.round(((save.xp - lv.min) / (next.min - lv.min)) * 100)) : 100;

  return (
    <>
      <div className="xuan-realm-card" id="xuanRealmCard">
        <div className="realm-name-row">
          <div className="realm-avatar" id="realmAvatar">旅</div>
          <div className="realm-user-info">
            <div className="realm-name" id="realmName">旅人</div>
            <div className="realm-verse" id="realmVerse">{lv.icon} {lv.name} · {lv.verse}</div>
          </div>
        </div>
        <div className="realm-xp-block">
          <div className="realm-xp-head">
            <span className="realm-xp-label">道行</span>
            <span className="realm-xp-num" id="realmXpText">
              {next ? `${save.xp} / ${next.min}` : `${save.xp} · 已悟道`}
            </span>
            <span className="realm-xp-pct" id="realmXpPct">{pct}%</span>
          </div>
          <div className="realm-xp-bar">
            <div className="realm-xp-fill" id="realmXpFill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="realm-quests">
          <div className="realm-quests-title"><SectionIcon name="footprint" /> 今日修行 · 积道行</div>
          <div className="realm-quest-list" id="realmQuestList">
            {DAILY_QUESTS.map(q => {
              const done = !!save.quests[q.id];
              const progress = q.target
                ? <span className="quest-progress">{Math.min(q.target, save.chatCount)}/{q.target}</span>
                : null;
              const state = done ? '✅' : (q.id === 'breath' ? '▶' : '⏳');
              return (
                <div
                  key={q.id}
                  className={'realm-quest-item' + (done ? ' done' : '')}
                  onClick={() => onQuestClick(q.id)}
                >
                  <span className="quest-icon">{q.icon}</span>
                  <div className="quest-info">
                    <div className="quest-label">{q.label}<span className="quest-xp">+{q.xp}</span></div>
                    <div className="quest-desc">{q.desc}{progress}</div>
                  </div>
                  <span className="quest-state">{state}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 同修圈入口 */}
      <div className="xuan-community-card">
        <div className="xuan-community-head" onClick={() => onQuestClick('community')}>
          <div className="xuan-community-icon">🪷</div>
          <div className="xuan-community-main">
            <div className="xuan-community-title"><SectionIcon name="users" /> 心斋 · 同修圈</div>
            <div className="xuan-community-desc">修行路上，与同修共行</div>
          </div>
          <div className="xuan-community-arrow">›</div>
        </div>
        <div className="xuan-community-tags">
          {['今日同修', '共修小组', '悟道墙'].map(t => (
            <span key={t} className="xuan-community-tag" onClick={() => onQuestClick('community')}>🫧 {t}</span>
          ))}
        </div>
      </div>
    </>
  );
}
