-- ============================================================
-- 招待テーブル：管理者が事前に登録するメール+名前+ロール
-- ============================================================
CREATE TABLE IF NOT EXISTS koujitei_pending_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  color      text NOT NULL DEFAULT '#4a7fff',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE koujitei_pending_users ENABLE ROW LEVEL SECURITY;

-- 未認証(anon)でもメールアドレス照合できるように全件 SELECT を許可
-- （name/role/color のみで機密情報なし）
CREATE POLICY "koujitei_pending_users: 全員参照可"
  ON koujitei_pending_users FOR SELECT
  USING (true);

CREATE POLICY "koujitei_pending_users: admin のみ INSERT"
  ON koujitei_pending_users FOR INSERT
  TO authenticated WITH CHECK (get_koujitei_role() = 'admin');

CREATE POLICY "koujitei_pending_users: admin のみ DELETE"
  ON koujitei_pending_users FOR DELETE
  TO authenticated USING (get_koujitei_role() = 'admin');
