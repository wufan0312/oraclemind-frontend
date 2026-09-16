'use client';

import { useState } from 'react';
import { eraseAllData } from '@/lib/eraseData';

/**
 * 隐私政策页 —— PIPL 合规告知（收集范围 / 用途 / 存储 / 权利 / 保留期限 / 未成年 / 免责）。
 * 同时提供「删除我的全部数据」入口，访客与登录用户均可直接行使删除权。
 */
export default function PrivacyPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const onErase = async () => {
    if (
      !window.confirm(
        '确定删除你在玄镜的全部数据？\n将清除本机与云端存档（含占卜/解梦/聊天/成长记录）及后端出生信息，且不可恢复。',
      )
    ) {
      return;
    }
    try {
      await eraseAllData();
      setMsg('已全部删除你的本地与云端数据。');
    } catch {
      setMsg('删除遇到错误，请稍后重试。');
    }
  };

  return (
    <main className="privacy-page">
      <div className="privacy-inner">
        <h1>隐私政策</h1>
        <p className="privacy-updated">最后更新：2026-09-15</p>

        <h2>一、我们收集什么</h2>
        <ul>
          <li>出生信息：出生日期、时辰、性别、姓名（用于八字、占星、数字命理等排盘推算）。</li>
          <li>使用记录：你的占卜、解梦、塔罗、聊天与日记内容（用于在本机留存与跨设备恢复）。</li>
          <li>可选账号信息：如你注册登录，仅用于标识与同步，不含支付敏感信息。</li>
        </ul>

        <h2>二、如何使用</h2>
        <p>
          上述信息仅用于生成你主动请求的文化解读与心理自省内容，不用于任何自动化决策，不对外分享或出售。
        </p>

        <h2>三、如何存储</h2>
        <ul>
          <li>访客模式：数据仅保存在你当前浏览器本机，不会上传。</li>
          <li>登录模式：出生信息由后端加密存储；其余业务数据上云同步，便于换设备恢复。</li>
        </ul>

        <h2>四、你的权利</h2>
        <ul>
          <li>访问与更正：在「个人中心」查看与修改出生信息。</li>
          <li>删除：随时删除全部数据（见下方按钮，或「个人中心 → 数据与引导」）。</li>
          <li>撤回同意：清除本地数据即视为撤回；服务端 Report 等独立表可联系平台删除。</li>
        </ul>

        <h2>五、保留期限</h2>
        <p>
          在你主动删除前，数据长期留存以保障跨设备恢复能力；一旦你发起删除，我们将立即清除本地与云端副本。
        </p>

        <h2>六、未成年人与免责</h2>
        <p>
          本平台内容仅供娱乐与文化参考，不构成任何医疗、法律、投资或人生决策依据，不适用于 18 岁以下用户。
          若你已提供信息，可随时通过上述入口删除。
        </p>

        <h2>删除你的数据</h2>
        <p>你有权随时删除自己的全部数据。点击下方按钮即可清除本机与云端存档及后端出生信息：</p>
        <button type="button" className="privacy-erase-btn" onClick={onErase}>
          删除我的全部数据
        </button>
        {msg && <p className="privacy-msg">{msg}</p>}
      </div>
    </main>
  );
}
