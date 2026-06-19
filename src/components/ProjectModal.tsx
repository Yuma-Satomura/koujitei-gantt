'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project } from '@/lib/types'
import { getFiscalYear } from '@/lib/gantt'

interface Props {
  project?: Project
  fiscalYear: number
  onClose: () => void
  onSaved: () => void
}

const EMPTY: Omit<Project, 'id' | 'created_at'> = {
  kouban: '',
  client_name: '',
  project_name: '',
  sekkei: '',
  eigyo: '',
  gaichuu: '',
  location: '',
  contract_amount: null,
  deadline: null,
  fiscal_year: getFiscalYear(),
}

export default function ProjectModal({ project, fiscalYear, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState<Omit<Project, 'id' | 'created_at'>>(
    project
      ? {
          kouban: project.kouban ?? '',
          client_name: project.client_name,
          project_name: project.project_name,
          sekkei: project.sekkei ?? '',
          eigyo: project.eigyo ?? '',
          gaichuu: project.gaichuu ?? '',
          location: project.location ?? '',
          contract_amount: project.contract_amount,
          deadline: project.deadline,
          fiscal_year: project.fiscal_year,
        }
      : { ...EMPTY, fiscal_year: fiscalYear }
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof typeof form, value: string | number | null) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      ...form,
      kouban: form.kouban || null,
      sekkei: form.sekkei || null,
      eigyo: form.eigyo || null,
      gaichuu: form.gaichuu || null,
      location: form.location || null,
      deadline: form.deadline || null,
    }

    const { error } = project
      ? await supabase.from('koujitei_projects').update(payload).eq('id', project.id)
      : await supabase.from('koujitei_projects').insert(payload)

    setLoading(false)
    if (error) { setError(error.message); return }
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 w-full max-w-lg mx-4"
        style={{ background: '#ffffff', border: '1px solid #dde1e7' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold" style={{ color: '#1a1d23' }}>
            {project ? '案件を編集' : '案件を新規登録'}
          </h3>
          <button onClick={onClose} style={{ color: '#9ca3af', fontSize: 18 }}>×</button>
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: 'rgba(231,76,60,.12)', color: '#e74c3c', border: '1px solid rgba(231,76,60,.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="工番">
              <Input value={form.kouban ?? ''} onChange={v => set('kouban', v)} placeholder="2508526" />
            </Field>
            <Field label="年度">
              <Input type="number" value={String(form.fiscal_year)} onChange={v => set('fiscal_year', parseInt(v))} />
            </Field>
          </div>

          <Field label="納入先 *">
            <Input value={form.client_name} onChange={v => set('client_name', v)} required />
          </Field>

          <Field label="件名 *">
            <Input value={form.project_name} onChange={v => set('project_name', v)} required />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="設計担当">
              <Input value={form.sekkei ?? ''} onChange={v => set('sekkei', v)} />
            </Field>
            <Field label="営業担当">
              <Input value={form.eigyo ?? ''} onChange={v => set('eigyo', v)} />
            </Field>
            <Field label="外注管理">
              <Input value={form.gaichuu ?? ''} onChange={v => set('gaichuu', v)} />
            </Field>
          </div>

          <Field label="施工地">
            <Input value={form.location ?? ''} onChange={v => set('location', v)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="請負額 (K)">
              <Input
                type="number"
                value={form.contract_amount != null ? String(form.contract_amount) : ''}
                onChange={v => set('contract_amount', v ? parseInt(v) : null)}
                placeholder="24000"
              />
            </Field>
            <Field label="納期">
              <Input
                type="date"
                value={form.deadline ?? ''}
                onChange={v => set('deadline', v || null)}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', required, placeholder }: {
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
      style={{ background: '#f8f9fa', border: '1px solid #dde1e7', color: '#1a1d23' }}
    />
  )
}
