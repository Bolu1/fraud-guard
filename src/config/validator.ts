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

  // Validate model configuration
  if (config.model) {
    validateModelConfig(config.model);
  }

  // Validate storage configuration (if present)
  if (config.storage) {
    validateStorageConfig(config.storage);
  }

  // Validate retraining configuration (if present)
  if (config.retraining) {
    validateRetrainingConfig(config.retraining);
  }
}

/**
 * Validate model configuration
 */
function validateModelConfig(modelConfig: NonNullable<FraudGuardConfig['model']>): void {
  if (modelConfig.thresholds) {
    const { review, reject } = modelConfig.thresholds;

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

  // Validate model path (if provided)
  if (modelConfig.path !== undefined && typeof modelConfig.path !== 'string') {
    throw new ConfigurationError('model.path must be a string');
  }
}

/**
 * Validate storage configuration
 */
function validateStorageConfig(storageConfig: NonNullable<FraudGuardConfig['storage']>): void {
  // Validate path
  if (storageConfig.path !== undefined && typeof storageConfig.path !== 'string') {
    throw new ConfigurationError('storage.path must be a string');
  }

  // Validate retention
  if (storageConfig.retention) {
    const { predictions_days, feedback_days } = storageConfig.retention;

    if (predictions_days !== undefined) {
      if (typeof predictions_days !== 'number' || predictions_days <= 0) {
        throw new ConfigurationError(
          'storage.retention.predictions_days must be a positive number'
        );
      }
    }

    if (feedback_days !== undefined) {
      if (typeof feedback_days !== 'number' || feedback_days <= 0) {
        throw new ConfigurationError(
          'storage.retention.feedback_days must be a positive number'
        );
      }
    }
  }
}

/**
 * Validate retraining configuration
 */
function validateRetrainingConfig(
  retrainingConfig: NonNullable<FraudGuardConfig['retraining']>
): void {
  // Validate enabled flag
  if (retrainingConfig.enabled !== undefined && typeof retrainingConfig.enabled !== 'boolean') {
    throw new ConfigurationError('retraining.enabled must be a boolean');
  }

  // Validate python_path
  if (retrainingConfig.python_path !== undefined) {
    if (typeof retrainingConfig.python_path !== 'string') {
      throw new ConfigurationError('retraining.python_path must be a string');
    }
  }

  // Validate min_samples
  if (retrainingConfig.min_samples !== undefined) {
    if (
      typeof retrainingConfig.min_samples !== 'number' ||
      retrainingConfig.min_samples <= 0
    ) {
      throw new ConfigurationError('retraining.min_samples must be a positive number');
    }
  }

  // Validate schedule (basic check - just ensure it's a string)
  if (retrainingConfig.schedule !== undefined) {
    if (typeof retrainingConfig.schedule !== 'string') {
      throw new ConfigurationError('retraining.schedule must be a string (cron expression)');
    }
  }
}

/**
 * Validate thresholds specifically (can be used independently)
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
