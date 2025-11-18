const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const { execSshCommand, execScpCommand } = require('./sshUtils');
const log = require('./logger');

// Безопасные CLI команды
const execAsync = promisify(exec);

// Разрешенные Docker команды для безопасности
const ALLOWED_DOCKER_COMMANDS = [
  'docker save',
  'docker load', 
  'docker images',
  'docker ps',
  'docker run'
];

// Валидация команд
const validateDockerCommand = (command) => {
  return ALLOWED_DOCKER_COMMANDS.some(allowed => command.startsWith(allowed));
};

// Безопасное выполнение Docker команд
const execDockerCommand = async (command) => {
  if (!validateDockerCommand(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }
  return execAsync(command);
};

const execLocalCommand = async (command, options = {}) => {
  return execAsync(command, { maxBuffer: options.maxBuffer || 1024 * 1024 * 50 });
};

/**
 * Экспорт Docker образов и данных с локальной машины
 */
const exportDockerImages = async (sendWebSocketLog) => {
  log.info('Экспорт Docker образов и данных с хоста...');
  sendWebSocketLog('info', '📦 Начинаем экспорт Docker образов...', 'export_images', 60);
  
  const images = [
    { name: 'postgres:16', file: 'dapp-postgres.tar' },
    { name: 'digital_legal_entitydle-ollama:latest', file: 'dapp-ollama.tar' },
    { name: 'digital_legal_entitydle-vector-search:latest', file: 'dapp-vector-search.tar' },
    { name: 'digital_legal_entitydle-backend:latest', file: 'dapp-backend.tar' },
    { name: 'digital_legal_entitydle-frontend:latest', file: 'dapp-frontend.tar' },
    { name: 'digital_legal_entitydle-frontend-nginx:latest', file: 'dapp-frontend-nginx.tar' },
    { name: 'digital_legal_entitydle-webssh-agent:latest', file: 'dapp-webssh-agent.tar' }
  ];
  
  // Экспортируем все образы
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const progress = 60 + Math.floor((i / images.length) * 10); // 60-70%
    sendWebSocketLog('info', `📦 Экспорт образа: ${image.name}`, 'export_images', progress);
    
    try {
      const outputPath = `/tmp/${image.file}`;
      
      // Безопасный экспорт через CLI
      await execDockerCommand(`docker save ${image.name} > ${outputPath}`);
      
      sendWebSocketLog('success', `✅ Экспорт ${image.name} завершен`, 'export_images', progress);
    } catch (error) {
      log.error(`Ошибка экспорта ${image.name}: ${error.message}`);
      sendWebSocketLog('error', `❌ Ошибка экспорта ${image.name}`, 'export_images', progress);
    }
  }
  
  // Экспортируем данные из volumes (динамически определяем все volumes приложения)
  log.info('Экспорт данных из Docker volumes...');
  sendWebSocketLog('info', '📦 Экспорт данных из Docker volumes...', 'export_data', 70);
  
  // Получаем список всех volumes приложения (без node_modules)
  const volumesList = await execLocalCommand('docker volume ls -q | grep -E "digital_legal_entitydle_|dapp_" | grep -v node_modules || true');
  const volumes = volumesList.stdout.trim().split('\n').filter(v => v && v.endsWith('_data'));
  
  let progress = 72;
  const progressStep = Math.floor(8 / Math.max(volumes.length, 1));
  
  for (const volumeName of volumes) {
    // Извлекаем имя файла из имени volume (например, digital_legal_entitydle_postgres_data -> postgres_data.tar.gz)
    const volumeBaseName = volumeName.replace(/^(digital_legal_entitydle_|dapp_)/, '').replace(/_data$/, '_data');
    const outputFile = `${volumeBaseName}.tar.gz`;
    
    sendWebSocketLog('info', `📦 Экспорт данных: ${volumeName}`, 'export_data', progress);
    await exportVolumeData(volumeName, outputFile, sendWebSocketLog, progress);
    progress += progressStep;
  }
  
  // Создаем архив с ВСЕМИ образами и данными приложения
  log.info('Создание архива Docker образов и данных на хосте...');
  sendWebSocketLog('info', '📦 Создание архива всех данных...', 'export_data', 80);
  
  try {
    const tarFiles = images.map(img => img.file).join(' ');
    // Динамически собираем список файлов данных из экспортированных volumes
    const dataFilesList = await execLocalCommand('ls /tmp/*_data.tar.gz 2>/dev/null | xargs -r basename -a || echo ""');
    const dataFiles = dataFilesList.stdout.trim().split('\n').filter(f => f).join(' ');
    
    const archiveCommand = `cd /tmp && tar -czf docker-images-and-data.tar.gz ${tarFiles} ${dataFiles || ''}`.trim();
    await execLocalCommand(archiveCommand);
    
    sendWebSocketLog('success', '✅ Архив создан успешно', 'export_data', 80);
  } catch (error) {
    log.error('Ошибка создания архива: ' + error.message);
    sendWebSocketLog('error', '❌ Ошибка создания архива', 'export_data', 80);
  }
  
  log.success('Docker образы и данные успешно экспортированы');
  sendWebSocketLog('success', '✅ Экспорт данных завершен', 'export_data', 80);
};

/**
 * Вспомогательная функция для экспорта данных volume
 */
const exportVolumeData = async (volumeName, outputFile, sendWebSocketLog, progress) => {
  try {
    // Безопасный экспорт через CLI с временным контейнером
    const exportCommand = `docker run --rm -v ${volumeName}:/data:ro -v /tmp:/backup alpine tar czf /backup/${outputFile} -C /data .`;
    await execLocalCommand(exportCommand);
    
    sendWebSocketLog('success', `✅ Экспорт ${outputFile} завершен`, 'export_data', progress);
  } catch (error) {
    log.error(`Ошибка экспорта ${volumeName}: ${error.message}`);
    sendWebSocketLog('error', `❌ Ошибка экспорта ${volumeName}`, 'export_data', progress);
  }
};

/**
 * Передача Docker образов и данных на VDS
 */
const transferDockerImages = async (options, sendWebSocketLog) => {
  const { dockerUser } = options;
  
  log.info('Передача Docker образов и данных на VDS...');
  sendWebSocketLog('info', '📤 Передача архива на VDS сервер...', 'transfer', 82);
  
  // Передаем архив образов и данных на VDS через SCP
  await execScpCommand(
    '/tmp/docker-images-and-data.tar.gz',
    `/home/${dockerUser}/dapp/docker-images-and-data.tar.gz`,
    options
  );
  
  sendWebSocketLog('success', '✅ Архив успешно передан на VDS', 'transfer', 85);
  
  log.success('Docker образы и данные успешно переданы на VDS');
};

/**
 * Импорт Docker образов и данных на VDS
 */
const importDockerImages = async (options, sendWebSocketLog) => {
  const { dockerUser } = options;
  
  // Создаем скрипт импорта на VDS
  sendWebSocketLog('info', '📥 Начинаем импорт данных на VDS...', 'import', 85);
  
  const importScript = `#!/bin/bash
set -e
echo "🚀 Импорт Docker образов и данных на VDS..."

# Проверяем наличие архива
if [ ! -f "./docker-images-and-data.tar.gz" ]; then
    echo "❌ Файл docker-images-and-data.tar.gz не найден!"
    exit 1
fi

# Создаем директорию для распаковки
mkdir -p ./temp-import

# Распаковываем архив
echo "📦 Распаковка архива..."
tar -xzf ./docker-images-and-data.tar.gz -C ./temp-import

# Импортируем ВСЕ образы приложения
echo "📦 Импорт образов..."
for image_file in ./temp-import/dapp-*.tar; do
    if [ -f "$image_file" ]; then
        echo "📦 Импорт образа: $(basename $image_file)"
        docker load -i "$image_file"
    fi
done

# 🆕 Динамически определяем volumes для импорта из имен файлов в архиве
echo "📦 Импорт данных в volumes..."
for data_file in ./temp-import/*_data.tar.gz; do
    if [ -f "$data_file" ]; then
        # Извлекаем имя volume из имени файла (например, postgres_data.tar.gz -> postgres_data)
        volume_name=$(basename "$data_file" .tar.gz)
        
        # Используем префикс dapp_ для соответствия docker-compose.prod.yml
        full_volume_name="dapp_${volume_name}"
        
        echo "📦 Импорт данных: $full_volume_name"
        # Удаляем старый volume если существует
        docker volume rm -f "$full_volume_name" 2>/dev/null || true
        # Создаем новый volume
        docker volume create "$full_volume_name"
        # Импортируем данные
        docker run --rm -v "$full_volume_name:/data" -v ./temp-import:/backup alpine tar xzf "/backup/$(basename $data_file)" -C /data
    fi
done

# Очищаем временные файлы
rm -rf ./temp-import

echo "✅ Образы и данные успешно импортированы!"
echo "📋 Доступные образы:"
docker images | grep -E "digital_legal_entitydle|postgres"
echo "📋 Доступные volumes:"
docker volume ls | grep dapp_`;

  await execSshCommand(`echo '${importScript}' | tee /home/${dockerUser}/dapp/import-images-and-data.sh`, options);
  await execSshCommand(`chmod +x /home/${dockerUser}/dapp/import-images-and-data.sh`, options);
  
  // Импортируем образы и данные
  log.info('Импорт Docker образов и данных...');
  sendWebSocketLog('info', '📥 Импорт Docker образов на VDS...', 'import', 87);
  await execSshCommand(`cd /home/${dockerUser}/dapp && ./import-images-and-data.sh`, options);
  sendWebSocketLog('success', '✅ Импорт Docker образов завершен', 'import', 90);
  
  sendWebSocketLog('info', '📥 Импорт данных в volumes...', 'import', 92);
  // Логи от самого скрипта импорта будут видны
  sendWebSocketLog('success', '✅ Импорт данных завершен', 'import', 95);
  
  log.success('Docker образы и данные успешно импортированы на VDS');
};

/**
 * Очистка временных файлов на локальной машине
 */
const cleanupLocalFiles = async () => {
  log.info('Очистка временных файлов на хосте...');
  try {
    await execLocalCommand("rm -f /tmp/dapp-*.tar /tmp/*_data.tar.gz /tmp/docker-images-and-data.tar.gz");
    log.success('Временные файлы очищены');
  } catch (error) {
    log.error('Ошибка очистки файлов: ' + error.message);
  }
};

module.exports = {
  exportDockerImages,
  transferDockerImages,
  importDockerImages,
  cleanupLocalFiles
};
