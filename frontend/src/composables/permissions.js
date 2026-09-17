/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Реэкспорт канонической матрицы прав (@/shared/permissions).
 * Не дублировать PERMISSIONS здесь — иначе фронт теряет own/domain-права
 * (например CREATE_OWN_ARTICLES) и кнопки создания на /blog|/store пропадают.
 */

export {
  ROLES,
  PERMISSIONS,
  PERMISSIONS_MAP,
  hasPermission,
  getPermissionsForRole,
  hasAnyPermission,
  hasAllPermissions,
  getRoleDescription,
  canSendMessage
} from '@/shared/permissions.js';
