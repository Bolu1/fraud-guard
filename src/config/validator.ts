import { FraudGuardConfig } from '../interfaces/types';
import { ConfigurationError } from '../utils/errors';

/**
 * Validate complete configuration
 * Throws ConfigurationError if invalid
 */
export function validateConfig(config: FraudGuardConfig): void {
  if (!config) {
    throw new ConfigurationError('Configuration is null or undefined');
  }

  // Validate project
  validateProjectConfig(config.project);

  // Validate storage
  if (config.storage) {
    validateStorageConfig(config.storage);
  }

  // Validate threshold
  if (config.thresholds) {
    validateThresholdConfig(config.thresholds)
  }

  // Validate model
  if (config.model) {
    validateModelConfig(config.model);
  }

  // Validate retraining
  if (config.retraining) {
    validateRetrainingConfig(config.retraining);
  }

  // Validate logging
  if (config.logging) {
    validateLoggingConfig(config.logging);
  }
}

/**
 * Validate project configuration
 */
function validateProjectConfig(projectConfig: FraudGuardConfig['project']): void {
  if (!projectConfig) {
    throw new ConfigurationError('Project configuration is required');
  }

  if (!projectConfig.name) {
    throw new ConfigurationError('project.name is required');
  }

  if (typeof projectConfig.name !== 'string') {
    throw new ConfigurationError('project.name must be a string');
  }

  if (projectConfig.name.trim().length === 0) {
    throw new ConfigurationError('project.name cannot be empty');
  }

  // Validate project name doesn't contain invalid characters
  const invalidChars = /[<>:"|?*\/\\]/;
  if (invalidChars.test(projectConfig.name)) {
    throw new ConfigurationError(
      'project.name contains invalid characters. Avoid: < > : " | ? * / \\'
    );
  }
}

/**
 * Validate storage configuration
 */
function validateStorageConfig(storageConfig: NonNullable<FraudGuardConfig['storage']>): void {
  if (storageConfig.path !== undefined && typeof storageConfig.path !== 'string') {
    throw new ConfigurationError('storage.path must be a string');
  }

  if (storageConfig.retention) {
    const { predictions_days } = storageConfig.retention;

    if (predictions_days !== undefined) {
      if (typeof predictions_days !== 'number' || predictions_days <= 0) {
        throw new ConfigurationError(
          'storage.retention.predictions_days must be a positive number'
        );
      }
    }
  }
}

/**
 * Validate model configuration
 */
function validateModelConfig(modelConfig: NonNullable<FraudGuardConfig['model']>): void {
  if (modelConfig.path !== undefined && typeof modelConfig.path !== 'string') {
    throw new ConfigurationError('model.path must be a string');
  }
}

/**
 * Validate threshold configuration
 */
function validateThresholdConfig(thresholds: NonNullable<FraudGuardConfig['thresholds']>): void {
  if (thresholds) {
    const { review, reject } = thresholds;

    // Validate review threshold
    if (review !== undefined) {
      if (typeof review !== 'number') {
        throw new ConfigurationError('model.thresholds.review must be a number');
      }
      if (review < 0 || review > 1) {
        throw new ConfigurationError(
          `model.thresholds.review must be between 0 and 1, got ${review}`
        );
      }
    }

    // Validate reject threshold
    if (reject !== undefined) {
      if (typeof reject !== 'number') {
        throw new ConfigurationError('model.thresholds.reject must be a number');
      }
      if (reject < 0 || reject > 1) {
        throw new ConfigurationError(
          `model.thresholds.reject must be between 0 and 1, got ${reject}`
        );
      }
    }

    // Ensure review < reject
    if (review !== undefined && reject !== undefined && review >= reject) {
      throw new ConfigurationError(
        `model.thresholds.review (${review}) must be less than reject (${reject})`
      );
    }
  }
}

/**
 * Validate retraining configuration
 */
function validateRetrainingConfig(
  retrainingConfig: NonNullable<FraudGuardConfig['retraining']>
): void {
  if (retrainingConfig.enabled !== undefined && typeof retrainingConfig.enabled !== 'boolean') {
    throw new ConfigurationError('retraining.enabled must be a boolean');
  }

  if (retrainingConfig.python_path !== undefined) {
    if (typeof retrainingConfig.python_path !== 'string') {
      throw new ConfigurationError('retraining.python_path must be a string');
    }
  }

  if (retrainingConfig.min_samples !== undefined) {
    if (
      typeof retrainingConfig.min_samples !== 'number' ||
      retrainingConfig.min_samples <= 0
    ) {
      throw new ConfigurationError('retraining.min_samples must be a positive number');
    }
  }

  if (retrainingConfig.schedule !== undefined) {
    if (typeof retrainingConfig.schedule !== 'string') {
      throw new ConfigurationError('retraining.schedule must be a string (cron expression)');
    }
  }
}

/**
 * Validate logging configuration
 */
function validateLoggingConfig(loggingConfig: NonNullable<FraudGuardConfig['logging']>): void {
  if (loggingConfig.level !== undefined) {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(loggingConfig.level)) {
      throw new ConfigurationError(`logging.level must be one of: ${validLevels.join(', ')}`);
    }
  }

  if (loggingConfig.console !== undefined && typeof loggingConfig.console !== 'boolean') {
    throw new ConfigurationError('logging.console must be a boolean');
  }
}

/**
 * Validate thresholds specifically
 */
export function validateThresholds(review: number, reject: number): void {
  if (review < 0 || review > 1) {
    throw new ConfigurationError(`Review threshold must be between 0 and 1, got ${review}`);
  }

  if (reject < 0 || reject > 1) {
    throw new ConfigurationError(`Reject threshold must be between 0 and 1, got ${reject}`);
  }

  if (review >= reject) {
    throw new ConfigurationError(
      `Review threshold (${review}) must be less than reject threshold (${reject})`
    );
  }
}