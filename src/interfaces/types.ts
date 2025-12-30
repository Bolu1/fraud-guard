/**
 * Fraud Guard - Type Definitions
 * All TypeScript interfaces, types, and enums for the package
 */

// ========================================
// ENUMS
// ========================================

export enum TransactionCategory {
  ENTERTAINMENT = "entertainment",
  FOOD_DINING = "food_dining",
  GAS_TRANSPORT = "gas_transport",
  GROCERY_NET = "grocery_net",
  GROCERY_POS = "grocery_pos",
  HEALTH_FITNESS = "health_fitness",
  HOME = "home",
  KIDS_PETS = "kids_pets",
  MISC_NET = "misc_net",
  MISC_POS = "misc_pos",
  PERSONAL_CARE = "personal_care",
  SHOPPING_NET = "shopping_net",
  SHOPPING_POS = "shopping_pos",
  TRAVEL = "travel",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export enum Action {
  ACCEPT = "accept",
  REVIEW = "review",
  REJECT = "reject",
}

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

// ========================================
// TRANSACTION INPUT
// ========================================

export interface TransactionData {
  amount: number;
  timestamp: Date;
  category: TransactionCategory;
  id?: string;
  customerId?: string;
  walletBalance?: number;
  ipAddress?: string;
  deviceId?: string;
}

// ========================================
// FRAUD CHECK RESULT
// ========================================

export interface FraudCheckResult {
  id: string;
  transactionId?: string;
  score: number;
  risk: RiskLevel;
  action: Action;
  reasons: string[];
  timestamp: Date;
  modelVersion: string;
}

// ========================================
// FEEDBACK
// ========================================

export interface FeedbackData {
  actualFraud: boolean;
}

// ========================================
// MODEL METADATA
// ========================================

export interface ModelInfo {
  version: string;
  accuracy?: number;
  modelPath: string;
  isBaseline: boolean;
  trainingSamples?: number;
  createdAt?: Date;
}

export interface ModelMetadata {
  feature_columns: string[];
  input_shape: [number, number];
  threshold: number;
  note: string;
  required_fields: string[];
}

export interface ScalerParams {
  mean: number[];
  std: number[];
  feature_columns: string[];
}

// ========================================
// CONFIGURATION TYPES
// ========================================

export interface ProjectConfig {
  name: string;
}

export interface StorageConfig {
  enabled?: boolean;
  path?: string;
  retention?: {
    predictions_days?: number;
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

export interface LoggingConfig {
  level?: LogLevel;
  console?: boolean;
}

export interface FraudGuardConfig {
  project: ProjectConfig;
  storage: StorageConfig;
  model: ModelConfig;
  retraining?: RetrainingConfig;
  logging?: LoggingConfig;
}

// ========================================
// INTERNAL TYPES
// ========================================

export interface TimeFeatures {
  hour: number;
  month: number;
  dayofweek: number;
  day: number;
}

export interface FeatureVector {
  amt: number;
  hour: number;
  month: number;
  dayofweek: number;
  day: number;
  entertainment: number;
  food_dining: number;
  gas_transport: number;
  grocery_net: number;
  grocery_pos: number;
  health_fitness: number;
  home: number;
  kids_pets: number;
  misc_net: number;
  misc_pos: number;
  personal_care: number;
  shopping_net: number;
  shopping_pos: number;
  travel: number;
}

export interface PredictionResult {
  score: number;
  label: number;
  probabilities: {
    notFraud: number;
    fraud: number;
  };
}

// ========================================
// DATABASE TYPES
// ========================================

export interface PredictionRecord {
  id: string;
  transaction_id: string | null;
  created_at: Date;
  amount: number;
  hour: number;
  month: number;
  dayofweek: number;
  day: number;
  category: string;
  score: number;
  risk_level: string;
  action: string;
  model_version: string;
  actual_fraud: number | null;
  feedback_provided: boolean;
  feedback_at: Date | null;
  feedback_notes: string | null;
}

export interface ModelVersionRecord {
  version: string;
  created_at: Date;
  is_baseline: boolean;
  is_active: boolean;
  training_samples: number | null;
  training_duration_seconds: number | null;
  accuracy: number | null;
  notes: string | null;
}

// ========================================
// RETRAINING TYPES
// ========================================

export interface RetrainOptions {
  force?: boolean;
  dryRun?: boolean;
}

export interface RetrainResult {
  success: boolean;
  newVersion?: string;
  sampleCount?: number;
  duration?: number;
  accuracy?: number;
  error?: string;
  logs?: string[];
}

// ========================================
// UTILITY TYPES
// ========================================

export interface CategorySuggestion {
  category: TransactionCategory;
  description: string;
  confidence: "high" | "medium" | "low";
}

export interface DatabaseSize {
  sizeBytes: number;
  totalPredictions: number;
  predictionsWithFeedback: number;
  totalModelVersions: number;
}

export interface PredictionStats {
  total: number;
  byAction: {
    accept: number;
    review: number;
    reject: number;
  };
  byRisk: {
    low: number;
    medium: number;
    high: number;
  };
  averageScore: number;
  feedbackRate: number;
}
