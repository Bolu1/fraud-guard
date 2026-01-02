import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { FraudGuardConfig, LogLevel } from "../interfaces/types";
import {
  DEFAULT_CONFIG,
  getDefaultStoragePath,
  getDefaultModelPath,
} from "./defaults";
import { validateConfig } from "./validator";
import { ConfigurationError } from "../utils/errors";

const CONFIG_FILE_NAME = "fraud-guard.config.yml";

export function loadConfig(): FraudGuardConfig {
  const configPath = findConfigFile();

  if (!configPath) {
    return createDefaultConfig();
  }

  try {
    const userConfig = parseConfigFile(configPath);

    if (!userConfig.project?.name) {
      throw new ConfigurationError(
        "Configuration file must include project.name. Example:\n" +
          "project:\n" +
          '  name: "my-project"'
      );
    }

    const mergedConfig = mergeConfigs(userConfig);
    const configWithPaths = resolvePaths(mergedConfig);
    validateConfig(configWithPaths);

    return configWithPaths;
  } catch (error: any) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(
      `Failed to load configuration: ${error.message}`
    );
  }
}

export function configFileExists(): boolean {
  return findConfigFile() !== null;
}


function createDefaultConfig(): FraudGuardConfig {
  const defaultProjectName = 'default-project';

  const config: FraudGuardConfig = {
    project: {
      name: defaultProjectName,
    },
    thresholds: {
      review: DEFAULT_CONFIG.thresholds?.review || 0.4,
      reject: DEFAULT_CONFIG.thresholds?.reject || 0.7,
    },
    storage: {
      enabled: false,
      path: getDefaultStoragePath(defaultProjectName),
      retention: {
        predictions_days: DEFAULT_CONFIG.storage?.retention?.predictions_days || 90,
      },
    },
    model: {
      path: undefined,
    },
    velocity: {
      enabled: false,
      scoring: DEFAULT_CONFIG.velocity?.scoring,
      frequency: DEFAULT_CONFIG.velocity?.frequency,
      amount: DEFAULT_CONFIG.velocity?.amount,
      failed_transactions: DEFAULT_CONFIG.velocity?.failed_transactions,
    },
    retraining: {
      enabled: DEFAULT_CONFIG.retraining?.enabled || false,
      python_path: DEFAULT_CONFIG.retraining?.python_path || 'python3',
      python_venv: DEFAULT_CONFIG.retraining?.python_venv || 'bin/python',
      min_samples: DEFAULT_CONFIG.retraining?.min_samples || 100,
      schedule: DEFAULT_CONFIG.retraining?.schedule || '0 2 * * *',
    },
    logging: {
      level: DEFAULT_CONFIG.logging?.level || LogLevel.INFO,
      console: DEFAULT_CONFIG.logging?.console !== undefined ? DEFAULT_CONFIG.logging.console : true,
    },
  };

  return config;
}

function findConfigFile(): string | null {
  const cwd = process.cwd();
  const configPath = path.join(cwd, CONFIG_FILE_NAME);

  if (fs.existsSync(configPath)) {
    return configPath;
  }

  return null;
}

function parseConfigFile(filePath: string): Partial<FraudGuardConfig> {
  try {
    const fileContents = fs.readFileSync(filePath, "utf8");
    const parsed = yaml.load(fileContents) as Partial<FraudGuardConfig>;

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Configuration file is empty or invalid");
    }

    return parsed;
  } catch (error: any) {
    if (error.name === "YAMLException") {
      throw new ConfigurationError(`Invalid YAML syntax: ${error.message}`);
    }
    throw error;
  }
}

function mergeConfigs(userConfig: Partial<FraudGuardConfig>): FraudGuardConfig {
  const merged: any = {
    project: {
      name: userConfig.project?.name,
    },
    thresholds: {
      review: userConfig.thresholds?.review || DEFAULT_CONFIG.thresholds?.review,
      reject: userConfig.thresholds?.reject || DEFAULT_CONFIG.thresholds?.reject,
    },
    storage: {
      enabled: userConfig.storage?.enabled ?? DEFAULT_CONFIG.storage?.enabled,
      path: userConfig.storage?.path,
      retention: {
        predictions_days:
          userConfig.storage?.retention?.predictions_days ||
          DEFAULT_CONFIG.storage?.retention?.predictions_days,
      },
    },
    model: {
      path: userConfig.model?.path,
    },
    velocity: {
      enabled: userConfig.velocity?.enabled ?? DEFAULT_CONFIG.velocity?.enabled,
      scoring: {
        model_weight:
          userConfig.velocity?.scoring?.model_weight ||
          DEFAULT_CONFIG.velocity?.scoring?.model_weight,
        velocity_weight:
          userConfig.velocity?.scoring?.velocity_weight ||
          DEFAULT_CONFIG.velocity?.scoring?.velocity_weight,
      },
      frequency: userConfig.velocity?.frequency || DEFAULT_CONFIG.velocity?.frequency,
      amount: userConfig.velocity?.amount || DEFAULT_CONFIG.velocity?.amount,
      failed_transactions:
        userConfig.velocity?.failed_transactions ||
        DEFAULT_CONFIG.velocity?.failed_transactions,
    },
    retraining: {
      enabled: userConfig.retraining?.enabled ?? DEFAULT_CONFIG.retraining?.enabled,
      python_path: userConfig.retraining?.python_path || DEFAULT_CONFIG.retraining?.python_path,
      python_venv: userConfig.retraining?.python_venv || DEFAULT_CONFIG.retraining?.python_venv,
      min_samples:
        userConfig.retraining?.min_samples || DEFAULT_CONFIG.retraining?.min_samples,
      schedule: userConfig.retraining?.schedule || DEFAULT_CONFIG.retraining?.schedule,
    },
    logging: {
      level: userConfig.logging?.level || DEFAULT_CONFIG.logging?.level,
      console: userConfig.logging?.console ?? DEFAULT_CONFIG.logging?.console,
    },
  };

  return merged as FraudGuardConfig;
}

function resolvePaths(config: FraudGuardConfig): FraudGuardConfig {
  const projectName = config.project.name;

  if (!config.storage.path) {
    config.storage.path = getDefaultStoragePath(projectName);
  }

  return config;
}

export function getConfigFilePath(): string | null {
  return findConfigFile();
}
