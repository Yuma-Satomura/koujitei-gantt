'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import GanttChart from '@/components/GanttChart'
import ProjectModal from '@/components/ProjectModal'
import AssignModal from '@/components/AssignModal'
import type { GanttGroup, Project, KoujiteiUser, Assignment, SortKey } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  initialGroups: GanttGroup[]
  fiscalYear: number
  members: KoujiteiUser[]
  projects: Project[]
  assignments: Assignment[]
}

export default function AdminGanttPage({ initialGroups, fiscalYear, members, projects, assignments }: Props) {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('member')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [assignTarget, setAssignTarget] = useState<Project | null>(null)

  const refresh = useCallback(() => router.refresh(), [router])

  // 検索フィルタリング
  const filteredGroups: GanttGroup[] = initialGroups
    .map(group => ({
      ...group,
      rows: group.rows.filter(row =>
        !search ||
        group.member.name.includes(search) ||
        row.project.sekkei?.includes(search) ||
        row.project.eigyo?.includes(search) ||
        row.project.kouban?.includes(search) ||
        row.project.client_name.includes(search) ||
        row.project.project_name.includes(search)
      ),
    }))
    .filter(g => g.rows.length > 0)

  // ソート
  const sortedGroups = [...filteredGroups].sort((a, b) => {
    if (sortKey === 'member') return a.member.name.localeCompare(b.member.name, 'ja')
    const aVal = a.rows[0]?.project[sortKey === 'sekkei' ? 'sekkei' : sortKey === 'eigyo' ? 'eigyo' : 'kouban'] ?? ''
    const bVal = b.rows[0]?.project[sortKey === 'sekkei' ? 'sekkei' : sortKey === 'eigyo' ? 'eigyo' : 'kouban'] ?? ''
    return String(aVal).localeCompare(String(bVal), 'ja')
  })

  async function handlePDF(half: 'first' | 'second') {
    const { default: jsPDF } = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')
    if (!printRef.current) return

    const canvas = await html2canvas(printRef.current, { scale: 1.5, useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgW = canvas.width
    const imgH = canvas.height
    const ratio = Math.min((pageW - 20) / imgW, (pageH - 20) / imgH)
    pdf.addImage(imgData, 'PNG', 10, 10, imgW * ratio, imgH * ratio)
    pdf.save(`工程表_${half === 'first' ? '前半' : '後半'}_${fiscalYear}.pdf`)
  }

  const SORT_KEYS: { key: SortKey; label: string }[] = [
    { key: 'member', label: '担当' },
    { key: 'sekkei', label: '設計' },
    { key: 'eigyo', label: '営業' },
    { key: 'kouban', label: '工番' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 shrink-0 flex-wrap"
        style={{ background: '#ffffff', borderBottom: '1px solid #dde1e7' }}
      >
        <input
          type="text"
          placeholder="担当・設計・営業・工番で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm outline-none w-64"
          style={{ background: '#f8f9fa', border: '1px solid #dde1e7', color: '#1a1d23' }}
        />

        <div className="flex gap-1">
          {SORT_KEYS.map(s => (
            <button
              key={s.key}
              onClick={() => setSortKey(s.key)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: sortKey === s.key ? 'rgba(74,127,255,.15)' : '#f8f9fa',
                color: sortKey === s.key ? '#4a7fff' : '#6b7280',
                border: `1px solid ${sortKey === s.key ? 'rgba(74,127,255,.3)' : '#dde1e7'}`,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowProjectModal(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: '#4a7fff', color: '#fff' }}
        >
          ＋ 案件追加
        </button>

        <button
          onClick={() => handlePDF('first')}
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: '#f8f9fa', color: '#6b7280', border: '1px solid #dde1e7' }}
        >
          PDF 前半
        </button>
        <button
          onClick={() => handlePDF('second')}
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: '#f8f9fa', color: '#6b7280', border: '1px solid #dde1e7' }}
        >
          PDF 後半
        </button>
      </div>

      {/* ガントチャート */}
      <div className="flex-1 overflow-auto">
        <GanttChart
          groups={sortedGroups}
          fiscalYear={fiscalYear}
          isAdmin={true}
          onDataChange={refresh}
          printRef={printRef}
        />
      </div>

      {/* 案件追加モーダル */}
      {showProjectModal && (
        <ProjectModal
          fiscalYear={fiscalYear}
          onClose={() => setShowProjectModal(false)}
          onSaved={refresh}
        />
      )}

      {/* アサインモーダル */}
      {assignTarget && (
        <AssignModal
          project={assignTarget}
          members={members}
          assignedUserIds={assignments.filter(a => a.project_id === assignTarget.id).map(a => a.user_id)}
          onClose={() => setAssignTarget(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
