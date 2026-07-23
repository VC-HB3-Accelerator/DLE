/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Ссылки на хаб публичных документов с фильтром раздела.
 */

/** Категория юр. документов в admin_pages_simple (нижний регистр). */
export const PRIVACY_SECTION_SLUG = 'политика и согласия';

export const PUBLISHED_DOCS_PATH = '/content/published';

/** /content/published?section=политика%20и%20согласия */
export function getPrivacyDocsUrl() {
  return `${PUBLISHED_DOCS_PATH}?section=${encodeURIComponent(PRIVACY_SECTION_SLUG)}`;
}
