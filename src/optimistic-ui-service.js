class OptimisticUIService {
  constructor() {
    this.pendingOperations = new Map();
    this.operationTimeout = 30000; // 30 seconds timeout
    this.maxRetries = 3;
  }

  // Create an optimistic operation
  createOperation(operationId, operation, rollback) {
    const operationData = {
      id: operationId,
      operation,
      rollback,
      status: 'pending',
      createdAt: Date.now(),
      retries: 0,
      timeout: null
    };

    this.pendingOperations.set(operationId, operationData);

    // Set timeout for automatic rollback
    operationData.timeout = setTimeout(() => {
      this.rollbackOperation(operationId, 'timeout');
    }, this.operationTimeout);

    return operationData;
  }

  // Confirm an operation succeeded
  confirmOperation(operationId, result) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      return { success: false, error: 'Operation not found' };
    }

    // Clear timeout
    if (operation.timeout) {
      clearTimeout(operation.timeout);
    }

    // Mark as confirmed
    operation.status = 'confirmed';
    operation.result = result;
    operation.confirmedAt = Date.now();

    // Remove from pending operations
    this.pendingOperations.delete(operationId);

    return { success: true, operation };
  }

  // Rollback an operation
  rollbackOperation(operationId, reason = 'manual') {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      return { success: false, error: 'Operation not found' };
    }

    // Clear timeout
    if (operation.timeout) {
      clearTimeout(operation.timeout);
    }

    try {
      // Execute rollback
      if (operation.rollback && typeof operation.rollback === 'function') {
        operation.rollback();
      }

      operation.status = 'rolled_back';
      operation.rollbackReason = reason;
      operation.rolledBackAt = Date.now();

      // Remove from pending operations
      this.pendingOperations.delete(operationId);

      return { success: true, operation };
    } catch (error) {
      operation.status = 'rollback_failed';
      operation.rollbackError = error.message;
      operation.rolledBackAt = Date.now();

      return { success: false, error: error.message, operation };
    }
  }

  // Retry a failed operation
  retryOperation(operationId) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      return { success: false, error: 'Operation not found' };
    }

    if (operation.retries >= this.maxRetries) {
      return { success: false, error: 'Maximum retries exceeded' };
    }

    operation.retries++;
    operation.status = 'retrying';
    operation.lastRetryAt = Date.now();

    // Reset timeout
    if (operation.timeout) {
      clearTimeout(operation.timeout);
    }

    operation.timeout = setTimeout(() => {
      this.rollbackOperation(operationId, 'retry_timeout');
    }, this.operationTimeout);

    return { success: true, operation };
  }

  // Get operation status
  getOperationStatus(operationId) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      return { success: false, error: 'Operation not found' };
    }

    return { success: true, operation };
  }

  // Get all pending operations
  getPendingOperations() {
    const operations = Array.from(this.pendingOperations.values());
    return {
      success: true,
      operations,
      count: operations.length
    };
  }

  // Clean up old operations
  cleanupOldOperations(maxAge = 300000) { // 5 minutes default
    const now = Date.now();
    const toRemove = [];

    this.pendingOperations.forEach((operation, operationId) => {
      if (now - operation.createdAt > maxAge) {
        toRemove.push(operationId);
      }
    });

    toRemove.forEach(operationId => {
      this.rollbackOperation(operationId, 'cleanup');
    });

    return {
      success: true,
      cleanedCount: toRemove.length,
      message: `Cleaned up ${toRemove.length} old operations`
    };
  }

  // Job pipeline optimistic operations
  createJobPipelineOperation(operationId, jobId, fromStage, toStage, candidateId = null) {
    const operation = {
      type: 'job_pipeline_move',
      jobId,
      fromStage,
      toStage,
      candidateId,
      timestamp: Date.now()
    };

    const rollback = () => {
      // Rollback logic for job pipeline moves
      console.log(`[optimistic-ui] Rolling back job ${jobId} from ${toStage} to ${fromStage}`);
      // In a real implementation, this would call the API to move the job back
    };

    return this.createOperation(operationId, operation, rollback);
  }

  // Candidate assignment optimistic operations
  createCandidateAssignmentOperation(operationId, candidateId, jobId, action = 'assign') {
    const operation = {
      type: 'candidate_assignment',
      candidateId,
      jobId,
      action, // 'assign' or 'unassign'
      timestamp: Date.now()
    };

    const rollback = () => {
      // Rollback logic for candidate assignments
      const reverseAction = action === 'assign' ? 'unassign' : 'assign';
      console.log(`[optimistic-ui] Rolling back candidate ${candidateId} ${reverseAction} from job ${jobId}`);
      // In a real implementation, this would call the API to reverse the assignment
    };

    return this.createOperation(operationId, operation, rollback);
  }

  // Bulk operations
  createBulkOperation(operationId, operations, rollback) {
    const operation = {
      type: 'bulk_operation',
      operations,
      count: operations.length,
      timestamp: Date.now()
    };

    return this.createOperation(operationId, operation, rollback);
  }

  // Get operation statistics
  getOperationStats() {
    const operations = Array.from(this.pendingOperations.values());
    const stats = {
      total: operations.length,
      pending: operations.filter(op => op.status === 'pending').length,
      retrying: operations.filter(op => op.status === 'retrying').length,
      confirmed: operations.filter(op => op.status === 'confirmed').length,
      rolledBack: operations.filter(op => op.status === 'rolled_back').length,
      failed: operations.filter(op => op.status === 'rollback_failed').length,
      averageAge: operations.length > 0 
        ? operations.reduce((sum, op) => sum + (Date.now() - op.createdAt), 0) / operations.length 
        : 0
    };

    return {
      success: true,
      stats,
      timestamp: new Date().toISOString()
    };
  }

  // Validate operation data
  validateOperation(operation) {
    const errors = [];

    if (!operation.id) {
      errors.push('Operation ID is required');
    }

    if (!operation.operation) {
      errors.push('Operation data is required');
    }

    if (!operation.rollback || typeof operation.rollback !== 'function') {
      errors.push('Rollback function is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get service configuration
  getConfig() {
    return {
      operationTimeout: this.operationTimeout,
      maxRetries: this.maxRetries,
      pendingOperations: this.pendingOperations.size,
      features: [
        'optimistic-operations',
        'automatic-rollback',
        'retry-mechanism',
        'bulk-operations',
        'job-pipeline-moves',
        'candidate-assignments'
      ]
    };
  }
}

module.exports = OptimisticUIService;
