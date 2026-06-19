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

interface PendingUser {
  id: string
  email: string
  name: string
  role: Role
  color: string
  created_at: string
}

interface Props {
  users: KoujiteiUser[]
  pendingUsers: PendingUser[]
}

interface InviteForm {
  email: string
  name: string
  role: Role
  color: string
}

export default function UsersClient({ users, pendingUsers }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const refresh = useCallback(() => router.refresh(), [router])

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<InviteForm>({
    email: '', name: '', role: 'member', color: COLORS[0],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: dbErr } = await supabase.from('koujitei_pending_users').insert({
      email: form.email,
      name: form.name,
      role: form.role,
      color: form.color,
    })

    setLoading(false)
    if (dbErr) {
      setError(dbErr.code === '23505' ? 'このメールアドレスはすでに登録されています' : dbErr.message)
      return
    }
    setShowAdd(false)
    setForm({ email: '', name: '', role: 'member', color: COLORS[0] })
    refresh()
  }

  async function handleDeletePending(id: string) {
    await supabase.from('koujitei_pending_users').delete().eq('id', id)
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
        style={{ background: '#ffffff', borderBottom: '1px solid #dde1e7' }}
      >
        <h2 className="text-sm font-bold" style={{ color: '#1a1d23' }}>ユーザー管理</h2>
        <div className="flex-1" />
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: '#4a7fff', color: '#fff' }}
        >
          ＋ ユーザーを招待
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">

        {/* 招待フォーム */}
        {showAdd && (
          <form
            onSubmit={handleInvite}
            className="rounded-xl p-5"
            style={{ background: '#ffffff', border: '1px solid #dde1e7' }}
          >
            <h3 className="text-sm font-bold mb-1" style={{ color: '#1a1d23' }}>ユーザーを招待</h3>
            <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
              登録後、該当メールアドレスでログイン画面からパスワードを設定して初回ログインできます。
            </p>
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm mb-3" style={{ background: 'rgba(231,76,60,.12)', color: '#e74c3c', border: '1px solid rgba(231,76,60,.2)' }}>
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>氏名</label>
                <input
                  type="text" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#f8f9fa', border: '1px solid #dde1e7', color: '#1a1d23' }}
                  placeholder="佐藤 太郎"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>メールアドレス</label>
                <input
                  type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#f8f9fa', border: '1px solid #dde1e7', color: '#1a1d23' }}
                  placeholder="taro@company.com"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>ロール</label>
              <div className="flex gap-2">
                {(['member', 'admin'] as Role[]).map(r => (
                  <label
                    key={r}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm"
                    style={{
                      background: form.role === r ? 'rgba(74,127,255,.1)' : '#f8f9fa',
                      border: `1px solid ${form.role === r ? 'rgba(74,127,255,.3)' : '#dde1e7'}`,
                      color: form.role === r ? '#4a7fff' : '#6b7280',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={form.role === r}
                      onChange={() => setForm(f => ({ ...f, role: r }))}
                      className="hidden"
                    />
                    {r === 'member' ? '担当者 (member)' : '管理者 (admin)'}
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs mb-2" style={{ color: '#6b7280' }}>ガントバーの色</label>
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
              <button
                type="button"
                onClick={() => { setShowAdd(false); setError(null) }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: '#f8f9fa', color: '#6b7280', border: '1px solid #dde1e7 '}}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: '#4a7fff', color: '#fff' }}
              >
                {loading ? '登録中...' : '招待リストに追加'}
              </button>
            </div>
          </form>
        )}

        {/* 招待待ち */}
        {pendingUsers.length > 0 && (
          <div>
            <h3 className="text-xs font-bold mb-2 tracking-wider" style={{ color: '#9ca3af' }}>
              招待済み（初回ログイン待ち）
            </h3>
            <div className="space-y-2">
              {pendingUsers.map(pu => (
                <div
                  key={pu.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: '#ffffff', border: '1px solid #dde1e7' }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 32, height: 32, borderRadius: '50%',
                      background: pu.color, opacity: 0.5, flexShrink: 0,
                    }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-bold" style={{ color: '#6b7280' }}>{pu.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{pu.email}</div>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: 'rgba(243,156,18,.1)',
                      color: '#f39c12',
                      border: '1px solid rgba(243,156,18,.2)',
                    }}
                  >
                    未ログイン
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: pu.role === 'admin' ? 'rgba(46,204,113,.1)' : 'rgba(74,127,255,.1)',
                      color: pu.role === 'admin' ? '#2ecc71' : '#4a7fff',
                    }}
                  >
                    {pu.role}
                  </span>
                  <button
                    onClick={() => handleDeletePending(pu.id)}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: 'rgba(231,76,60,.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,.2)' }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 登録済みユーザー */}
        <div>
          <h3 className="text-xs font-bold mb-2 tracking-wider" style={{ color: '#9ca3af' }}>
            登録済みユーザー
          </h3>
          {users.length === 0 ? (
            <p className="text-sm" style={{ color: '#dde1e7' }}>まだ誰もログインしていません</p>
          ) : (
            <div className="space-y-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: '#ffffff', border: '1px solid #dde1e7' }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 32, height: 32, borderRadius: '50%',
                      background: user.color, flexShrink: 0,
                    }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-bold" style={{ color: '#1a1d23' }}>{user.name}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
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
                    style={{
                      background: '#f8f9fa',
                      border: '1px solid #dde1e7',
                      color: user.role === 'admin' ? '#2ecc71' : '#4a7fff',
                    }}
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
