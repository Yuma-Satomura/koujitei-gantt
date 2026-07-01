-- koujitei_periods にメモ列を追加
ALTER TABLE koujitei_periods ADD COLUMN IF NOT EXISTS memo text;

-- periods の UPDATE ポリシーを追加（メモ保存に必要）
CREATE POLICY "koujitei_periods: admin/本人 UPDATE"
  ON koujitei_periods FOR UPDATE
  TO authenticated USING (
    get_koujitei_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM koujitei_assignments
      WHERE id = assignment_id AND user_id = auth.uid()
    )
  );
