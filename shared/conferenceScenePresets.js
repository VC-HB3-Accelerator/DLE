/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Сцены ИИ-конференции (TZ CORPUS C2 / §7.3).
 * ID таблиц не хардкодим — подбираем по имени из списка RAG на узле.
 */

const SCENE_IDS = Object.freeze({
  CLIENT_DEMO: 'client_demo',
  PARTNER_ONBOARDING: 'partner_onboarding',
  INVESTOR_A: 'investor_a',
  REGULATOR_INTRO: 'regulator_intro'
});

const SCENES = Object.freeze([
  {
    id: SCENE_IDS.CLIENT_DEMO,
    packPaths: ['public-client'],
    tableNameHints: ['faq', 'публич', 'public', 'клиент', 'support'],
    search_rag_first: true,
    generate_if_no_rag: false,
    system_prompt:
      'Ты ведущий демо DLE для клиента (public). Отвечай только из RAG/документов встречи. '
      + 'Не называй ask раунда, %, долю инвестора, суммы вроде $8.5M / 8500 токенов, если их нет дословно в источниках. '
      + 'При отсутствии факта — скажи, что детали уточнит команда. Говори кратко, на языке собеседника.'
  },
  {
    id: SCENE_IDS.PARTNER_ONBOARDING,
    packPaths: ['partner', 'public-client'],
    tableNameHints: ['faq', 'partner', 'партнёр', 'public', 'публич'],
    search_rag_first: true,
    generate_if_no_rag: false,
    system_prompt:
      'Ты ведёшь онбординг партнёра/контрибьютора DLE. Опирайся на RAG (partner + public). '
      + 'Не раскрывай investor-a секреты и ask Stage A. Не выдумывай условия SPA. '
      + 'Помоги понять роль партнёра в сети ОС: канал, сервис, местный пилот.'
  },
  {
    id: SCENE_IDS.INVESTOR_A,
    packPaths: ['investor-a'],
    tableNameHints: ['investor', 'инвестор', 'faq'],
    search_rag_first: true,
    generate_if_no_rag: false,
    system_prompt:
      'Ты ведёшь презентацию для инвестора (слой A / teaser+pitch по ACL узла). '
      + 'Отвечай только из выбранных RAG-таблиц и документов встречи. '
      + 'Цифры ask/%/доли — только если есть дословно в источниках. Иначе — «уточним с командой после квалификации».'
  },
  {
    id: SCENE_IDS.REGULATOR_INTRO,
    packPaths: ['regulator-pilot', 'public-client'],
    tableNameHints: ['regulator', 'регулятор', 'pilot', 'public', 'faq'],
    search_rag_first: true,
    generate_if_no_rag: false,
    system_prompt:
      'Ты коротко представляешь пилот DLE регулятору/песочнице. Только публичные и pilot-факты из RAG. '
      + 'Не называй коммерческий ask и внутренние доли. При сомнении — направь к команде compliance.'
  }
]);

function listScenes() {
  return SCENES.map((s) => ({
    id: s.id,
    packPaths: s.packPaths.slice(),
    search_rag_first: s.search_rag_first,
    generate_if_no_rag: s.generate_if_no_rag
  }));
}

function getScene(sceneId) {
  return SCENES.find((s) => s.id === sceneId) || null;
}

/**
 * @param {string} sceneId
 * @param {Array<{ id: number|string, name?: string }>} tables
 * @returns {{ scene: object|null, rag_table_ids: number[], system_prompt: string, search_rag_first: boolean, generate_if_no_rag: boolean }}
 */
function applyScenePreset(sceneId, tables = []) {
  const scene = getScene(sceneId);
  if (!scene) {
    return {
      scene: null,
      rag_table_ids: [],
      system_prompt: '',
      search_rag_first: true,
      generate_if_no_rag: false
    };
  }

  const hints = scene.tableNameHints.map((h) => String(h).toLowerCase());
  const matched = [];
  for (const table of Array.isArray(tables) ? tables : []) {
    const name = String(table.name || '').toLowerCase();
    if (!name) continue;
    if (hints.some((h) => name.includes(h))) {
      const id = Number(table.id);
      if (Number.isFinite(id) && !matched.includes(id)) matched.push(id);
    }
  }

  return {
    scene,
    rag_table_ids: matched,
    system_prompt: scene.system_prompt,
    search_rag_first: scene.search_rag_first,
    generate_if_no_rag: scene.generate_if_no_rag
  };
}

module.exports = {
  SCENE_IDS,
  SCENES,
  listScenes,
  getScene,
  applyScenePreset
};
