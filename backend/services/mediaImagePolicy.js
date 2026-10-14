'use strict';

const EQUIPMENT_WORDS =
  /(?:автомобил|машин|грузовик|самосвал|тягач|трактор|комбайн|экскаватор|погрузчик|кран|станок|оборудован|техник|car|truck|tractor|excavator|loader)/i;
const KNOWN_BRANDS =
  /(?:камаз|kamaz|voyah|toyota|bmw|mercedes|volvo|sany|xcmg|zoomlion|ростсельмаш|rostselmash|acros|nova|prado|land\s*cruiser)/i;
const MODEL_TOKEN = /\b(?:[a-zа-я]{1,8}[- ]?)?\d{2,5}[a-zа-я0-9-]*\b/i;
const FROM_SCRATCH = /(?:с\s+нуля|без\s+исходник|без\s+референс|from\s+scratch)/i;

function looksLikeNamedEquipment(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  return KNOWN_BRANDS.test(text) || (EQUIPMENT_WORDS.test(text) && MODEL_TOKEN.test(text));
}

function evaluateImageReferencePolicy({
  message,
  kind,
  hasReference,
}) {
  if (kind !== 'image' || hasReference) {
    return { allowed: true, reason: null };
  }
  if (looksLikeNamedEquipment(message)) {
    return { allowed: false, reason: 'named_equipment_requires_reference' };
  }
  if (FROM_SCRATCH.test(String(message || ''))) {
    return { allowed: true, reason: 'explicit_from_scratch' };
  }
  return { allowed: false, reason: 'image_source_choice_required' };
}

function referenceQuestion(reason) {
  const named = reason === 'named_equipment_requires_reference';
  return {
    id: 'image_source',
    prompt: named
      ? 'Для конкретной техники нужен исходный снимок, чтобы сохранить модель и геометрию.'
      : 'Как подготовить изображение?',
    options: named
      ? [
        { id: 'attach_reference', label: 'Приложить исходное фото', recommended: true },
        { id: 'cancel', label: 'Не генерировать' },
      ]
      : [
        { id: 'attach_reference', label: 'Использовать исходное фото', recommended: true },
        { id: 'from_scratch', label: 'Создать обычное изображение с нуля' },
      ],
  };
}

module.exports = {
  evaluateImageReferencePolicy,
  looksLikeNamedEquipment,
  referenceQuestion,
};
