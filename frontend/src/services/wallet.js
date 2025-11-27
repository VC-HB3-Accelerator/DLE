/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

// ВАЖНО:
// Здесь мы больше не дублируем SIWE-логику.
// Вся единая и отлаженная реализация находится в `src/utils/wallet.js` (connectWallet),
// а этот сервис просто проксирует вызов, чтобы компоненты могли по-прежнему
// использовать знакомый API `connectWithWallet`.

import { connectWallet } from '../utils/wallet';

/**
 * Обёртка над `connectWallet` для совместимости со старыми импортами.
 * Возвращает объект формата:
 * { success: boolean, address?: string, userId?: number, error?: string }
 */
export async function connectWithWallet() {
  return await connectWallet();
}
