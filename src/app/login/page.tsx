'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f0f' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-xs font-bold tracking-widest mb-2" style={{ color: '#4a7fff' }}>
            KOUJITEI SYSTEM
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#e8e6e0' }}>工事部 工程表</h1>
          <p className="text-sm mt-1" style={{ color: '#888' }}>ログイン</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-xl p-6 space-y-4"
          style={{ background: '#161616', border: '1px solid #2a2a2a' }}
        >
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(231,76,60,.12)', color: '#e74c3c', border: '1px solid rgba(231,76,60,.2)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: '#1e1e1e',
                border: '1px solid #333',
                color: '#e8e6e0',
              }}
              placeholder="example@company.com"
            />
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
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{
                background: '#1e1e1e',
                border: '1px solid #333',
                color: '#e8e6e0',
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
            style={{ background: '#4a7fff', color: '#fff' }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
