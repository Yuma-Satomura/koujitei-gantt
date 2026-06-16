'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { KoujiteiUser, Role } from '@/lib/types'

const COLORS = [
  '#4a7fff','#2ecc71','#e74c3c','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#3498db','#e91e63','#00bcd4',
  '#ff5722','#8bc34a','#ff9800','#673ab7','#607d8b',
]

interface Props { users: KoujiteiUser[] }

interface InviteForm {
  email: string
  password: string
  name: string
  role: Role
  color: string
}

export default function UsersClient({ users }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const refresh = useCallback(() => router.refresh(), [router])

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<InviteForm>({
    email: '', password: '', name: '', role: 'member', color: COLORS[0],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Supabase Auth にユーザー作成 (Admin API が必要なため、signUp を使用)
    const { data, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })
    if (authErr || !data.user) {
      setError(authErr?.message ?? 'ユーザー作成に失敗しました')
      setLoading(false)
      return
    }

    const { error: dbErr } = await supabase.from('koujitei_users').insert({
      id: data.user.id,
      name: form.name,
      role: form.role,
      color: form.color,
    })

    setLoading(false)
    if (dbErr) { setError(dbErr.message); return }
    setShowAdd(false)
    setForm({ email: '', password: '', name: '', role: 'member', color: COLORS[0] })
    refresh()
  }

  async function handleRoleChange(user: KoujiteiUser, role: Role) {
    await supabase.from('koujitei_users').update({ role }).eq('id', user.id)
    refresh()
  }

  async function handleColorChange(user: KoujiteiUser, color: string) {
    await supabase.from('koujitei_users').update({ color }).eq('id', user.id)
    refresh()
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ background: '#161616', borderBottom: '1px solid #2a2a2a' }}
      >
        <h2 className="text-sm font-bold" style={{ color: '#e8e6e0' }}>ユーザー管理</h2>
        <div className="flex-1" />
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: '#4a7fff', color: '#fff' }}
        >
          ＋ ユーザー追加
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="rounded-xl p-5 mb-5"
            style={{ background: '#161616', border: '1px solid #2a2a2a' }}
          >
            <h3 className="text-sm font-bold mb-4" style={{ color: '#e8e6e0' }}>新規ユーザー招待</h3>
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm mb-3" style={{ background: 'rgba(231,76,60,.12)', color: '#e74c3c', border: '1px solid rgba(231,76,60,.2)' }}>
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#888' }}>メールアドレス</label>
                <input
                  type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#1e1e1e', border: '1px solid #333', color: '#e8e6e0' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#888' }}>初期パスワード</label>
                <input
                  type="text" required value={form.password} minLength={6}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#1e1e1e', border: '1px solid #333', color: '#e8e6e0' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#888' }}>氏名</label>
                <input
                  type="text" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#1e1e1e', border: '1px solid #333', color: '#e8e6e0' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#888' }}>ロール</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#1e1e1e', border: '1px solid #333', color: '#e8e6e0' }}
                >
                  <option value="member">担当者 (member)</option>
                  <option value="admin">管理者 (admin)</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs mb-2" style={{ color: '#888' }}>ガントバーの色</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', background: c,
                      border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: '#1e1e1e', color: '#888', border: '1px solid #333' }}>
                キャンセル
              </button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50" style={{ background: '#4a7fff', color: '#fff' }}>
                {loading ? '追加中...' : '追加'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {users.map(user => (
            <div
              key={user.id}
              className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ background: '#161616', border: '1px solid #2a2a2a' }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 32, height: 32, borderRadius: '50%',
                  background: user.color,
                  flexShrink: 0,
                }}
              />
              <div className="flex-1">
                <div className="text-sm font-bold" style={{ color: '#e8e6e0' }}>{user.name}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(user, c)}
                    style={{
                      width: 16, height: 16, borderRadius: '50%', background: c,
                      border: user.color === c ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <select
                value={user.role}
                onChange={e => handleRoleChange(user, e.target.value as Role)}
                className="rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: user.role === 'admin' ? '#2ecc71' : '#4a7fff' }}
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
