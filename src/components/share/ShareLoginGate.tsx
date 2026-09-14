'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/components/ui/Toast';

interface ShareLoginGateProps {
  /** 登录/注册成功后的回调（用于在分享弹窗内即时刷新为已登录态并展示内容） */
  onSuccess?: () => void;
  /** 场景文案，如「保存 / 分享」，用于标题与提示 */
  context?: string;
}

/**
 * 分享登录守卫 —— 未登录用户点击「保存/分享」时，在分享弹窗内原地展示的
 * 登录 / 注册表单（复用全局 AuthContext.login / register）。
 *
 * 登录成功后通过 onSuccess 让父级弹窗立刻切到「已登录内容态」，无需跳转离开当前页，
 * 避免丢失已经生成好的占卜/解梦结果。
 */
export default function ShareLoginGate({ onSuccess, context = '保存 / 分享' }: ShareLoginGateProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
        showToast('登录成功', 'success');
      } else {
        await register(username.trim(), password, email.trim() || undefined);
        showToast('注册成功，已自动登录', 'success');
      }
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
      <div style={{ fontSize: '34px', marginBottom: '10px' }}>🔒</div>
      <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
        登录后{context}
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 18px' }}>
        登录账号即可保存你的专属分享内容，下次进入直接查看，无需重复生成。
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
        <input
          className="form-input field-pill mb-0"
          placeholder="用户名（至少 2 位）"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={2}
          maxLength={64}
          required
          autoComplete="username"
        />
        <input
          className="form-input field-pill mb-0"
          type="password"
          placeholder="密码（至少 6 位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          maxLength={128}
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {mode === 'register' && (
          <input
            className="form-input field-pill mb-0"
            type="email"
            placeholder="邮箱（选填，可用于找回密码）"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            autoComplete="email"
          />
        )}
        {error && (
          <div style={{ color: '#ff6b6b', fontSize: '13px', textAlign: 'center' }}>{error}</div>
        )}
        <button
          type="submit"
          className="modal-btn"
          disabled={loading}
          style={{ background: 'linear-gradient(135deg, #7c5cff 0%, #5b3fff 100%)', color: '#fff', marginTop: '2px' }}
        >
          {loading ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
      </form>

      <div style={{ marginTop: '14px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
        {mode === 'login' ? '还没有账号？' : '已有账号？'}
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: 0, fontSize: '13px' }}
        >
          {mode === 'login' ? '立即注册' : '去登录'}
        </button>
        <span style={{ opacity: 0.4 }}>·</span>
        <Link href="/login" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontSize: '13px' }}>
          单独打开登录页
        </Link>
      </div>
    </div>
  );
}
