/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const rpcProviderService = require('../../services/rpcProviderService');

async function main() {
  try {
    console.log('🔍 Получение RPC URL из базы данных...\n');
    
    // Получаем все RPC провайдеры
    const providers = await rpcProviderService.getAllRpcProviders();
    
    console.log('📋 Все RPC провайдеры:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const provider of providers) {
      console.log(`🌐 Сеть: ${provider.network_id}`);
      console.log(`🔗 Chain ID: ${provider.chain_id}`);
      console.log(`📡 RPC URL: ${provider.rpc_url}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    // Получаем конкретный RPC URL для Sepolia
    console.log('\n🎯 RPC URL для Sepolia (chain_id: 11155111):');
    const sepoliaRpc = await rpcProviderService.getRpcUrlByChainId(11155111);
    
    if (sepoliaRpc) {
      console.log(`✅ Найден: ${sepoliaRpc}`);
    } else {
      console.log('❌ RPC URL для Sepolia не найден');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при получении RPC URL:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✅ Скрипт завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Скрипт завершен с ошибкой:', error);
    process.exit(1);
  }); 