'use server'

import { createAdminClient } from '@/lib/supabase/admin'

interface PendingResult {
  found: boolean
  name?: string
  role?: string
  color?: string
}

// ログイン画面から呼ばれる。サービスロールキーで照合するため RLS をバイパス。
// クライアントには found フラグと表示用情報のみ返す（メール一覧は返さない）。
export async function checkPendingUser(email: string): Promise<PendingResult> {
  if (!email || !email.includes('@')) return { found: false }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('koujitei_pending_users')
    .select('name, role, color')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (!data) return { found: false }
  return { found: true, name: data.name, role: data.role, color: data.color }
}
