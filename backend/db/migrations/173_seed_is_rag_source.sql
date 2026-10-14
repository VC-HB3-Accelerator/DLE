-- Справочник is_rag_source: миграции 032 создала таблицу без строк
-- (INSERT был закомментирован из‑за шифрования). user_tables.is_rag_source_id
-- default=2 и mirror правил ассистента требуют id 1/2.

INSERT INTO is_rag_source (id, name_encrypted)
VALUES
  (1, COALESCE(encrypt_text('Да', get_encryption_key()), 'Да')),
  (2, COALESCE(encrypt_text('Нет', get_encryption_key()), 'Нет'))
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('is_rag_source', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM is_rag_source), 1)
);
