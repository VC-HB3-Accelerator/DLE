const { execSshCommand } = require('./sshUtils');
const log = require('./logger');

// Системные требования
const SYSTEM_REQUIREMENTS = {
  minMemoryGB: 6,        // Минимум 6GB RAM (Ollama требует 4GB + система)
  minDiskGB: 30,         // Минимум 30GB свободного места (AI модели + Docker образы)
  minCpuCores: 2,        // Минимум 2 CPU ядра
  recommendedMemoryGB: 8, // Рекомендуется 8GB RAM (для комфортной работы)
  recommendedDiskGB: 50   // Рекомендуется 50GB свободного места
};

/**
 * Проверка системных требований VDS
 */
const checkSystemRequirements = async (options) => {
  log.info('🔍 Проверка системных требований VDS...');
  
  try {
    // Проверка памяти
    log.info('📊 Проверка памяти...');
    const memoryResult = await execSshCommand('free -h | grep "Mem:" | awk \'{print $2}\'', options);
    const memoryStr = memoryResult.stdout.trim().replace('G', '').replace('Gi', '');
    const memoryGB = parseFloat(memoryStr);
    
    // Проверка диска
    log.info('💾 Проверка диска...');
    const diskResult = await execSshCommand('df -h / | tail -1 | awk \'{print $4}\'', options);
    const diskStr = diskResult.stdout.trim().replace('G', '').replace('Gi', '');
    const diskGB = parseFloat(diskStr);
    
    // Проверка CPU
    log.info('⚡ Проверка CPU...');
    const cpuResult = await execSshCommand('nproc', options);
    const cpuCores = parseInt(cpuResult.stdout.trim());
    
    // Проверка архитектуры
    log.info('🏗️ Проверка архитектуры...');
    const archResult = await execSshCommand('uname -m', options);
    const architecture = archResult.stdout.trim();
    
    // Дополнительная диагностика архитектуры
    const archInfoResult = await execSshCommand('uname -a', options);
    log.info(`Архитектура (uname -m): "${architecture}"`);
    log.info(`Полная информация (uname -a): "${archInfoResult.stdout.trim()}"`);
    
    // Проверка версии Ubuntu
    log.info('🐧 Проверка версии Ubuntu...');
    const ubuntuResult = await execSshCommand('lsb_release -d | cut -f2', options);
    const ubuntuVersion = ubuntuResult.stdout.trim();
    
    const systemInfo = {
      memoryGB: memoryGB,
      diskGB: diskGB,
      cpuCores: cpuCores,
      architecture: architecture,
      ubuntuVersion: ubuntuVersion
    };
    
    log.info(`📋 Системная информация:`);
    log.info(`   💾 Память: ${memoryGB}GB (минимум: ${SYSTEM_REQUIREMENTS.minMemoryGB}GB, рекомендуется: ${SYSTEM_REQUIREMENTS.recommendedMemoryGB}GB)`);
    log.info(`   💿 Диск: ${diskGB}GB свободно (минимум: ${SYSTEM_REQUIREMENTS.minDiskGB}GB, рекомендуется: ${SYSTEM_REQUIREMENTS.recommendedDiskGB}GB)`);
    log.info(`   ⚡ CPU: ${cpuCores} ядер (минимум: ${SYSTEM_REQUIREMENTS.minCpuCores})`);
    log.info(`   🏗️ Архитектура: ${architecture}`);
    log.info(`   🐧 Ubuntu: ${ubuntuVersion}`);
    
    // Валидация требований
    const warnings = [];
    const errors = [];
    
    if (memoryGB < SYSTEM_REQUIREMENTS.minMemoryGB) {
      errors.push(`Недостаточно памяти: ${memoryGB}GB (требуется минимум ${SYSTEM_REQUIREMENTS.minMemoryGB}GB)`);
    } else if (memoryGB < SYSTEM_REQUIREMENTS.recommendedMemoryGB) {
      warnings.push(`Мало памяти: ${memoryGB}GB (рекомендуется ${SYSTEM_REQUIREMENTS.recommendedMemoryGB}GB)`);
    }
    
    if (diskGB < SYSTEM_REQUIREMENTS.minDiskGB) {
      errors.push(`Недостаточно места на диске: ${diskGB}GB (требуется минимум ${SYSTEM_REQUIREMENTS.minDiskGB}GB)`);
    } else if (diskGB < SYSTEM_REQUIREMENTS.recommendedDiskGB) {
      warnings.push(`Мало места на диске: ${diskGB}GB (рекомендуется ${SYSTEM_REQUIREMENTS.recommendedDiskGB}GB)`);
    }
    
    if (cpuCores < SYSTEM_REQUIREMENTS.minCpuCores) {
      errors.push(`Недостаточно CPU ядер: ${cpuCores} (требуется минимум ${SYSTEM_REQUIREMENTS.minCpuCores})`);
    }
    
    // Проверка архитектуры (поддерживаем различные архитектуры)
    const supportedArchitectures = [
      'x86_64', 'amd64', 'x64',           // Intel/AMD 64-bit
      'aarch64', 'arm64',                 // ARM 64-bit
      'armv7l', 'armv8l',                 // ARM 32/64-bit
      'i386', 'i686',                     // Intel 32-bit
      'ppc64le', 's390x'                  // PowerPC, IBM Z
    ];
    const isSupportedArch = supportedArchitectures.some(arch => 
      architecture.toLowerCase().includes(arch.toLowerCase())
    );
    
    if (!isSupportedArch) {
      // Вместо ошибки делаем предупреждение для неизвестных архитектур
      warnings.push(`Неизвестная архитектура: ${architecture} (поддерживаются: x86_64, amd64, aarch64, arm64, armv7l, armv8l, i386, i686, ppc64le, s390x)`);
      log.warn(`⚠️ Архитектура ${architecture} не в списке поддерживаемых, но попробуем продолжить...`);
    }
    
    // Вывод результатов
    if (warnings.length > 0) {
      log.warn('⚠️ Предупреждения:');
      warnings.forEach(warning => log.warn(`   ${warning}`));
    }
    
    if (errors.length > 0) {
      log.error('❌ Критические ошибки:');
      errors.forEach(error => log.error(`   ${error}`));
      throw new Error(`VDS не соответствует минимальным требованиям: ${errors.join(', ')}`);
    }
    
    if (warnings.length === 0 && errors.length === 0) {
      log.success('✅ Все системные требования выполнены!');
    } else {
      log.warn('⚠️ Система соответствует минимальным требованиям, но рекомендуется улучшить конфигурацию');
    }
    
    return {
      systemInfo,
      warnings,
      errors,
      isCompatible: errors.length === 0,
      hasWarnings: warnings.length > 0
    };
    
  } catch (error) {
    log.error(`Ошибка при проверке системных требований: ${error.message}`);
    throw error;
  }
};

module.exports = {
  checkSystemRequirements,
  SYSTEM_REQUIREMENTS
};
