-- Миграция: добавление внешнего ключа для user_cell_values.column_id
-- Автор: Тарабанов Александр Викторович
-- Дата: 2025-10-08
-- Описание: Добавляет FK на user_columns для обеспечения целостности данных

BEGIN;

-- Добавляем внешний ключ на user_columns с каскадным удалением
ALTER TABLE user_cell_values
ADD CONSTRAINT fk_user_cell_values_column_id 
FOREIGN KEY (column_id) REFERENCES user_columns(id) ON DELETE CASCADE;

-- Комментарий для документации
COMMENT ON CONSTRAINT fk_user_cell_values_column_id ON user_cell_values IS 'Внешний ключ на user_columns для обеспечения целостности данных';

COMMIT;

