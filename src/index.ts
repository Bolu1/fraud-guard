/**
 * Fraud Guard - Main Entry Point
 * Exports all public APIs, types, and utilities
 */

// Main class
export { FraudGuard } from "./core/fraud-guard";

// Interface
export { IFraudGuard } from "./interfaces/fraud-guard.interface";

// Core types
export {
  TransactionData,
  FraudCheckResult,
  FeedbackData,
  ModelInfo,
  FraudGuardConfig,
} from "./interfaces/types";

// Enums
export {
  TransactionCategory,
  RiskLevel,
  Action,
  LogLevel,
  CustomerTransactionFeedbackStatus,
  VelocityCheckType
} from "./interfaces/types";

// Configuration types (for advanced users)
export {
  ProjectConfig,
  StorageConfig,
  ModelConfig,
  RetrainingConfig,
  LoggingConfig,
} from "./interfaces/types";

// Error classes
export {
  FraudGuardError,
  ConfigurationError,
  ModelError,
  ValidationError,
  StorageError,
  InitializationError,
  RetrainingError,
} from "./utils/errors";

// Utility functions (for advanced use cases)
export {
  autoMapCategory,
  getCategoryDescription,
  CATEGORY_GUIDE,
} from "./utils/category-mapper";

export { extractTimeFeatures, formatTimeFeatures } from "./utils/time-features";
