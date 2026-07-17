import { createClient, getKoujiteiUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFiscalYear } from '@/lib/gantt'
import type { GanttGroup } from '@/lib/types'
import GanttChart from '@/components/GanttChart'

export const dynamic = 'force-dynamic'

export default async function MemberGanttPage() {
  const kUser = await getKoujiteiUser()
  if (!kUser) redirect('/login')

  const supabase = await createClient()
  const fiscalYear = getFiscalYear()

  const [{ data: members }, { data: projects }, { data: assignments }, { data: periods }] =
    await Promise.all([
      supabase.from('koujitei_users').select('*').order('name'),
      supabase.from('koujitei_projects').select('*').eq('fiscal_year', fiscalYear).order('created_at'),
      supabase.from('koujitei_assignments').select('*'),
      supabase.from('koujitei_periods').select('*'),
    ])

  const groups: GanttGroup[] = (assignments ?? []).flatMap(assignment => {
    const project = (projects ?? []).find(p => p.id === assignment.project_id)
    const member = (members ?? []).find(m => m.id === assignment.user_id)
    if (!project || !member) return []
    const assignmentPeriods = (periods ?? []).filter(p => p.assignment_id === assignment.id)
    return [{ member, rows: [{ assignment, project, member, periods: assignmentPeriods }] }]
  })

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 py-2.5 shrink-0"
        style={{ background: '#ffffff', borderBottom: '1px solid #dde1e7', paddingLeft: 56, paddingRight: 16 }}
      >
        <h2 className="text-sm font-bold" style={{ color: '#1a1d23' }}>全体工程表</h2>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'rgba(74,127,255,.1)', color: '#4a7fff', border: '1px solid rgba(74,127,255,.2)' }}
        >
          閲覧のみ
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <GanttChart
          groups={groups}
          fiscalYear={fiscalYear}
          isAdmin={true}
        />
      </div>
    </div>
  )
}
