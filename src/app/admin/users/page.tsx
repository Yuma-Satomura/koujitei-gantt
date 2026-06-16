import { createClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: users } = await supabase
    .from('koujitei_users')
    .select('*')
    .order('name')
  return <UsersClient users={users ?? []} />
}
