-- ============================================================
-- 工事部工程表 テーブル定義 + RLS
-- 既存 Supabase プロジェクトに koujitei_ プレフィックスで追加
-- ============================================================

-- ロール取得ヘルパー関数
CREATE OR REPLACE FUNCTION get_koujitei_role()
RETURNS TEXT AS $$
  SELECT role FROM koujitei_users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- 1. koujitei_users (担当者マスタ)
-- ============================================================
CREATE TABLE IF NOT EXISTS koujitei_users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  color       text NOT NULL DEFAULT '#4a7fff',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE koujitei_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "koujitei_users: 全員参照可"
  ON koujitei_users FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "koujitei_users: admin のみ INSERT"
  ON koujitei_users FOR INSERT
  TO authenticated WITH CHECK (get_koujitei_role() = 'admin');

CREATE POLICY "koujitei_users: admin のみ UPDATE"
  ON koujitei_users FOR UPDATE
  TO authenticated USING (get_koujitei_role() = 'admin');

CREATE POLICY "koujitei_users: admin のみ DELETE"
  ON koujitei_users FOR DELETE
  TO authenticated USING (get_koujitei_role() = 'admin');

-- ============================================================
-- 2. koujitei_projects (案件マスタ)
-- ============================================================
CREATE TABLE IF NOT EXISTS koujitei_projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kouban           text,
  client_name      text NOT NULL,
  project_name     text NOT NULL,
  sekkei           text,
  eigyo            text,
  gaichuu          text,
  location         text,
  contract_amount  integer,
  deadline         date,
  fiscal_year      integer NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE koujitei_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "koujitei_projects: 全員参照可"
  ON koujitei_projects FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "koujitei_projects: admin のみ INSERT"
  ON koujitei_projects FOR INSERT
  TO authenticated WITH CHECK (get_koujitei_role() = 'admin');

CREATE POLICY "koujitei_projects: admin のみ UPDATE"
  ON koujitei_projects FOR UPDATE
  TO authenticated USING (get_koujitei_role() = 'admin');

CREATE POLICY "koujitei_projects: admin のみ DELETE"
  ON koujitei_projects FOR DELETE
  TO authenticated USING (get_koujitei_role() = 'admin');

-- ============================================================
-- 3. koujitei_assignments (アサイン)
-- ============================================================
CREATE TABLE IF NOT EXISTS koujitei_assignments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES koujitei_projects(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES koujitei_users(id) ON DELETE CASCADE,
  progress                numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  is_complete_this_month  boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE koujitei_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "koujitei_assignments: 全員参照可"
  ON koujitei_assignments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "koujitei_assignments: admin のみ INSERT"
  ON koujitei_assignments FOR INSERT
  TO authenticated WITH CHECK (get_koujitei_role() = 'admin');

-- admin は全件、member は自分のアサインのみ更新可
CREATE POLICY "koujitei_assignments: admin/本人 UPDATE"
  ON koujitei_assignments FOR UPDATE
  TO authenticated USING (
    get_koujitei_role() = 'admin' OR user_id = auth.uid()
  );

CREATE POLICY "koujitei_assignments: admin のみ DELETE"
  ON koujitei_assignments FOR DELETE
  TO authenticated USING (get_koujitei_role() = 'admin');

-- ============================================================
-- 4. koujitei_periods (工程：複数対応)
-- ============================================================
CREATE TABLE IF NOT EXISTS koujitei_periods (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  uuid NOT NULL REFERENCES koujitei_assignments(id) ON DELETE CASCADE,
  start_date     date NOT NULL,
  end_date       date NOT NULL CHECK (end_date >= start_date),
  sort_order     integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE koujitei_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "koujitei_periods: 全員参照可"
  ON koujitei_periods FOR SELECT
  TO authenticated USING (true);

-- member は自分のアサインに紐づく工程のみ INSERT/DELETE 可
CREATE POLICY "koujitei_periods: admin/本人 INSERT"
  ON koujitei_periods FOR INSERT
  TO authenticated WITH CHECK (
    get_koujitei_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM koujitei_assignments
      WHERE id = assignment_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "koujitei_periods: admin/本人 DELETE"
  ON koujitei_periods FOR DELETE
  TO authenticated USING (
    get_koujitei_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM koujitei_assignments
      WHERE id = assignment_id AND user_id = auth.uid()
    )
  );
