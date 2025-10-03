const { execSshCommand } = require('./sshUtils');
const log = require('./logger');

/**
 * Создание пользователя с SSH ключами
 */
const createUserWithSshKeys = async (username, publicKey, options) => {
  log.info(`Создание пользователя ${username}...`);
  
  // Создание пользователя
  await execSshCommand(`sudo useradd -m -s /bin/bash ${username} || true`, options);
  await execSshCommand(`sudo usermod -aG sudo ${username}`, options);
  
  // Настройка SSH ключей для пользователя
  await execSshCommand(`sudo mkdir -p /home/${username}/.ssh`, options);
  await execSshCommand(`echo "${publicKey}" | sudo tee /home/${username}/.ssh/authorized_keys`, options);
  await execSshCommand(`sudo chown -R ${username}:${username} /home/${username}/.ssh`, options);
  await execSshCommand(`sudo chmod 700 /home/${username}/.ssh`, options);
  await execSshCommand(`sudo chmod 600 /home/${username}/.ssh/authorized_keys`, options);
  
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
  await execSshCommand(`sudo usermod -aG docker ${dockerUser}`, options);
  
  // Создание директории для приложения
  await execSshCommand(`sudo mkdir -p /home/${dockerUser}/dapp`, options);
  await execSshCommand(`sudo chown ${dockerUser}:${dockerUser} /home/${dockerUser}/dapp`, options);
  
  log.success('Все пользователи созданы');
};

module.exports = {
  createUserWithSshKeys,
  createAllUsers
};
