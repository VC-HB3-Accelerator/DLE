const { execSshCommand } = require('./sshUtils');
const log = require('./logger');

/**
 * Создание пользователя с SSH ключами
 */
const createUserWithSshKeys = async (username, publicKey, options) => {
  log.info(`Создание пользователя ${username}...`);
  
  // Создание пользователя
  await execSshCommand(`useradd -m -s /bin/bash ${username} || true`, options);
  await execSshCommand(`usermod -aG sudo ${username}`, options);
  
  // Настройка SSH ключей для пользователя
  await execSshCommand(`mkdir -p /home/${username}/.ssh`, options);
  // Используем printf для безопасной обработки специальных символов в ключе
  // Экранируем обратные слеши и знаки доллара в публичном ключе
  const escapedPublicKey = publicKey.replace(/\\/g, '\\\\').replace(/\$/g, '\\$');
  await execSshCommand(`printf '%s\\n' "${escapedPublicKey}" > /home/${username}/.ssh/authorized_keys`, options);
  await execSshCommand(`chown -R ${username}:${username} /home/${username}/.ssh`, options);
  await execSshCommand(`chmod 700 /home/${username}/.ssh`, options);
  await execSshCommand(`chmod 600 /home/${username}/.ssh/authorized_keys`, options);
  
  log.success(`Пользователь ${username} создан с SSH ключами`);
};

/**
 * Создание всех необходимых пользователей
 */
const createAllUsers = async (ubuntuUser, dockerUser, publicKey, options) => {
  // Создание пользователя Ubuntu
  await createUserWithSshKeys(ubuntuUser, publicKey, options);
  
  // Создание пользователя Docker
  await createUserWithSshKeys(dockerUser, publicKey, options);
  
  // Добавление пользователя Docker в группу docker
  await execSshCommand(`usermod -aG docker ${dockerUser}`, options);
  
  // Создание директории для приложения
  await execSshCommand(`mkdir -p /home/${dockerUser}/dapp`, options);
  await execSshCommand(`chown ${dockerUser}:${dockerUser} /home/${dockerUser}/dapp`, options);
  
  log.success('Все пользователи созданы');
};

module.exports = {
  createUserWithSshKeys,
  createAllUsers
};
