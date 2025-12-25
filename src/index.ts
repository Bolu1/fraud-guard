// Main class
export { FraudGuard } from './core/fraud-guard';

// Interface
export type { IFraudGuard } from './interfaces/fraud-guard.interface';


// Types
export type {
  TransactionData,
  FraudCheckResult,
  FraudGuardConfig,
  ModelMetadata,
  FeatureVector,
  StorageConfig,
  ModelConfig,
  RetrainingConfig,
  FeaturesConfig,
  LoggingConfig,
} from './interfaces/types';

// Enums
export { TransactionType, RiskLevel, Action, LogLevel } from './interfaces/types';

// Errors (users might want to catch specific errors)
export {
  FraudGuardError,
  ConfigurationError,
  ModelError,
  ValidationError,
  StorageError,
  InitializationError,
  RetrainingError,
} from './utils/errors';