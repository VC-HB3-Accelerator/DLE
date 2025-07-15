-- 048_add_order_to_user_rows.sql
-- Добавляет поле order в user_rows для поддержки сортировки строк

ALTER TABLE user_rows ADD COLUMN "order" INTEGER DEFAULT 0;

-- Проставить уникальные значения order для существующих строк (по id)
DO $$
DECLARE
  r RECORD;
  idx INTEGER := 1;
BEGIN
  FOR r IN SELECT id FROM user_rows ORDER BY id LOOP
    UPDATE user_rows SET "order" = idx WHERE id = r.id;
    idx := idx + 1;
  END LOOP;
END$$; 