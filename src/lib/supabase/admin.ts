import { createClient } from '@supabase/supabase-js'

// サービスロールキーはサーバー専用（NEXT_PUBLIC_ なし = クライアントに露出しない）
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
