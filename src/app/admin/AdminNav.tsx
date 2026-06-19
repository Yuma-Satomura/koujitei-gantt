'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminNav({ userName }: { userName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { href: '/admin', label: '工程表', icon: '▦' },
    { href: '/admin/my-projects', label: 'マイ案件', icon: '📌' },
    { href: '/admin/projects', label: '案件管理', icon: '📋' },
    { href: '/admin/users', label: 'ユーザー管理', icon: '👥' },
  ]

  return (
    <aside
      className="flex flex-col w-52 shrink-0 h-full"
      style={{ background: '#ffffff', borderRight: '1px solid #dde1e7' }}
    >
      <div className="p-5 border-b" style={{ borderColor: '#dde1e7' }}>
        <div className="text-xs font-bold tracking-widest mb-0.5" style={{ color: '#4a7fff' }}>
          ADMIN
        </div>
        <div className="text-sm font-bold" style={{ color: '#1a1d23' }}>工事部 工程表</div>
        <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>{userName}</div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: pathname === link.href ? 'rgba(74,127,255,.12)' : 'transparent',
              color: pathname === link.href ? '#4a7fff' : '#6b7280',
            }}
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: '#dde1e7' }}>
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 rounded-lg text-sm text-left transition-colors"
          style={{ color: '#9ca3af' }}
        >
          ログアウト
        </button>
      </div>
    </aside>
  )
}
