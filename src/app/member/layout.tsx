import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MemberNav from './MemberNav'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: kUser } = await supabase
    .from('koujitei_users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!kUser) redirect('/login')

  return (
    <div className="flex h-screen" style={{ background: '#f4f6f9' }}>
      <MemberNav userName={kUser.name} userRole={kUser.role} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
