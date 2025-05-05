import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chalk from 'chalk'; // Для цветного вывода

// ES модули не поддерживают __dirname, поэтому создаем его
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверка наличия пакета chalk и его установка при необходимости
try {
  import('chalk');
} catch (e) {
  console.log('Устанавливаем пакет chalk для цветного вывода...');
  execSync('yarn add chalk --dev', { stdio: 'inherit' });
  console.log('Пакет chalk установлен.');
}

// Функция для проверки наличия файла
function checkFileExists(filePath, errorMessage) {
  const fullPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(chalk.red(errorMessage));
    process.exit(1);
  }
  console.log(chalk.green(`✓ Файл ${path.basename(filePath)} найден`));
}

// Функция для проверки импортов стилей в App.vue
function checkStyleImports() {
  const appVuePath = path.resolve(__dirname, '..', 'src', 'App.vue');
  try {
    const appVueContent = fs.readFileSync(appVuePath, 'utf8');
    
    const requiredImports = [
      './assets/styles/variables.css',
      './assets/styles/base.css',
      './assets/styles/layout.css',
      './assets/styles/global.css'
    ];
    
    let allImportsFound = true;
    
    for (const importPath of requiredImports) {
      if (!appVueContent.includes(`import '${importPath}'`)) {
        console.log(chalk.red(`✗ Импорт ${importPath} не найден в App.vue!`));
        allImportsFound = false;
      } else {
        console.log(chalk.green(`✓ Импорт ${importPath} найден в App.vue`));
      }
    }
    
    if (!allImportsFound) {
      console.log(chalk.yellow('Убедитесь, что в App.vue импортируются все нужные стили:'));
      requiredImports.forEach(imp => console.log(`  import '${imp}';`));
    }
  } catch (error) {
    console.log(chalk.red(`Ошибка при чтении App.vue: ${error.message}`));
    process.exit(1);
  }
}

// Функция для проверки компонентов настроек
function checkSettingsComponents() {
  const settingsDir = path.resolve(__dirname, '..', 'src', 'components', 'settings');
  const requiredComponents = [
    'AISettings.vue',
    'BlockchainSettings.vue',
    'SecuritySettings.vue',
    'InterfaceSettings.vue'
  ];
  
  for (const component of requiredComponents) {
    const componentPath = path.join(settingsDir, component);
    if (fs.existsSync(componentPath)) {
      console.log(chalk.green(`✓ Компонент ${component} найден`));
    } else {
      console.log(chalk.red(`✗ Компонент ${component} не найден!`));
    }
  }
}

// Запуск скрипта
console.log(chalk.blue('======================================='));
console.log(chalk.green('Запуск проекта с обновленными стилями'));
console.log(chalk.blue('======================================='));

// Проверка наличия всех файлов стилей
checkFileExists('src/assets/styles/global.css', 'Ошибка: файл global.css не найден!');
checkFileExists('src/assets/styles/variables.css', 'Ошибка: файл variables.css не найден!');
checkFileExists('src/assets/styles/base.css', 'Ошибка: файл base.css не найден!');
checkFileExists('src/assets/styles/layout.css', 'Ошибка: файл layout.css не найден!');

// Проверка импортов стилей
console.log(chalk.yellow('Проверка imports стилей...'));
checkStyleImports();

// Проверка компонентов настроек
checkSettingsComponents();

console.log(chalk.blue('---------------------------------------'));
console.log(chalk.yellow('Запуск сервера разработки...'));
console.log(chalk.blue('---------------------------------------'));

// Выходим успешно, т.к. сам запуск выполняется командой yarn dev:styles
try {
  process.exit(0);
} catch (error) {
  console.log(chalk.red(`Ошибка при запуске сервера разработки: ${error.message}`));
  process.exit(1);
} 