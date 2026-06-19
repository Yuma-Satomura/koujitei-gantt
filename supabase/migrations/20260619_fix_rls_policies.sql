-- ============================================================
-- RLS ポリシー修正
-- 1. koujitei_users: 新規登録時に自己 INSERT を許可
-- 2. koujitei_pending_users: 登録完了後に本人が DELETE できるよう許可
-- ============================================================

-- 1. koujitei_users 自己 INSERT（初回登録）
--    新規ユーザーはまだ koujitei_users に存在しないため
--    get_koujitei_role() が NULL を返し、admin ポリシーを通過できない。
--    自分自身の行のみ INSERT を許可する。
CREATE POLICY "koujitei_users: 自己 INSERT（初回登録）"
  ON koujitei_users FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());

-- 2. koujitei_pending_users: 登録完了後に本人が削除できるよう許可
--    handleSetup でサインアップ直後に pending レコードを消す処理があるが、
--    既存の DELETE ポリシーは admin のみのため、新規ユーザーには権限がなく
--    レコードが残り続けてしまう。email 一致で本人削除を許可する。
CREATE POLICY "koujitei_pending_users: 本人 DELETE（登録完了後）"
  ON koujitei_pending_users FOR DELETE
  TO authenticated USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
