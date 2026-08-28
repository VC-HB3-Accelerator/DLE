/**
 * Глобальный mutex на hardhat-деплой в одном процессе backend.
 * Параллельные `hardhat run` портят artifacts (пустые .dbg.json) и гоняют nonce → сжигание газа.
 */

class DeployProcessLock {
  constructor() {
    this.busy = false;
    this.owner = null;
    this.since = null;
  }

  isBusy() {
    return this.busy;
  }

  status() {
    return {
      busy: this.busy,
      owner: this.owner,
      since: this.since,
    };
  }

  /**
   * @param {string} owner - deploymentId или метка
   * @param {number} timeoutMs
   */
  async acquire(owner = 'deploy', timeoutMs = 15 * 60 * 1000) {
    const started = Date.now();
    while (this.busy) {
      if (Date.now() - started > timeoutMs) {
        throw new Error(
          `Другой деплой уже выполняется (${this.owner || 'unknown'} с ${this.since || '?'}). ` +
            'Параллельный hardhat ломает artifacts и сжигает nonce/газ. Дождитесь завершения.'
        );
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    this.busy = true;
    this.owner = owner;
    this.since = new Date().toISOString();
  }

  release(owner = null) {
    if (owner && this.owner && owner !== this.owner) {
      return;
    }
    this.busy = false;
    this.owner = null;
    this.since = null;
  }
}

const deployProcessLock = new DeployProcessLock();

module.exports = {
  DeployProcessLock,
  deployProcessLock,
};
