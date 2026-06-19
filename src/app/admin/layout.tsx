import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from './AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: kUser } = await supabase
    .from('koujitei_users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (kUser?.role !== 'admin') redirect('/member')

  return (
    <div className="flex h-screen" style={{ background: '#f4f6f9' }}>
      <AdminNav userName={kUser.name} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
