'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminNav({ userName }: { userName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

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
    <>
      {/* ハンバーガーボタン（常に左上に固定） */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
        style={{
          position: 'fixed',
          top: 10,
          left: 10,
          zIndex: 300,
          width: 36,
          height: 36,
          background: '#ffffff',
          border: '1px solid #dde1e7',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 18,
          color: '#6b7280',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        {open ? '✕' : '☰'}
      </button>

      {/* オーバーレイ */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.25)',
          }}
        />
      )}

      {/* サイドバー本体 */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 250,
          width: 208,
          height: '100%',
          background: '#ffffff',
          borderRight: '1px solid #dde1e7',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(-208px)',
          transition: 'transform 0.22s ease',
          boxShadow: open ? '4px 0 16px rgba(0,0,0,0.10)' : 'none',
        }}
      >
        <div style={{ padding: '56px 20px 16px', borderBottom: '1px solid #dde1e7' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#4a7fff', marginBottom: 2 }}>
            ADMIN
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1d23' }}>工事部 工程表</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{userName}</div>
        </div>

        <nav style={{ flex: 1, padding: '8px 12px' }}>
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 14,
                textDecoration: 'none',
                background: pathname === link.href ? 'rgba(74,127,255,.12)' : 'transparent',
                color: pathname === link.href ? '#4a7fff' : '#6b7280',
                marginBottom: 2,
              }}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid #dde1e7' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 14,
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
            }}
          >
            ログアウト
          </button>
        </div>
      </aside>
    </>
  )
}
