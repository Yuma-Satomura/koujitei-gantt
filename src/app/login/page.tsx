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

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await checkPendingUser(email)
    if (result.found) {
      setPending({ name: result.name!, role: result.role!, color: result.color! })
      setStep('setup')
    } else {
      setStep('login')
    }
    setLoading(false)
  }

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
    const { data: kUser } = await supabase.from('koujitei_users').select('role').eq('id', user.id).single()
    router.push(kUser?.role === 'admin' ? '/admin' : '/member')
    router.refresh()
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== passwordConfirm) { setError('パスワードが一致しません'); return }
    if (password.length < 6) { setError('パスワードは6文字以上で設定してください'); return }
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
    await supabase.from('koujitei_pending_users').delete().eq('email', email)
    router.push(pending!.role === 'admin' ? '/admin' : '/member')
    router.refresh()
  }

  function goBack() {
    setStep('email'); setPassword(''); setPasswordConfirm(''); setError(null); setPending(null)
  }

  const inputStyle = { background: '#f0f2f5', border: '1px solid #dde1e7', color: '#1a1d23' }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f6f9' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-xs font-bold tracking-widest mb-2" style={{ color: '#4a7fff' }}>
            KOUJITEI SYSTEM
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1d23' }}>工事部 工程表</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            {step === 'email' && 'メールアドレスを入力してください'}
            {step === 'login' && 'パスワードを入力してください'}
            {step === 'setup' && `${pending?.name} さん、パスワードを設定してください`}
          </p>
        </div>

        <div className="rounded-xl p-6 space-y-4" style={{ background: '#ffffff', border: '1px solid #dde1e7', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(231,76,60,.08)', color: '#c0392b', border: '1px solid rgba(231,76,60,.2)' }}>
              {error}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>メールアドレス</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}
                  placeholder="example@company.com" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: '#4a7fff', color: '#fff' }}>
                {loading ? '確認中...' : '次へ'}
              </button>
            </form>
          )}

          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="rounded-lg px-3 py-2 text-sm flex items-center gap-2"
                style={{ background: '#f0f2f5', border: '1px solid #dde1e7' }}>
                <span style={{ color: '#9ca3af' }}>✉</span>
                <span style={{ color: '#6b7280' }}>{email}</span>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>パスワード</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}
                  placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: '#4a7fff', color: '#fff' }}>
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>
              <button type="button" onClick={goBack} className="w-full text-xs py-1" style={{ color: '#9ca3af' }}>
                ← メールアドレスに戻る
              </button>
            </form>
          )}

          {step === 'setup' && (
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(74,127,255,.06)', border: '1px solid rgba(74,127,255,.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: pending?.color }} />
                  <span className="font-bold text-xs" style={{ color: '#1a1d23' }}>{pending?.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded ml-auto"
                    style={{ background: pending?.role === 'admin' ? 'rgba(46,204,113,.12)' : 'rgba(74,127,255,.12)',
                             color: pending?.role === 'admin' ? '#27ae60' : '#4a7fff' }}>
                    {pending?.role}
                  </span>
                </div>
                <div className="text-xs" style={{ color: '#6b7280' }}>{email}</div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>パスワード（6文字以上）</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoFocus
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>パスワード（確認）</label>
                <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: '#4a7fff', color: '#fff' }}>
                {loading ? '登録中...' : '登録してログイン'}
              </button>
              <button type="button" onClick={goBack} className="w-full text-xs py-1" style={{ color: '#9ca3af' }}>
                ← メールアドレスに戻る
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
