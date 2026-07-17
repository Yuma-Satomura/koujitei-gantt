import { createClient } from '@/lib/supabase/server'
import AdminGanttPage from './AdminGanttPage'
import { getFiscalYear } from '@/lib/gantt'
import type { GanttGroup } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const fiscalYear = getFiscalYear()

  const [{ data: members }, { data: projects }, { data: assignments }, { data: periods }] =
    await Promise.all([
      supabase.from('koujitei_users').select('*').order('name'),
      supabase.from('koujitei_projects').select('*').eq('fiscal_year', fiscalYear).order('created_at'),
      supabase.from('koujitei_assignments').select('*'),
      supabase.from('koujitei_periods').select('*'),
    ])

  // GanttGroup 構築（案件ごとに1行）
  const groups: GanttGroup[] = (assignments ?? []).flatMap(assignment => {
    const project = (projects ?? []).find(p => p.id === assignment.project_id)
    const member = (members ?? []).find(m => m.id === assignment.user_id)
    if (!project || !member) return []
    const assignmentPeriods = (periods ?? []).filter(p => p.assignment_id === assignment.id)
    return [{ member, rows: [{ assignment, project, member, periods: assignmentPeriods }] }]
  })

  return (
    <AdminGanttPage
      initialGroups={groups}
      fiscalYear={fiscalYear}
      members={members ?? []}
      projects={projects ?? []}
      assignments={assignments ?? []}
    />
  )
}
