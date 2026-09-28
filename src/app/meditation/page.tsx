'use client';

import '@/styles/healing.scss';
import SectionIcon from '@/components/ui/SectionIcon';
import MindfulnessSection, { MeditationIntro, MeditationTimer, MindfulPractices, BreathIntro } from '@/components/healing/MindfulnessSection';
import CultivationCalendar from '@/components/healing/CultivationCalendar';
import { RealmPanel } from '@/components/healing/RealmPanel';
import { XuanChat } from '@/components/healing/XuanChat';
import { useHealingSave } from '@/hooks/useHealingSave';

// 静心冥想（从疗愈心斋拆出的独立模块）
export default function MeditationPage() {
  const { handleMeditateDone, handleBreathDone, save, toast, toastType, levelup, addXp, handleChatCount, showXpToast } = useHealingSave();

  const startMeditation = () => {
    const el = document.getElementById('meditation-timer');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="page active" id="page-meditation">
      <div className="page-header">
        <div>
          <div className="page-title"><SectionIcon name="flower" className="page-title-icon" />静心冥想</div>
          <div className="page-subtitle">引导冥想 · 助眠声景 · 让呼吸带你回到此刻</div>
        </div>
      </div>

      {/* 首屏两栏：修行面板 + 小玄对话（与疗愈一致） */}
      <div className="healing-section-title"><div className="realm-greet"><SectionIcon name="sparkles" /> 此刻，给自己一段安静</div></div>
      <div className="xuan-chat-zone">
        <div className="xuan-side">
          <RealmPanel
            save={save}
            onQuestClick={(id) => {
              if (id === 'community') { showXpToast('🪷 同修圈正在搭建，很快就能与千万同修共行了', 'gold'); return; }
              if (save.quests[id]) { showXpToast('✅ 今日已完成，明天再来'); return; }
              showXpToast('把对应的小功课做完，就会自动完成哦');
            }}
          />
        </div>
        <XuanChat
          save={save}
          onAddXp={addXp}
          onChatCount={handleChatCount}
          module="meditation"
          title="小玄静坐"
          status="在线 · 一起回到呼吸"
          greeting="坐下来，我们一起回到呼吸。此刻有什么念头飘过，都可以说给我听。"
          suggestions={[
            { q: '最近总是焦虑，冥想能帮上忙吗' },
            { q: '躺下就睡不着，怎么办' },
            { q: '呼吸总是不稳，怎么练' },
            { q: '每天几分钟比较合适' },
          ]}
          placeholder="说说此刻的状态，或小玄陪你静下来…"
          belowText="与小玄每聊一句，道行 +2 · 静心也是修行"
        />
      </div>

      <MeditationIntro />
      <BreathIntro onDone={handleBreathDone} />
      <MindfulnessSection onSessionDone={handleMeditateDone} />
      <MeditationTimer onSessionDone={handleMeditateDone} />
      <MindfulPractices />
      <CultivationCalendar
        dates={save.meditationDates || []}
        title="静坐足迹 · 近 84 天"
        emptyHint="每次静坐，点亮一格 🌿"
        onStart={startMeditation}
        startLabel="🌬️ 去静坐"
      />
      <div className={'xp-toast' + (toast ? ' show' : '') + (toastType ? ' ' + toastType : '')}>{toast}</div>
      <div className={'levelup-banner' + (levelup ? ' show' : '')}>
        {levelup && (
          <>
            <div className="levelup-icon">{levelup.icon}</div>
            <div className="levelup-title">🎉 恭喜晋升「{levelup.name}」境界</div>
            <div className="levelup-verse">{levelup.verse}</div>
          </>
        )}
      </div>
    </div>
  );
}
