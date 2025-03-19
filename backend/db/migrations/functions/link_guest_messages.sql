CREATE OR REPLACE FUNCTION link_guest_messages(
  p_user_id INTEGER,
  p_guest_id VARCHAR(255)
) RETURNS VOID AS $$
DECLARE
  v_conversation_id INTEGER;
  v_count INTEGER;
BEGIN
  -- Логируем входные параметры
  RAISE NOTICE 'Linking messages for user_id: %, guest_id: %', p_user_id, p_guest_id;

  -- Проверяем наличие гостевых сообщений
  SELECT COUNT(*) INTO v_count
  FROM guest_messages
  WHERE guest_id = p_guest_id;
  
  RAISE NOTICE 'Found % guest messages', v_count;

  -- Создаем новую беседу
  INSERT INTO conversations (user_id, created_at, updated_at)
  VALUES (p_user_id, NOW(), NOW())
  RETURNING id INTO v_conversation_id;
  
  RAISE NOTICE 'Created conversation with id: %', v_conversation_id;

  -- Копируем сообщения пользователя
  WITH inserted_messages AS (
    INSERT INTO messages (
      conversation_id,
      sender_type,
      sender_id,
      content,
      role,
      channel,
      guest_message_id,
      created_at
    )
    SELECT 
      v_conversation_id,
      CASE WHEN is_ai THEN 'assistant' ELSE 'user' END,
      CASE WHEN NOT is_ai THEN p_user_id ELSE NULL END,
      content,
      CASE WHEN is_ai THEN 'assistant' ELSE 'user' END,
      'chat',
      id,  -- Сохраняем связь с гостевым сообщением
      created_at
    FROM guest_messages
    WHERE guest_id = p_guest_id
    ORDER BY created_at
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM inserted_messages;
  
  RAISE NOTICE 'Inserted % messages', v_count;
END;
$$ LANGUAGE plpgsql;