'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login')
      else setChecking(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('パスワードが一致しません'); return }
    if (password.length < 8) { setError('パスワードは8文字以上で設定してください'); return }
    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: kUser } = await supabase
      .from('koujitei_users')
      .select('role')
      .eq('id', user!.id)
      .single()

    router.push(kUser?.role === 'admin' ? '/admin' : '/member')
  }

  if (checking) return null

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
            初回ログイン — パスワードを設定してください
          </p>
        </div>

        <div
          className="rounded-xl p-6 space-y-4"
          style={{ background: '#ffffff', border: '1px solid #dde1e7', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          {error && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: 'rgba(231,76,60,.08)', color: '#c0392b', border: '1px solid rgba(231,76,60,.2)' }}
            >
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
                パスワード（8文字以上）
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required minLength={8} autoFocus
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle} placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
                パスワード（確認）
              </label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle} placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
              style={{ background: '#4a7fff', color: '#fff' }}
            >
              {loading ? '設定中...' : 'パスワードを設定してログイン'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
