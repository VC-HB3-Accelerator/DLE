const chalk = require('chalk');

const log = {
  info: (message) => console.log(chalk.blue('[INFO]'), message),
  success: (message) => console.log(chalk.green('[SUCCESS]'), message),
  error: (message) => console.log(chalk.red('[ERROR]'), message),
  warn: (message) => console.log(chalk.yellow('[WARN]'), message)
};

module.exports = log;
