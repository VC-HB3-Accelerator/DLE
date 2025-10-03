const { exec } = require('child_process');
const { execSshCommand, execScpCommand } = require('./sshUtils');
const log = require('./logger');

/**
 * Экспорт Docker образов и данных с локальной машины
 */
const exportDockerImages = async (sendWebSocketLog) => {
  log.info('Экспорт Docker образов и данных с хоста...');
  sendWebSocketLog('info', '📦 Начинаем экспорт Docker образов...', 'export_images', 60);
  
  const images = [
    { name: 'postgres:16-alpine', file: 'dapp-postgres.tar' },
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
    
    await new Promise((resolve) => {
      exec(`docker save ${image.name} -o /tmp/${image.file}`, (error, stdout, stderr) => {
        if (error) {
          log.error(`Ошибка экспорта ${image.name}: ${error.message}`);
          sendWebSocketLog('error', `❌ Ошибка экспорта ${image.name}`, 'export_images', progress);
        } else {
          sendWebSocketLog('success', `✅ Экспорт ${image.name} завершен`, 'export_images', progress);
        }
        resolve();
      });
    });
  }
  
  // Экспортируем данные из volumes
  log.info('Экспорт данных из Docker volumes...');
  sendWebSocketLog('info', '📦 Экспорт данных из Docker volumes...', 'export_data', 70);
  
  // PostgreSQL данные - проверяем наличие данных перед экспортом
  sendWebSocketLog('info', '📦 Экспорт данных PostgreSQL...', 'export_data', 72);
  await new Promise((resolve) => {
    // Сначала проверим, есть ли данные в volume
    exec('docker run --rm -v digital_legal_entitydle_postgres_data:/data alpine ls -la /data/base', (checkError, checkStdout, checkStderr) => {
      if (checkError) {
        log.error(`Ошибка проверки данных PostgreSQL: ${checkError.message}`);
        sendWebSocketLog('error', `❌ Ошибка проверки данных PostgreSQL`, 'export_data', 72);
        resolve();
        return;
      }
      
      // Если данные есть, экспортируем их
      exec('docker run --rm -v digital_legal_entitydle_postgres_data:/data -v /tmp:/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .', (error, stdout, stderr) => {
        if (error) {
          log.error(`Ошибка экспорта данных PostgreSQL: ${error.message}`);
          sendWebSocketLog('error', `❌ Ошибка экспорта данных PostgreSQL`, 'export_data', 72);
        } else {
          log.info(`Данные PostgreSQL экспортированы: ${checkStdout.trim()}`);
          sendWebSocketLog('success', `✅ Экспорт данных PostgreSQL завершен (содержит базы данных)`, 'export_data', 72);
        }
        resolve();
      });
    });
  });
  
  // Ollama данные
  sendWebSocketLog('info', '📦 Экспорт данных Ollama...', 'export_data', 75);
  await new Promise((resolve) => {
    exec('docker run --rm -v digital_legal_entitydle_ollama_data:/data -v /tmp:/backup alpine tar czf /backup/ollama_data.tar.gz -C /data .', (error, stdout, stderr) => {
      if (error) {
        log.error(`Ошибка экспорта данных Ollama: ${error.message}`);
        sendWebSocketLog('error', `❌ Ошибка экспорта данных Ollama`, 'export_data', 75);
      } else {
        sendWebSocketLog('success', `✅ Экспорт данных Ollama завершен`, 'export_data', 75);
      }
      resolve();
    });
  });
  
  // Vector Search данные
  sendWebSocketLog('info', '📦 Экспорт данных Vector Search...', 'export_data', 78);
  await new Promise((resolve) => {
    exec('docker run --rm -v digital_legal_entitydle_vector_search_data:/data -v /tmp:/backup alpine tar czf /backup/vector_search_data.tar.gz -C /data .', (error, stdout, stderr) => {
      if (error) {
        log.error(`Ошибка экспорта данных Vector Search: ${error.message}`);
        sendWebSocketLog('error', `❌ Ошибка экспорта данных Vector Search`, 'export_data', 78);
      } else {
        sendWebSocketLog('success', `✅ Экспорт данных Vector Search завершен`, 'export_data', 78);
      }
      resolve();
    });
  });
  
  // Проверяем размеры экспортированных данных
  log.info('Проверка размеров экспортированных данных...');
  sendWebSocketLog('info', '📊 Проверка размеров экспортированных данных...', 'export_data', 78);
  
  await new Promise((resolve) => {
    exec('ls -lh /tmp/postgres_data.tar.gz /tmp/ollama_data.tar.gz /tmp/vector_search_data.tar.gz 2>/dev/null || echo "Некоторые файлы не найдены"', (error, stdout, stderr) => {
      if (stdout && stdout.trim()) {
        log.info(`Размеры экспортированных данных:\n${stdout.trim()}`);
        sendWebSocketLog('info', `📊 Размеры данных:\n${stdout.trim()}`, 'export_data', 78);
      }
      resolve();
    });
  });
  
  // Создаем архив с ВСЕМИ образами и данными приложения
  log.info('Создание архива Docker образов и данных на хосте...');
  sendWebSocketLog('info', '📦 Создание архива всех данных...', 'export_data', 80);
  
  const tarFiles = images.map(img => img.file).join(' ');
  const dataFiles = 'postgres_data.tar.gz ollama_data.tar.gz vector_search_data.tar.gz';
  await new Promise((resolve) => {
    exec(`chmod 644 /tmp/dapp-*.tar /tmp/*_data.tar.gz && cd /tmp && tar -czf docker-images-and-data.tar.gz ${tarFiles} ${dataFiles}`, (error, stdout, stderr) => {
      if (error) {
        log.error('Ошибка создания архива: ' + error.message);
        sendWebSocketLog('error', '❌ Ошибка создания архива', 'export_data', 80);
      } else {
        // Проверяем размер финального архива
        exec('ls -lh /tmp/docker-images-and-data.tar.gz', (sizeError, sizeStdout, sizeStderr) => {
          if (sizeStdout && sizeStdout.trim()) {
            log.info(`Финальный архив создан: ${sizeStdout.trim()}`);
            sendWebSocketLog('success', `✅ Архив создан успешно (${sizeStdout.trim()})`, 'export_data', 80);
          } else {
            sendWebSocketLog('success', '✅ Архив создан успешно', 'export_data', 80);
          }
          resolve();
        });
      }
    });
  });
  
  log.success('Docker образы и данные успешно экспортированы');
  sendWebSocketLog('success', '✅ Экспорт данных завершен', 'export_data', 80);
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
echo "📦 Импорт образа postgres..."
docker load -i ./temp-import/dapp-postgres.tar

echo "📦 Импорт образа ollama..."
docker load -i ./temp-import/dapp-ollama.tar

echo "📦 Импорт образа vector-search..."
docker load -i ./temp-import/dapp-vector-search.tar

echo "📦 Импорт образа backend..."
docker load -i ./temp-import/dapp-backend.tar

echo "📦 Импорт образа frontend..."
docker load -i ./temp-import/dapp-frontend.tar

echo "📦 Импорт образа frontend-nginx..."
docker load -i ./temp-import/dapp-frontend-nginx.tar

echo "📦 Импорт образа webssh-agent..."
docker load -i ./temp-import/dapp-webssh-agent.tar

# 🆕 Импортируем данные в volumes с правильными именами для соответствия docker-compose
echo "📦 Импорт данных PostgreSQL..."
# Удаляем старый volume если существует
docker volume rm dapp_postgres_data 2>/dev/null || true
docker volume create dapp_postgres_data
docker run --rm -v dapp_postgres_data:/data -v ./temp-import:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data

echo "📦 Импорт данных Ollama..."
# Удаляем старый volume если существует
docker volume rm dapp_ollama_data 2>/dev/null || true
docker volume create dapp_ollama_data
docker run --rm -v dapp_ollama_data:/data -v ./temp-import:/backup alpine tar xzf /backup/ollama_data.tar.gz -C /data

echo "📦 Импорт данных Vector Search..."
# Удаляем старый volume если существует
docker volume rm dapp_vector_search_data 2>/dev/null || true
docker volume create dapp_vector_search_data
docker run --rm -v dapp_vector_search_data:/data -v ./temp-import:/backup alpine tar xzf /backup/vector_search_data.tar.gz -C /data

# Очищаем временные файлы
rm -rf ./temp-import

echo "✅ Образы и данные успешно импортированы!"
echo "📋 Доступные образы:"
docker images | grep -E "digital_legal_entitydle|postgres"
echo "📋 Доступные volumes:"
docker volume ls | grep dapp_`;

  await execSshCommand(`echo '${importScript}' | sudo tee /home/${dockerUser}/dapp/import-images-and-data.sh`, options);
  await execSshCommand(`sudo chmod +x /home/${dockerUser}/dapp/import-images-and-data.sh`, options);
  
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
  await new Promise((resolve) => {
    exec('rm -f /tmp/dapp-*.tar /tmp/*_data.tar.gz /tmp/docker-images-and-data.tar.gz', (error, stdout, stderr) => {
      if (error) log.error('Ошибка очистки файлов: ' + error.message);
      resolve();
    });
  });
  log.success('Временные файлы очищены (SSH ключи сохранены на хосте)');
};

module.exports = {
  exportDockerImages,
  transferDockerImages,
  importDockerImages,
  cleanupLocalFiles
};
