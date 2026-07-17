'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GanttChart from '@/components/GanttChart'
import ProjectModal from '@/components/ProjectModal'
import AssignModal from '@/components/AssignModal'
import type { GanttGroup, Project, KoujiteiUser, Assignment, SortKey } from '@/lib/types'

interface Props {
  initialGroups: GanttGroup[]
  fiscalYear: number
  members: KoujiteiUser[]
  projects: Project[]
  assignments: Assignment[]
}

const MONTHS = ['4月','5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月']
const ROWS_PER_PAGE = 20

function splitGroupsIntoPages(groups: GanttGroup[], rowsPerPage: number): GanttGroup[][] {
  const pages: GanttGroup[][] = []
  let currentPage: GanttGroup[] = []
  let currentCount = 0

  for (const group of groups) {
    let rowsLeft = [...group.rows]
    while (rowsLeft.length > 0) {
      const available = rowsPerPage - currentCount
      const chunk = rowsLeft.slice(0, available)
      rowsLeft = rowsLeft.slice(available)
      currentPage.push({ ...group, rows: chunk })
      currentCount += chunk.length
      if (currentCount >= rowsPerPage) {
        pages.push(currentPage)
        currentPage = []
        currentCount = 0
      }
    }
  }

  if (currentPage.length > 0) pages.push(currentPage)
  return pages
}

export default function AdminGanttPage({ initialGroups, fiscalYear, members, projects, assignments }: Props) {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const printPageRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<any>(null)

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('member')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [assignTarget, setAssignTarget] = useState<Project | null>(null)
  const [printFrom, setPrintFrom] = useState(0)
  const [printTo, setPrintTo] = useState(5)
  const [printJob, setPrintJob] = useState<{
    weekRange: { start: number; end: number }
    label: string
    pages: GanttGroup[][]
    currentPage: number
    createdAt: string
  } | null>(null)

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
    let cmp: number
    if (sortKey === 'member') {
      cmp = a.member.name.localeCompare(b.member.name, 'ja')
    } else {
      const field = sortKey === 'sekkei' ? 'sekkei' : sortKey === 'eigyo' ? 'eigyo' : 'kouban'
      const aVal = a.rows[0]?.project[field] ?? ''
      const bVal = b.rows[0]?.project[field] ?? ''
      cmp = String(aVal).localeCompare(String(bVal), 'ja')
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  // ページ順にキャプチャして PDF を生成
  useEffect(() => {
    if (!printJob || !printPageRef.current) return
    const el = printPageRef.current

    const timer = setTimeout(async () => {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(el, { scale: 1.5, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = pdfRef.current
      if (!pdf) return

      if (printJob.currentPage > 0) pdf.addPage()
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const ratio = Math.min((pageW - 20) / canvas.width, (pageH - 20) / canvas.height)
      pdf.addImage(imgData, 'PNG', 10, 10, canvas.width * ratio, canvas.height * ratio)

      if (printJob.currentPage < printJob.pages.length - 1) {
        setPrintJob(prev => prev ? { ...prev, currentPage: prev.currentPage + 1 } : null)
      } else {
        pdf.save(`工程表_${printJob.label}_${fiscalYear}.pdf`)
        pdfRef.current = null
        setPrintJob(null)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [printJob, fiscalYear])

  async function handlePDF() {
    const pages = splitGroupsIntoPages(sortedGroups, ROWS_PER_PAGE)
    if (pages.length === 0) return
    const from = Math.min(printFrom, printTo)
    const to = Math.max(printFrom, printTo)
    const label = from === to ? MONTHS[from] : `${MONTHS[from]}〜${MONTHS[to]}`
    const { default: jsPDF } = await import('jspdf')
    pdfRef.current = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
    const now = new Date()
    const createdAt = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
    setPrintJob({
      weekRange: { start: from * 4, end: to * 4 + 3 },
      label,
      pages,
      currentPage: 0,
      createdAt,
    })
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
        className="flex items-center gap-3 py-2.5 shrink-0 flex-wrap"
        style={{ background: '#ffffff', borderBottom: '1px solid #dde1e7', paddingLeft: 56, paddingRight: 16 }}
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
          {SORT_KEYS.map(s => {
            const active = sortKey === s.key
            return (
              <button
                key={s.key}
                onClick={() => {
                  if (active) {
                    setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortKey(s.key)
                    setSortDir('asc')
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                style={{
                  background: active ? 'rgba(74,127,255,.15)' : '#f8f9fa',
                  color: active ? '#4a7fff' : '#6b7280',
                  border: `1px solid ${active ? 'rgba(74,127,255,.3)' : '#dde1e7'}`,
                }}
              >
                {s.label}
                {active && (
                  <span style={{ fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowProjectModal(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: '#4a7fff', color: '#fff' }}
        >
          ＋ 案件追加
        </button>

        {/* 月範囲選択 + PDF出力 */}
        <select
          value={printFrom}
          onChange={e => setPrintFrom(Number(e.target.value))}
          disabled={!!printJob}
          className="rounded-lg px-2 py-1.5 text-xs outline-none"
          style={{ background: '#f8f9fa', border: '1px solid #dde1e7', color: '#1a1d23' }}
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i}>{m}</option>
          ))}
        </select>
        <span className="text-xs" style={{ color: '#9ca3af' }}>〜</span>
        <select
          value={printTo}
          onChange={e => setPrintTo(Number(e.target.value))}
          disabled={!!printJob}
          className="rounded-lg px-2 py-1.5 text-xs outline-none"
          style={{ background: '#f8f9fa', border: '1px solid #dde1e7', color: '#1a1d23' }}
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i}>{m}</option>
          ))}
        </select>
        <button
          onClick={handlePDF}
          disabled={!!printJob}
          className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
          style={{ background: '#f8f9fa', color: '#6b7280', border: '1px solid #dde1e7' }}
        >
          {printJob
            ? `PDF生成中 ${printJob.currentPage + 1}/${printJob.pages.length}枚目...`
            : 'PDF出力'}
        </button>
      </div>

      {/* ガントチャート */}
      <div className="flex-1 overflow-auto">
        <GanttChart
          groups={sortedGroups}
          fiscalYear={fiscalYear}
          isAdmin={false}
          onDataChange={refresh}
          printRef={printRef}
        />
      </div>

      {/* 印刷用隠しチャート（ページごとに順次キャプチャ） */}
      {printJob && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', left: '-9999px', top: 0, width: 1587, overflow: 'visible' }}
        >
          <div ref={printPageRef} style={{ minHeight: 1100, background: '#ffffff' }}>
            {/* タイトル・ページ番号 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 28px 14px 28px',
              borderBottom: '2px solid #1a1d23',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1d23', letterSpacing: 3 }}>
                工程管理表
              </div>
              <div style={{ fontSize: 11, textAlign: 'right', color: '#1a1d23', lineHeight: 1.8 }}>
                <div>{printJob.currentPage + 1} / {printJob.pages.length} ページ</div>
                <div>作成日: {printJob.createdAt}</div>
              </div>
            </div>
            <GanttChart
              groups={printJob.pages[printJob.currentPage]}
              fiscalYear={fiscalYear}
              isAdmin={true}
              weekRangeOverride={printJob.weekRange}
            />
          </div>
        </div>
      )}

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
