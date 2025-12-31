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

export enum CustomerTransactionFeedbackStatus {
  SUCCESS = "success",
  FAILED = "failed",
}

export enum VelocityCheckType {
  FREQUENCY = "frequency",
  AMOUNT = "amount",
  FAILED = "failed",
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
  timestamp: Date;

  modelScore: number;
  velocityScore: number;
  score: number;

  risk: RiskLevel;
  action: Action;
  reasons: string[];
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
}

export interface ThresholdsConfig {
  review: number;
  reject: number;
}

export interface RetrainingConfig {
  enabled?: boolean;
  python_path?: string;
  python_venv?: string;
  min_samples?: number;
  schedule?: string;
}

export interface LoggingConfig {
  level?: LogLevel;
  console?: boolean;
}

export interface TimeWindowConfig {
  period_minutes: number;
  max_transactions?: number;
  max_failed?: number;
  max_amount?: number;
  score_adjustment: number;
}

export interface AmountConfig {
  enabled?: boolean;
  time_windows?: TimeWindowConfig[];
  spike_detection?: {
    enabled?: boolean;
    lookback_days?: number;
    multiplier?: number;
    score_adjustment?: number;
  };
}

// Spike detection configuration
export interface SpikeDetectionConfig {
  enabled?: boolean;
  lookback_days?: number;
  multiplier?: number;
  score_adjustment?: number;
}

// Frequency check configuration
export interface FrequencyConfig {
  enabled?: boolean;
  time_windows?: TimeWindowConfig[];
}

// Amount check configuration
export interface AmountConfig {
  enabled?: boolean;
  time_windows?: TimeWindowConfig[];
  spike_detection?: SpikeDetectionConfig;
}

// Failed transaction check configuration
export interface FailedTransactionsConfig {
  enabled?: boolean;
  time_windows?: TimeWindowConfig[];
}

// Velocity scoring configuration
export interface VelocityScoringConfig {
  model_weight?: number;
  velocity_weight?: number;
}

export interface VelocityConfig {
  enabled?: boolean;
  scoring?: VelocityScoringConfig;
  frequency?: FrequencyConfig;
  amount?: AmountConfig;
  failed_transactions?: FailedTransactionsConfig;
}

export interface FraudGuardConfig {
  project: ProjectConfig;
  thresholds: ThresholdsConfig;
  storage: StorageConfig;
  model: ModelConfig;
  velocity?: VelocityConfig;
  logging?: LoggingConfig;
  retraining?: RetrainingConfig;
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

// ========================================
// VELOCITY CHECKS TYPES
// ========================================

export interface VelocityCheckResult {
  type: VelocityCheckType;
  score: number;
  triggered: boolean;
  reasons: string[];
  details?: any;
}

// Final velocity result after aggregation
export interface VelocityResult {
  score: number;
  reasons: string[];
  checks: VelocityCheckResult[];
}

// ========================================
// RETRAINING TYPES
// ========================================

export interface RetrainingResult {
  success: boolean;
  version?: string;
  metrics?: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    auc: number;
    training_samples: number;
    test_samples: number;
  };
  output_dir?: string;
  error?: string;
  improvement?: number;
  current_accuracy?: number;
  new_accuracy?: number;
}
