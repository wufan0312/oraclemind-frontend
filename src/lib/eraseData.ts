import { storage } from '@/lib/storage';
import { removeCloudItem, CLOUD_KEYS } from '@/lib/cloudStore';
import { requestClearProfileBirth } from '@/lib/api';

/**
 * 一键删除本人在玄镜的全部数据（PIPL 删除权落地）。
 * - 本地：清空 om_ / oraclemind_ 前缀的全部 localStorage
 * - 云端：逐条删除 user_stash 中已上云的核心业务数据（轨迹 / 记录 / 聊天 / 成长 / 权益）
 * - 后端：删除已加密存储的出生信息（DELETE /api/v1/user/profile/birth）
 * 注意：服务端 Report 等独立表需联系平台删除（隐私政策已说明），本函数仅清前端可控副本。
 */
export async function eraseAllData(): Promise<void> {
  // 1. 本地
  try {
    storage.clearByPrefix('om_');
  } catch {
    /* 隐私模式等存储不可用则忽略 */
  }
  try {
    storage.clearByPrefix('oraclemind_');
  } catch {
    /* ignore */
  }

  // 2. 云端 stash（fire-and-forget，逐条删除；失败不影响本地清理）
  await Promise.all(
    CLOUD_KEYS.map((k) =>
      Promise.resolve()
        .then(() => removeCloudItem(k))
        .catch(() => undefined),
    ),
  );

  // 3. 后端出生信息
  try {
    await requestClearProfileBirth();
  } catch {
    /* 未登录 / 网络失败时忽略，本地副本已清 */
  }
}
