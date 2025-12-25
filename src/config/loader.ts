import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { FraudGuardConfig } from '../interfaces/types';
import { DEFAULT_CONFIG, DEFAULT_CONFIG_WITH_FILE } from './defaults';
import { validateConfig } from './validator';
import { ConfigurationError } from '../utils/errors';

/**
 * Name of the configuration file to look for
 */
const CONFIG_FILE_NAME = 'fraud-guard.config.yml';

/**
 * Load configuration from file system
 * Priority:
 * 1. Current working directory
 * 2. If no file found, use defaults (NO storage/retraining)
 */
export function loadConfig(): FraudGuardConfig {
  const configPath = findConfigFile();

  if (!configPath) {
    // No config file - return basic defaults (only model prediction)
    return DEFAULT_CONFIG;
  }

  try {
    // Config file exists - load and merge with full defaults
    const userConfig = parseConfigFile(configPath);
    const mergedConfig = mergeConfigs(DEFAULT_CONFIG_WITH_FILE, userConfig);

    // Validate merged configuration
    validateConfig(mergedConfig);

    return mergedConfig;
  } catch (error: any) {
    throw new ConfigurationError(
      `Failed to load configuration from ${configPath}: ${error?.message}`
    );
  }
}

/**
 * Check if configuration file exists
 */
export function configFileExists(): boolean {
  return findConfigFile() !== null;
}

/**
 * Find configuration file
 * Looks in current working directory only
 */
function findConfigFile(): string | null {
  const cwd = process.cwd();
  const configPath = path.join(cwd, CONFIG_FILE_NAME);

  if (fs.existsSync(configPath)) {
    return configPath;
  }

  return null;
}

/**
 * Parse YAML configuration file
 */
function parseConfigFile(filePath: string): Partial<FraudGuardConfig> {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.load(fileContents) as Partial<FraudGuardConfig>;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Configuration file is empty or invalid');
    }

    return parsed;
  } catch (error: any) {
    if (error.name === 'YAMLException') {
      throw new ConfigurationError(`Invalid YAML syntax: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Deep merge configuration objects
 * User config overrides defaults
 */
function mergeConfigs(
  defaults: FraudGuardConfig,
  userConfig: Partial<FraudGuardConfig>
): FraudGuardConfig {
  const merged: FraudGuardConfig = JSON.parse(JSON.stringify(defaults));

  // Merge storage
  if (userConfig.storage) {
    merged.storage = {
      ...merged.storage,
      ...userConfig.storage,
    };
    if (userConfig.storage.retention) {
      merged.storage.retention = {
        ...merged.storage?.retention,
        ...userConfig.storage.retention,
      };
    }
  }

  // Merge model
  if (userConfig.model) {
    merged.model = {
      ...merged.model,
      ...userConfig.model,
    };
    if (userConfig.model.thresholds) {
      merged.model.thresholds = {
        ...merged.model?.thresholds,
        ...userConfig.model.thresholds,
      };
    }
  }

  // Merge retraining
  if (userConfig.retraining) {
    merged.retraining = {
      ...merged.retraining,
      ...userConfig.retraining,
    };
  }

  // Merge features
  if (userConfig.features) {
    merged.features = {
      ...merged.features,
      ...userConfig.features,
    };
  }

  // Merge logging
  if (userConfig.logging) {
    merged.logging = {
      ...merged.logging,
      ...userConfig.logging,
    };
  }

  return merged;
}

/**
 * Get configuration file path if it exists
 */
export function getConfigFilePath(): string | null {
  return findConfigFile();
}