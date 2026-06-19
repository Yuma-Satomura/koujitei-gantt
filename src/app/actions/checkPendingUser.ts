'use server'

import { createClient } from '@supabase/supabase-js'

interface PendingResult {
  found: boolean
  name?: string
  role?: string
  color?: string
}

// SECURITY DEFINER 関数経由で照合（RLS をバイパス、サービスロールキー不要）
// 自分のメールアドレスを知っている人が1件だけ確認できる設計。
export async function checkPendingUser(email: string): Promise<PendingResult> {
  if (!email || !email.includes('@')) return { found: false }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .rpc('check_koujitei_pending', { p_email: email })

  console.log('[checkPendingUser]', JSON.stringify({ email, data, error }))

  if (error || !data || data.length === 0) return { found: false }
  const row = data[0]
  return { found: true, name: row.name, role: row.role, color: row.color }
}
