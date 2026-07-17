'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProjectModal from '@/components/ProjectModal'
import AssignModal from '@/components/AssignModal'
import type { Project, KoujiteiUser, Assignment } from '@/lib/types'
import { formatDate, formatAmount } from '@/lib/gantt'

interface Props {
  projects: Project[]
  members: KoujiteiUser[]
  assignments: Assignment[]
  fiscalYear: number
}

export default function ProjectsClient({ projects, members, assignments, fiscalYear }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [assignTarget, setAssignTarget] = useState<Project | null>(null)
  const [search, setSearch] = useState('')
  const refresh = useCallback(() => router.refresh(), [router])

  async function handleDelete(project: Project) {
    if (!confirm(`「${project.project_name}」を削除しますか？\n担当者のアサインと工程も全て削除されます。`)) return
    await supabase.from('koujitei_projects').delete().eq('id', project.id)
    refresh()
  }

  const filtered = projects.filter(p =>
    !search ||
    p.kouban?.includes(search) ||
    p.client_name.includes(search) ||
    p.project_name.includes(search) ||
    p.sekkei?.includes(search) ||
    p.eigyo?.includes(search)
  )

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div
        className="flex items-center gap-3 py-2.5 shrink-0"
        style={{ background: '#ffffff', borderBottom: '1px solid #dde1e7', paddingLeft: 56, paddingRight: 16 }}
      >
        <h2 className="text-sm font-bold" style={{ color: '#1a1d23' }}>案件管理</h2>
        <input
          type="text"
          placeholder="工番・件名・納入先で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm outline-none w-64"
          style={{ background: '#f8f9fa', border: '1px solid #dde1e7', color: '#1a1d23' }}
        />
        <div className="flex-1" />
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: '#4a7fff', color: '#fff' }}
        >
          ＋ 案件追加
        </button>
      </div>

      {/* テーブル */}
      <div className="flex-1 overflow-auto p-4">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['工番', '納入先', '件名', '設計', '営業', '外注管理', '請負額(K)', '納期', '施工地', '担当者', '操作'].map(h => (
                <th
                  key={h}
                  style={{
                    padding: '8px 10px',
                    background: '#f8f9fa',
                    color: '#6b7280',
                    fontWeight: 500,
                    textAlign: 'left',
                    borderBottom: '1px solid #dde1e7',
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(project => {
              const projectAssignments = assignments.filter(a => a.project_id === project.id)
              const assignedMembers = projectAssignments.map(a => members.find(m => m.id === a.user_id)).filter(Boolean)

              return (
                <tr key={project.id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                  <Td>{project.kouban}</Td>
                  <Td>{project.client_name}</Td>
                  <Td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.project_name}
                  </Td>
                  <Td>{project.sekkei}</Td>
                  <Td>{project.eigyo}</Td>
                  <Td>{project.gaichuu}</Td>
                  <Td style={{ textAlign: 'right' }}>{formatAmount(project.contract_amount)}</Td>
                  <Td>{formatDate(project.deadline)}</Td>
                  <Td>{project.location}</Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {assignedMembers.map(m => m && (
                        <span
                          key={m.id}
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44` }}
                        >
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditProject(project)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ background: '#f8f9fa', color: '#6b7280', border: '1px solid #dde1e7' }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => setAssignTarget(project)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ background: 'rgba(74,127,255,.1)', color: '#4a7fff', border: '1px solid rgba(74,127,255,.2)' }}
                      >
                        担当
                      </button>
                      <button
                        onClick={() => handleDelete(project)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ background: 'rgba(231,76,60,.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,.2)' }}
                      >
                        削除
                      </button>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-sm" style={{ color: '#9ca3af' }}>
            案件が見つかりません
          </div>
        )}
      </div>

      {showAdd && (
        <ProjectModal fiscalYear={fiscalYear} onClose={() => setShowAdd(false)} onSaved={refresh} />
      )}
      {editProject && (
        <ProjectModal project={editProject} fiscalYear={fiscalYear} onClose={() => setEditProject(null)} onSaved={refresh} />
      )}
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

function Td({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: '8px 10px', color: '#1a1d23', background: '#ffffff', verticalAlign: 'middle', ...style }}>
      {children ?? ''}
    </td>
  )
}
