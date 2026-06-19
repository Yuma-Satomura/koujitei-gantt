import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MemberProjectsClient from '@/app/member/MemberProjectsClient'
import { getFiscalYear } from '@/lib/gantt'
import type { GanttGroup } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminMyProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fiscalYear = getFiscalYear()

  const [{ data: kUser }, { data: assignments }, { data: periods }] = await Promise.all([
    supabase.from('koujitei_users').select('*').eq('id', user.id).single(),
    supabase.from('koujitei_assignments').select('*').eq('user_id', user.id),
    supabase.from('koujitei_periods').select('*'),
  ])

  if (!kUser) redirect('/login')

  const projectIds = (assignments ?? []).map(a => a.project_id)
  const { data: projects } = projectIds.length > 0
    ? await supabase.from('koujitei_projects').select('*').in('id', projectIds)
    : { data: [] }

  const myRows = (assignments ?? []).map(assignment => {
    const project = (projects ?? []).find(p => p.id === assignment.project_id)
    if (!project) return null
    const myPeriods = (periods ?? []).filter(p => p.assignment_id === assignment.id)
    return { assignment, project, member: kUser, periods: myPeriods }
  }).filter(Boolean) as GanttGroup['rows']

  const groups: GanttGroup[] = myRows.length > 0
    ? [{ member: kUser, rows: myRows }]
    : []

  return (
    <MemberProjectsClient
      groups={groups}
      fiscalYear={fiscalYear}
      currentUser={kUser}
    />
  )
}
