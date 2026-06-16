import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '工程表 | 工事部',
  description: '工事部 案件管理・工程表システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
