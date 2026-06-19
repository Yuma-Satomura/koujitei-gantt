'use server'

import { createAdminClient } from '@/lib/supabase/admin'

interface RegisterParams {
  userId: string
  email: string
  name: string
  role: string
  color: string
}

// signUp 直後に呼ぶ。サービスロールキーで RLS をバイパスして koujitei_users に保存。
export async function registerUser(params: RegisterParams): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  // pending_users に本当に存在するか再確認（なりすまし防止）
  const { data: pending } = await supabase
    .from('koujitei_pending_users')
    .select('name, role, color')
    .eq('email', params.email.toLowerCase().trim())
    .maybeSingle()

  if (!pending) {
    return { error: '招待情報が見つかりません' }
  }

  const { error: insertError } = await supabase.from('koujitei_users').insert({
    id: params.userId,
    name: pending.name,
    role: pending.role,
    color: pending.color,
  })

  if (insertError) return { error: insertError.message }

  // pending_users から削除
  await supabase.from('koujitei_pending_users').delete().eq('email', params.email)

  return {}
}
