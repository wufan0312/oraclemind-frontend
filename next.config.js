import path from 'path';
import { fileURLToPath } from 'url';

// 本文件用了 ESM 语法（import/export），Node 会按 ES module 解析，
// 此时 CommonJS 的 __dirname 不存在。必须用 fileURLToPath 取当前目录，
// 否则 webpack 钩子抛 ReferenceError，dev server 启动即崩。
const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 图片来自本地 public，无需 remotePatterns
  images: {
    unoptimized: true,
  },

  // 页面禁用缓存命中（占星/卜卦结果实时性依赖此），
  // 但 /_next/static、/_next/image、public 资源必须允许缓存，
  // 否则每次导航都要重下 8MB+ 的未压缩 chunk。
  async headers() {
    const noStore = [
      { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
      { key: 'Pragma', value: 'no-cache' },
      { key: 'Expires', value: '0' },
    ];
    return [
      {
        // 负数向前断言：跳过静态资源与图片，只命中页面路由
        source: '/((?!_next/|images/|fonts/|favicon).*)',
        headers: noStore,
      },
    ];
  },

  webpack: (config, { dev, isServer, nextRuntime }) => {
    if (dev) {
      // 修 Windows 下 webpack 文件系统缓存的 EPERM：
      // 默认的 .next/cache/webpack 常因被杀软/索引服务占用而 rename 失败
      // （日志表现为 "Caching failed for pack ... EPERM"）。一旦写不进去，
      // 每次导航都近乎全量重编译（实测 horoscope 曾达 24.7s）。
      // 换独立目录 + 按 compiler 隔离，避开被锁定的旧文件。
      const scope = `${isServer ? 'server' : 'client'}-${nextRuntime || 'client'}`;
      config.cache = {
        ...config.cache,
        type: 'filesystem',
        cacheDirectory: path.join(currentDir, '.next', 'om-webpack-cache', scope),
      };
    }
    return config;
  },
};

export default nextConfig;
