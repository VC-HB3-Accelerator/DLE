-- Активные ADR из orchestrator/docs/decisions.md. ADR-007 proposed — не сюда.
-- Повтор не затирает уже изменённый status.

INSERT INTO orchestrator_decisions (
  id, scope, status, decision, rationale, review_after, supersedes
) VALUES
  (
    'ADR-001', 'orchestrator.product', 'active',
    'Оркестратор понимает задачу ОС и предлагает 2–3 варианта до execute',
    'Снять хардкод 8+1 можно только после выбора варианта',
    '2026-12-31', ARRAY[]::TEXT[]
  ),
  (
    'ADR-002', 'listing.keep_target', 'active',
    '8+1 — skill default, не константа runtime; keep_target и video берутся из выбранного plan option',
    'Временный хардкод CSV=8 живёт только как fallback, если option не задал число',
    '2026-10-31', ARRAY[]::TEXT[]
  ),
  (
    'ADR-003', 'router.models', 'active',
    'Имена моделей только в orchModelRouter / Settings',
    'Инцидент 22.09: списки в сервисах',
    '2026-10-15', ARRAY[]::TEXT[]
  ),
  (
    'ADR-004', 'provider.discovery', 'active',
    'Token Plan = compatible /models; paygo = native /api/v1/models + /quotas',
    'W03/W24',
    '2026-10-31', ARRAY[]::TEXT[]
  ),
  (
    'ADR-005', 'orch.chat', 'active',
    'Беседа личная на id; editor не читает и не пишет чужие реплики',
    'TZ_ORCHESTRATOR_CARDS §8.2–8.3',
    '2026-10-31', ARRAY['TZ_MEDIA_AGENT v1 editor-only']::TEXT[]
  ),
  (
    'ADR-006', 'orch.product', 'active',
    'Карточка из описания: файлы и поиск, schema, медиа по параметрам человека. 8+1 — fallback',
    'TZ_ORCHESTRATOR_CARDS §0, §11',
    '2026-12-31', ARRAY['photos-first / listing-only startTurn']::TEXT[]
  )
ON CONFLICT (id) DO NOTHING;

-- DOWN
-- DELETE FROM orchestrator_decisions WHERE id IN ('ADR-001','ADR-002','ADR-003','ADR-004','ADR-005','ADR-006');
