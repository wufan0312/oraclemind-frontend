'use client';

import '@/app/login/login.scss';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// ============================================================================
// 玄镜 OracleMind · 登录 / 注册页
// 暗色紫青主题，精灵小玄迎宾
//
// ?redirect=/xxx：由 src/middleware.ts（或 RequireAuth）重定向过来，成功后原路跳回。
// 读取放在 useEffect 而不是 useSearchParams：后者在静态预渲染时会要求 Suspense
// 包裹（Next 14 build 报错），这里纯客户端读一次即可，没有 hydration 风险。
// ============================================================================

/** 开放重定向防护：只放行站内绝对路径，挡掉 //evil.com 与 http://evil.com */
function safeRedirect(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [redirectTo, setRedirectTo] = useState('/');

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('redirect');
    setRedirectTo(safeRedirect(raw));
  }, []);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, email.trim() || undefined);
      }
      router.replace(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* 背景光晕 */}
      <div className="login-bg-glow" />

      <div className="login-card">
        {/* 精灵 + Logo */}
        <div className="login-header">
          <img src="/images/spirit_combined.png" alt="小玄" className="login-spirit" />
          <h1 className="login-title">玄镜 OracleMind</h1>
          <p className="login-subtitle">
            {mode === 'login' ? '欢迎回来，探索传统文化之美' : '开启你的文化体验之旅'}
          </p>
        </div>

        {/* 模式切换 */}
        <div className="login-tabs">
          <button
            type="button"
            className={'login-tab' + (mode === 'login' ? ' active' : '')}
            onClick={() => { setMode('login'); setError(''); }}
          >
            登录
          </button>
          <button
            type="button"
            className={'login-tab' + (mode === 'register' ? ' active' : '')}
            onClick={() => { setMode('register'); setError(''); }}
          >
            注册
          </button>
        </div>

        {/* 从受保护页被拦下来的说明 */}
        {redirectTo !== '/' && (
          <div className="login-notice">🔒 该页面需要登录后才能访问，登录成功会自动返回</div>
        )}

        {/* 表单 */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label">用户名</label>
            <input
              type="text"
              className="login-input field-pill"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名（至少 2 位）"
              minLength={2}
              maxLength={64}
              required
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="login-label">密码</label>
            <input
              type="password"
              className="login-input field-pill"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码（至少 6 位）"
              minLength={6}
              maxLength={128}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div className="login-field">
              <label className="login-label">邮箱（选填）</label>
              <input
                type="email"
                className="login-input field-pill"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="可用于找回密码"
                maxLength={255}
                autoComplete="email"
              />
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? '请稍候…' : mode === 'login' ? '✨ 登录' : '✨ 注册'}
          </button>
        </form>

        <p className="login-hint">
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            type="button"
            className="login-switch"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  );
}
