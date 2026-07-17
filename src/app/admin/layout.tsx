import { redirect } from 'next/navigation'
import { getKoujiteiUser } from '@/lib/supabase/server'
import AdminNav from './AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const kUser = await getKoujiteiUser()
  if (!kUser) redirect('/login')
  if (kUser.role !== 'admin') redirect('/member')

  return (
    <div className="h-screen" style={{ background: '#f4f6f9' }}>
      <AdminNav userName={kUser.name} />
      <main className="h-full overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
