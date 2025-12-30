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
  storage: {
    enabled: false,
    path: undefined,
    retention: {
      predictions_days: 90,
    },
  },

  model: {
    path: undefined,
    thresholds: {
      review: 0.4,
      reject: 0.7,
    },
  },

  retraining: {
    enabled: false,
    python_path: 'python3',
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