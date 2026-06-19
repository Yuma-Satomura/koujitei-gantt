import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFiscalYear } from '@/lib/gantt'
import type { GanttGroup } from '@/lib/types'
import GanttChart from '@/components/GanttChart'

export const dynamic = 'force-dynamic'

export default async function MemberGanttPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: kUser } = await supabase.from('koujitei_users').select('*').eq('id', user.id).single()
  if (!kUser) redirect('/login')

  const fiscalYear = getFiscalYear()

  const [{ data: members }, { data: projects }, { data: assignments }, { data: periods }] =
    await Promise.all([
      supabase.from('koujitei_users').select('*').eq('role', 'member').order('name'),
      supabase.from('koujitei_projects').select('*').eq('fiscal_year', fiscalYear).order('created_at'),
      supabase.from('koujitei_assignments').select('*'),
      supabase.from('koujitei_periods').select('*'),
    ])

  const groups: GanttGroup[] = (members ?? []).map(member => {
    const memberAssignments = (assignments ?? []).filter(a => a.user_id === member.id)
    const rows = memberAssignments.map(assignment => {
      const project = (projects ?? []).find(p => p.id === assignment.project_id)
      if (!project) return null
      const memberPeriods = (periods ?? []).filter(p => p.assignment_id === assignment.id)
      return { assignment, project, member, periods: memberPeriods }
    }).filter(Boolean) as GanttGroup['rows']
    return { member, rows }
  }).filter(g => g.rows.length > 0)

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ background: '#ffffff', borderBottom: '1px solid #dde1e7' }}
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
