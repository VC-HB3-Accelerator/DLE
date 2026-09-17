/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Реэкспорт канонической матрицы (@/shared/permissions).
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
