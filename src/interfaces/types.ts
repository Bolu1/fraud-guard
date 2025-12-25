// ===== Enums =====

export enum TransactionType {
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
  DEBIT = 'DEBIT',
  PAYMENT = 'PAYMENT',
  TRANSFER = 'TRANSFER'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum Action {
  ACCEPT = 'accept',
  REVIEW = 'review',
  REJECT = 'reject'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// ===== Transaction Input =====

export interface TransactionData {
  // Required fields
  step: number;                           // Time step
  type: TransactionType;                  // Transaction type
  amount: number;                         // Transaction amount
  
  // Origin account balances
  oldBalanceOrigin: number;               // Balance before transaction
  newBalanceOrigin: number;               // Balance after transaction
  
  // Destination account balances
  oldBalanceDestination: number;          // Balance before transaction
  newBalanceDestination: number;          // Balance after transaction
  
  // Optional fields
  id?: string;                            // Transaction ID (for reference)
  timestamp?: Date | string;              // Transaction timestamp
}

// ===== Fraud Check Result =====

export interface FraudCheckResult {
  // Unique check ID
  id: string;
  
  // Transaction reference
  transactionId?: string;
  
  // Fraud assessment
  score: number;                          // Fraud probability (0-1)
  isFraud: boolean;                       // Binary classification
  risk: RiskLevel;                        // Risk level
  action: Action;                         // Recommended action
  
  // Explanation
  reasons: string[];                      // Why this decision was made
  
  // Metadata
  timestamp: Date;
  modelVersion: string;
}

// ===== Configuration Types =====

export interface StorageConfig {
  path?: string;
  retention?: {
    predictions_days?: number;
    feedback_days?: number;
  };
}

export interface ModelConfig {
  path?: string;
  thresholds?: {
    review?: number;
    reject?: number;
  };
}

export interface RetrainingConfig {
  enabled?: boolean;
  python_path?: string;
  min_samples?: number;
  schedule?: string;
}

export interface FeaturesConfig {
  velocity_checks?: boolean;
}

export interface LoggingConfig {
  level?: LogLevel;
  console?: boolean;
}

export interface FraudGuardConfig {
  storage?: StorageConfig;
  model?: ModelConfig;
  retraining?: RetrainingConfig;
  features?: FeaturesConfig;
  logging?: LoggingConfig;
}

// ===== Model Metadata =====

export interface ModelMetadata {
  feature_columns: string[];
  type_encoder_classes: string[];
  scaler_mean: number[];
  scaler_scale: number[];
  auc_score: number;
  model_version: string;
}

// ===== Internal Feature Vector =====

export interface FeatureVector {
  step: number;
  typeEncoded: number;
  amount: number;
  oldBalanceOrigin: number;
  newBalanceOrigin: number;
  oldBalanceDestination: number;
  newBalanceDestination: number;
  originBalanceDiff: number;
  destinationBalanceDiff: number;
  originZeroBalance: number;
  destinationZeroBalance: number;
  amountToBalanceRatio: number;
}