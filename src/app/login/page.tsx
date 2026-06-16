'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { checkPendingUser } from '@/app/actions/checkPendingUser'

type Step = 'email' | 'login' | 'setup'

interface PendingUser {
  name: string
  role: string
  color: string
}

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [pending, setPending] = useState<PendingUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: メールアドレス確認（Server Action 経由でサーバー側のみ照合）
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await checkPendingUser(email)

    if (result.found) {
      setPending({ name: result.name!, role: result.role!, color: result.color! })
      setStep('setup')
    } else {
      // pending になければ既存ユーザーとしてパスワードログインへ
      setStep('login')
    }
    setLoading(false)
  }

  // Step 2a: 既存ユーザーのログイン
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: kUser } = await supabase
      .from('koujitei_users')
      .select('role')
      .eq('id', user.id)
      .single()

    router.push(kUser?.role === 'admin' ? '/admin' : '/member')
    router.refresh()
  }

  // Step 2b: 初回登録（パスワード設定 + ユーザー作成）
  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== passwordConfirm) {
      setError('パスワードが一致しません')
      return
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で設定してください')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'アカウント作成に失敗しました')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('koujitei_users').insert({
      id: data.user.id,
      name: pending!.name,
      role: pending!.role,
      color: pending!.color,
    })
    if (insertError) {
      setError('プロフィールの保存に失敗しました: ' + insertError.message)
      setLoading(false)
      return
    }

    // pending テーブルから削除
    await supabase.from('koujitei_pending_users').delete().eq('email', email)

    router.push(pending!.role === 'admin' ? '/admin' : '/member')
    router.refresh()
  }

  function goBack() {
    setStep('email')
    setPassword('')
    setPasswordConfirm('')
    setError(null)
    setPending(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f0f' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-xs font-bold tracking-widest mb-2" style={{ color: '#4a7fff' }}>
            KOUJITEI SYSTEM
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#e8e6e0' }}>工事部 工程表</h1>
          <p className="text-sm mt-1" style={{ color: '#888' }}>
            {step === 'email' && 'メールアドレスを入力してください'}
            {step === 'login' && 'パスワードを入力してください'}
            {step === 'setup' && `${pending?.name} さん、パスワードを設定してください`}
          </p>
        </div>

        <div
          className="rounded-xl p-6 space-y-4"
          style={{ background: '#161616', border: '1px solid #2a2a2a' }}
        >
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(231,76,60,.12)', color: '#e74c3c', border: '1px solid rgba(231,76,60,.2)' }}>
              {error}
            </div>
          )}

          {/* Step 1: メールアドレス */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={{ background: '#1e1e1e', border: '1px solid #333', color: '#e8e6e0' }}
                  placeholder="example@company.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: '#4a7fff', color: '#fff' }}
              >
                {loading ? '確認中...' : '次へ'}
              </button>
            </form>
          )}

          {/* Step 2a: ログイン */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div
                className="rounded-lg px-3 py-2 text-sm flex items-center gap-2"
                style={{ background: '#1e1e1e', border: '1px solid #2a2a2a' }}
              >
                <span style={{ color: '#555' }}>✉</span>
                <span style={{ color: '#888' }}>{email}</span>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>
                  パスワード
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={{ background: '#1e1e1e', border: '1px solid #333', color: '#e8e6e0' }}
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: '#4a7fff', color: '#fff' }}
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>
              <button type="button" onClick={goBack} className="w-full text-xs py-1" style={{ color: '#555' }}>
                ← メールアドレスに戻る
              </button>
            </form>
          )}

          {/* Step 2b: 初回パスワード設定 */}
          {step === 'setup' && (
            <form onSubmit={handleSetup} className="space-y-4">
              <div
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(74,127,255,.08)', border: '1px solid rgba(74,127,255,.2)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: pending?.color }} />
                  <span className="font-bold text-xs" style={{ color: '#e8e6e0' }}>{pending?.name}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded ml-auto"
                    style={{
                      background: pending?.role === 'admin' ? 'rgba(46,204,113,.15)' : 'rgba(74,127,255,.15)',
                      color: pending?.role === 'admin' ? '#2ecc71' : '#4a7fff',
                    }}
                  >
                    {pending?.role}
                  </span>
                </div>
                <div className="text-xs" style={{ color: '#888' }}>{email}</div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>
                  パスワード（6文字以上）
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={{ background: '#1e1e1e', border: '1px solid #333', color: '#e8e6e0' }}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>
                  パスワード（確認）
                </label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  required
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={{ background: '#1e1e1e', border: '1px solid #333', color: '#e8e6e0' }}
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: '#4a7fff', color: '#fff' }}
              >
                {loading ? '登録中...' : '登録してログイン'}
              </button>
              <button type="button" onClick={goBack} className="w-full text-xs py-1" style={{ color: '#555' }}>
                ← メールアドレスに戻る
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
