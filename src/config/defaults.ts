import * as path from 'path';
import * as os from 'os';
import { FraudGuardConfig, LogLevel } from '../interfaces/types';

/**
 * Get default paths for fraud-guard data
 * All paths are namespaced by project name to avoid conflicts
 */
function getDefaultBasePath(): string {
  return path.join(os.homedir(), '.fraud-guard');
}

/**
 * Get baseline model path (shared across all projects)
 */
export function getBaselineModelPath(): string {
  return path.join(getDefaultBasePath(), 'baseline');
}

/**
 * Get project-specific base path
 */
export function getProjectBasePath(projectName: string): string {
  return path.join(getDefaultBasePath(), 'projects', projectName);
}

/**
 * Default configuration (no config file)
 * NOTE: project.name is REQUIRED - no default provided
 * User MUST provide this in config file
 */
export const DEFAULT_CONFIG: Partial<FraudGuardConfig> = {
  thresholds: {
    review: 0.4,
    reject: 0.7,
  },

  storage: {
    enabled: false,
    path: undefined,
    retention: {
      predictions_days: 90,
    },
  },

  model: {
    path: undefined,
  },

  velocity: {
    enabled: false,
    scoring: {
      model_weight: 0.6,
      velocity_weight: 0.4,
    },
    frequency: {
      enabled: true,
      time_windows: [
        { period_minutes: 10, max_transactions: 5, score_adjustment: 0.2 },
        { period_minutes: 60, max_transactions: 10, score_adjustment: 0.3 },
        { period_minutes: 1440, max_transactions: 50, score_adjustment: 0.4 },
      ],
    },
    amount: {
      enabled: true,
      time_windows: [
        { period_minutes: 60, max_amount: 5000, score_adjustment: 0.2 },
        { period_minutes: 1440, max_amount: 10000, score_adjustment: 0.3 },
      ],
      spike_detection: {
        enabled: true,
        lookback_days: 30,
        multiplier: 5,
        score_adjustment: 0.4,
      },
    },
    failed_transactions: {
      enabled: true,
      time_windows: [
        { period_minutes: 10, max_failed: 3, score_adjustment: 0.3 },
        { period_minutes: 60, max_failed: 5, score_adjustment: 0.4 },
      ],
    },
  },

  retraining: {
    enabled: false,
    python_path: 'python3',
    python_venv: "bin/python",
    min_samples: 100,
    schedule: '0 2 * * *',
  },

  logging: {
    level: LogLevel.INFO,
    console: true,
  },
};

/**
 * Get default storage path for a project
 */
export function getDefaultStoragePath(projectName: string): string {
  return path.join(getProjectBasePath(projectName), 'data', 'fraud-data.db');
}

/**
 * Get default model path for a project
 */
export function getDefaultModelPath(projectName: string): string {
  return path.join(getProjectBasePath(projectName), 'models');
}