'use client';

import '@/styles/healing.scss';
import SectionIcon from '@/components/ui/SectionIcon';
import SutraSection from '@/components/healing/SutraSection';
import { RealmPanel } from '@/components/healing/RealmPanel';
import { XuanChat } from '@/components/healing/XuanChat';
import { useHealingSave } from '@/hooks/useHealingSave';

// 经典 · 读经（从疗愈心斋拆出的独立模块）
export default function ClassicsPage() {
  const h = useHealingSave();

  return (
    <div className="page active" id="page-classics">
      <div className="page-header">
        <div>
          <div className="page-title"><SectionIcon name="book" className="page-title-icon" />经典 · 读经</div>
          <div className="page-subtitle">古圣贤之言，读一句，照见一分 · 今晚，让文字接住你</div>
        </div>
      </div>

      {/* 首屏两栏：修行面板 + 小玄对话（与疗愈一致） */}
      <div className="healing-section-title"><div className="realm-greet"><SectionIcon name="sparkles" /> 今晚，留一处安静给自己</div></div>
      <div className="xuan-chat-zone">
        <div className="xuan-side">
          <RealmPanel
            save={h.save}
            onQuestClick={(id) => {
              if (id === 'community') { h.showXpToast('🪷 同修圈正在搭建，很快就能与千万同修共行了', 'gold'); return; }
              if (h.save.quests[id]) { h.showXpToast('✅ 今日已完成，明天再来'); return; }
              h.showXpToast('把对应的小功课做完，就会自动完成哦');
            }}
          />
        </div>
        <XuanChat
          save={h.save}
          onAddXp={h.addXp}
          onChatCount={h.handleChatCount}
          module="classics"
          title="小玄伴读"
          status="在线 · 与经典同坐片刻"
          greeting="今晚想读哪一句照亮你？我在这里，陪你把古圣贤的话，读进此刻的生活。"
          suggestions={[
            { q: '最近总睡不好，有适合的句子吗' },
            { q: '心里堵得慌，读什么能松一点' },
            { q: '怎么把一句经文真的用起来' },
            { q: '今天有点丧，给我一句撑住的话' },
          ]}
          placeholder="和经典说说话，或小玄陪你聊聊这句…"
          belowText="与小玄每聊一句，道行 +2 · 读经也是修行"
        />
      </div>

      <SutraSection />
    </div>
  );
}
