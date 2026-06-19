import { createClient } from '@/lib/supabase/server'
import ProjectsClient from './ProjectsClient'
import { getFiscalYear } from '@/lib/gantt'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const fiscalYear = getFiscalYear()

  const [{ data: projects }, { data: members }, { data: assignments }] = await Promise.all([
    supabase.from('koujitei_projects').select('*').eq('fiscal_year', fiscalYear).order('created_at'),
    supabase.from('koujitei_users').select('*').order('name'),
    supabase.from('koujitei_assignments').select('*'),
  ])

  return (
    <ProjectsClient
      projects={projects ?? []}
      members={members ?? []}
      assignments={assignments ?? []}
      fiscalYear={fiscalYear}
    />
  )
}
