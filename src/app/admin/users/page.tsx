import { createClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const supabase = await createClient()
  const [{ data: users }, { data: pendingUsers }] = await Promise.all([
    supabase.from('koujitei_users').select('*').order('name'),
    supabase.from('koujitei_pending_users').select('*').order('created_at'),
  ])
  return <UsersClient users={users ?? []} pendingUsers={pendingUsers ?? []} />
}
