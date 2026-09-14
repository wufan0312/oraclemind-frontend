/**
 * 稳定字符串哈希（djb2）。
 * 把任意字符串映射为可复现的无符号 32 位整数，
 * 用于梦境索引、图像种子、缓存键等「同输入必得同输出」的场景。
 *
 * 全站此前散落三份哈希实现（dream/page、DreamVision、cacheKey），
 * 其中 DreamVision 还是另一套算法，本次统一收敛到此文件。
 */
export function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 短哈希串（base36），用于缓存键命名空间 */
export function hashStrShort(s: string): string {
  return hashStr(s).toString(36);
}
