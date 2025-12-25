import * as path from 'path';
import * as os from 'os';
import { FraudGuardConfig, LogLevel } from '../interfaces/types';

/**
 * Get default paths based on environment
 * Always uses home directory to avoid accidental commits
 */
function getDefaultPaths() {
  const homeDir = os.homedir();
  const baseDir = path.join(homeDir, '.fraud-guard');

  return {
    storage: path.join(baseDir, 'data', 'fraud-data.db'),
    models: path.join(baseDir, 'models'),
  };
}

/**
 * Default configuration when no config file exists
 * Storage is NOT included in defaults - only available with config file
 */
export const DEFAULT_CONFIG: FraudGuardConfig = {
  model: {
    thresholds: {
      review: 0.4,
      reject: 0.7,
    },
  },

  logging: {
    level: LogLevel.INFO,
    console: true,
  },
};

/**
 * Default configuration when config file IS present
 * Includes storage and other features
 */
export const DEFAULT_CONFIG_WITH_FILE: FraudGuardConfig = {
  storage: {
    path: getDefaultPaths().storage,
    retention: {
      predictions_days: 90,
      feedback_days: 365,
    },
  },

  model: {
    path: getDefaultPaths().models,
    thresholds: {
      review: 0.4,
      reject: 0.7,
    },
  },

  retraining: {
    enabled: false,
    python_path: 'python3',
    min_samples: 200,
    schedule: '0 2 * * *',
  },

  features: {
    velocity_checks: true,
  },

  logging: {
    level: LogLevel.INFO,
    console: true,
  },
};

/**
 * Get default paths for storage and models
 */
export function getDefaultStoragePaths() {
  return getDefaultPaths();
}