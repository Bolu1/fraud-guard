/**
 * Base error class for Fraud Guard
 */
export class FraudGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FraudGuardError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends FraudGuardError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Model-related errors
 */
export class ModelError extends FraudGuardError {
  constructor(message: string) {
    super(message);
    this.name = 'ModelError';
  }
}

/**
 * Validation errors for input data
 */
export class ValidationError extends FraudGuardError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Storage/Database errors
 */
export class StorageError extends FraudGuardError {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Initialization errors
 */
export class InitializationError extends FraudGuardError {
  constructor(message: string) {
    super(message);
    this.name = 'InitializationError';
  }
}

/**
 * Retraining errors
 */
export class RetrainingError extends FraudGuardError {
  constructor(message: string) {
    super(message);
    this.name = 'RetrainingError';
  }
}