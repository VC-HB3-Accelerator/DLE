/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

const crypto = require('crypto');
const EventEmitter = require('events');

class DeploymentTracker extends EventEmitter {
  constructor() {
    super();
    this.deployments = new Map(); // В продакшене использовать Redis
    this.logger = require('../utils/logger');
  }
  
  // Создать новый деплой
  createDeployment(params) {
    const deploymentId = this.generateDeploymentId();
    
    const deployment = {
      id: deploymentId,
      status: 'pending',
      stage: 'initializing',
      progress: 0,
      startedAt: new Date(),
      updatedAt: new Date(),
      params,
      networks: {},
      logs: [],
      result: null,
      error: null
    };
    
    this.deployments.set(deploymentId, deployment);
    this.logger.info(`📝 Создан новый деплой: ${deploymentId}`);
    
    return deploymentId;
  }
  
  // Получить статус деплоя
  getDeployment(deploymentId) {
    return this.deployments.get(deploymentId);
  }
  
  // Обновить статус деплоя
  updateDeployment(deploymentId, updates) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      this.logger.error(`❌ Деплой не найден: ${deploymentId}`);
      return false;
    }
    
    Object.assign(deployment, updates, { updatedAt: new Date() });
    this.deployments.set(deploymentId, deployment);
    
    // Отправляем событие через WebSocket
    this.emit('deployment_updated', {
      deploymentId,
      ...updates
    });
    
    return true;
  }
  
  // Добавить лог
  addLog(deploymentId, message, type = 'info') {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return false;
    
    const logEntry = {
      timestamp: new Date(),
      message,
      type
    };
    
    deployment.logs.push(logEntry);
    deployment.updatedAt = new Date();
    
    // Отправляем только лог через WebSocket (без дублирования)
    this.emit('deployment_updated', {
      deploymentId,
      type: 'deployment_log',
      log: logEntry
    });
    
    return true;
  }
  
  // Обновить статус сети
  updateNetworkStatus(deploymentId, network, status, address = null, message = null) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return false;
    
    deployment.networks[network] = {
      status,
      address,
      message,
      updatedAt: new Date()
    };
    
    deployment.updatedAt = new Date();
    
    // Отправляем обновление через WebSocket
    this.emit('deployment_updated', {
      deploymentId,
      type: 'deployment_network_update',
      network,
      status,
      address,
      message
    });
    
    return true;
  }
  
  // Обновить прогресс
  updateProgress(deploymentId, stage, progress, message = null) {
    const updates = {
      stage,
      progress,
      status: progress >= 100 ? 'completed' : 'in_progress'
    };
    
    // Обновляем без отправки события (только внутреннее обновление)
    const deployment = this.deployments.get(deploymentId);
    if (deployment) {
      Object.assign(deployment, updates, { updatedAt: new Date() });
      this.deployments.set(deploymentId, deployment);
    }
    
    // Лог добавляется через updateDeployment, не дублируем событие
  }
  
  // Завершить деплой успешно
  completeDeployment(deploymentId, result) {
    const updates = {
      status: 'completed',
      progress: 100,
      result,
      completedAt: new Date()
    };
    
    this.updateDeployment(deploymentId, updates);
    
    // Событие уже отправлено через updateDeployment
    
    this.logger.info(`✅ Деплой завершен: ${deploymentId}`);
  }
  
  // Завершить деплой с ошибкой
  failDeployment(deploymentId, error) {
    const updates = {
      status: 'failed',
      error: error.message || error,
      failedAt: new Date()
    };
    
    this.updateDeployment(deploymentId, updates);
    
    // Событие уже отправлено через updateDeployment
    
    this.logger.error(`❌ Деплой провален: ${deploymentId}`, error);
  }
  
  // Очистить старые деплои (вызывать по крону)
  cleanupOldDeployments(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [id, deployment] of this.deployments.entries()) {
      if (deployment.updatedAt < cutoff && ['completed', 'failed'].includes(deployment.status)) {
        this.deployments.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.info(`🧹 Очищено ${cleaned} старых деплоев`);
    }
  }
  
  // Сгенерировать уникальный ID
  generateDeploymentId() {
    return `deploy_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
  
  // Получить все активные деплои
  getActiveDeployments() {
    const active = [];
    for (const deployment of this.deployments.values()) {
      if (['pending', 'in_progress'].includes(deployment.status)) {
        active.push(deployment);
      }
    }
    return active;
  }
  
  // Получить статистику
  getStats() {
    const stats = {
      total: this.deployments.size,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0
    };
    
    for (const deployment of this.deployments.values()) {
      switch (deployment.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'in_progress':
          stats.inProgress++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
    }
    
    return stats;
  }
}

// Singleton экземпляр
const deploymentTracker = new DeploymentTracker();

module.exports = deploymentTracker;
