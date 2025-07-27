-- UP Migration
-- Этот SQL-код будет выполнен вашим скриптом run-migrations.js

BEGIN;

-- 1. Создаем таблицу для названий уровней ISIC (если не существует)
CREATE TABLE IF NOT EXISTS isic_rev4_level_names (
    code_level INTEGER PRIMARY KEY,
    level_name_en_encrypted TEXT
);

-- 2. Создаем основную таблицу для кодов ISIC (если не существует)
CREATE TABLE IF NOT EXISTS isic_rev4_codes (
    sort_order INTEGER,
    code VARCHAR(10) PRIMARY KEY,
    description TEXT,
    explanatory_note_inclusion TEXT,
    explanatory_note_exclusion TEXT,
    code_level INTEGER,
    level1 VARCHAR(10),
    level2 VARCHAR(10),
    level3 VARCHAR(10),
    level4 VARCHAR(10),
    level5 VARCHAR(10),
    level6 VARCHAR(10),
    CONSTRAINT fk_code_level FOREIGN KEY (code_level) REFERENCES isic_rev4_level_names (code_level)
);

-- 3. Загружаем данные в isic_rev4_level_names только если таблица пустая
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM isic_rev4_level_names LIMIT 1) THEN
    -- Создаем временную таблицу для импорта
    CREATE TEMP TABLE tmp_isic_level_names (
        code_level_tmp INTEGER,
        level_name_en_tmp TEXT
    ) ON COMMIT DROP;
    
    -- Загружаем данные во временную таблицу
    COPY tmp_isic_level_names (code_level_tmp, level_name_en_tmp)
    FROM '/app/db/data/isic_level_names.csv'
    WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',', QUOTE '"');
    
    -- Вставляем данные в основную таблицу
    INSERT INTO isic_rev4_level_names (code_level, level_name_en_encrypted)
    SELECT code_level_tmp, level_name_en_tmp FROM tmp_isic_level_names;
  END IF;
END $$;

-- 4. Загружаем данные в isic_rev4_codes только если таблица пустая
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM isic_rev4_codes LIMIT 1) THEN
    -- Создаем временные таблицы для импорта основных данных ISIC
    CREATE TEMP TABLE tmp_isic_titles (
        sort_order_tmp INTEGER,
        code_tmp VARCHAR(10),
        description_tmp TEXT,
        inclusion_tmp TEXT,
        exclusion_tmp TEXT
    ) ON COMMIT DROP;

    CREATE TEMP TABLE tmp_isic_structure (
        sort_order_tmp INTEGER,
        code_tmp VARCHAR(10),
        code_level_tmp INTEGER,
        level1_tmp VARCHAR(10),
        level2_tmp VARCHAR(10),
        level3_tmp VARCHAR(10),
        level4_tmp VARCHAR(10),
        level5_tmp VARCHAR(10),
        level6_tmp VARCHAR(10)
    ) ON COMMIT DROP;

    -- Загружаем данные во временные таблицы
    COPY tmp_isic_titles (sort_order_tmp, code_tmp, description_tmp, inclusion_tmp, exclusion_tmp)
    FROM '/app/db/data/isic_titles.csv'
    WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',', QUOTE '"');

    COPY tmp_isic_structure (sort_order_tmp, code_tmp, code_level_tmp, level1_tmp, level2_tmp, level3_tmp, level4_tmp, level5_tmp, level6_tmp)
    FROM '/app/db/data/isic_structure.csv'
    WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',', QUOTE '"');

    -- Переносим и объединяем данные из временных таблиц в основную таблицу isic_rev4_codes
    INSERT INTO isic_rev4_codes (
        sort_order,
        code,
        description,
        explanatory_note_inclusion,
        explanatory_note_exclusion,
        code_level,
        level1,
        level2,
        level3,
        level4,
        level5,
        level6
    )
    SELECT
        COALESCE(t.sort_order_tmp, s.sort_order_tmp),
        s.code_tmp,
        t.description_tmp,
        t.inclusion_tmp,
        t.exclusion_tmp,
        s.code_level_tmp,
        s.level1_tmp,
        s.level2_tmp,
        s.level3_tmp,
        s.level4_tmp,
        s.level5_tmp,
        s.level6_tmp
    FROM
        tmp_isic_structure s
    LEFT JOIN
        tmp_isic_titles t ON s.code_tmp = t.code_tmp;
  END IF;
END $$;

COMMIT;

-- DOWN Migration
-- Этот SQL-код НЕ будет выполнен вашим текущим скриптом run-migrations.js для отката,
-- но его полезно иметь для ручного отката или если вы доработаете скрипт.
-- BEGIN;
-- DROP TABLE IF EXISTS isic_rev4_codes;
-- DROP TABLE IF EXISTS isic_rev4_level_names;
-- COMMIT;