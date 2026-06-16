'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project, KoujiteiUser } from '@/lib/types'

interface Props {
  project: Project
  members: KoujiteiUser[]
  assignedUserIds: string[]
  onClose: () => void
  onSaved: () => void
}

export default function AssignModal({ project, members, assignedUserIds, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedUserIds))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    setLoading(true)
    setError(null)

    // 追加するユーザー
    const toAdd = [...selected].filter(id => !assignedUserIds.includes(id))
    // 削除するユーザー
    const toRemove = assignedUserIds.filter(id => !selected.has(id))

    for (const userId of toAdd) {
      const { error } = await supabase.from('koujitei_assignments').insert({
        project_id: project.id,
        user_id: userId,
      })
      if (error) { setError(error.message); setLoading(false); return }
    }

    for (const userId of toRemove) {
      const { error } = await supabase
        .from('koujitei_assignments')
        .delete()
        .eq('project_id', project.id)
        .eq('user_id', userId)
      if (error) { setError(error.message); setLoading(false); return }
    }

    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 w-full max-w-sm mx-4"
        style={{ background: '#161616', border: '1px solid #2a2a2a' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#e8e6e0' }}>担当者をアサイン</h3>
            <p className="text-xs mt-0.5 truncate max-w-56" style={{ color: '#888' }}>{project.project_name}</p>
          </div>
          <button onClick={onClose} style={{ color: '#555', fontSize: 18 }}>×</button>
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm mb-3" style={{ background: 'rgba(231,76,60,.12)', color: '#e74c3c', border: '1px solid rgba(231,76,60,.2)' }}>
            {error}
          </div>
        )}

        <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
          {members.map(m => (
            <label
              key={m.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
              style={{
                background: selected.has(m.id) ? 'rgba(74,127,255,.1)' : '#1e1e1e',
                border: `1px solid ${selected.has(m.id) ? 'rgba(74,127,255,.3)' : '#2a2a2a'}`,
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                className="rounded"
                style={{ accentColor: m.color }}
              />
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: m.color,
                }}
              />
              <span className="text-sm" style={{ color: '#e8e6e0' }}>{m.name}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: '#1e1e1e', color: '#888', border: '1px solid #333' }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            style={{ background: '#4a7fff', color: '#fff' }}
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
