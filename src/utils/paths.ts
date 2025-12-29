import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { InitializationError } from './errors';
import { getBaselineModelPath, getProjectBasePath } from '../config/defaults';

export function resolveStoragePath(projectName: string, configPath?: string): string {
  if (configPath) {
    return configPath;
  }

  if (process.env.FRAUD_GUARD_DATA_PATH) {
    return process.env.FRAUD_GUARD_DATA_PATH;
  }

  return path.join(getProjectBasePath(projectName), 'data', 'fraud-data.db');
}

export function resolveModelPath(projectName: string, configPath?: string): string {
  if (configPath) {
    return configPath;
  }

  if (process.env.FRAUD_GUARD_MODEL_PATH) {
    return process.env.FRAUD_GUARD_MODEL_PATH;
  }

  const projectModelPath = path.join(getProjectBasePath(projectName), 'models');
  const currentModelLink = path.join(projectModelPath, 'current');

  if (fs.existsSync(currentModelLink)) {
    return currentModelLink;
  }

  return getBaselineModelPath();
}

export function resolveModelFile(modelDir: string): string {
  const modelFile = path.join(modelDir, 'model.json');

  if (!fs.existsSync(modelFile)) {
    throw new InitializationError(`Model file not found: ${modelFile}`);
  }

  return modelFile;
}

export function resolveScalerFile(modelDir: string): string {
  const scalerFile = path.join(modelDir, 'scaler_params.json');

  if (!fs.existsSync(scalerFile)) {
    throw new InitializationError(`Scaler parameters file not found: ${scalerFile}`);
  }

  return scalerFile;
}

export function resolveModelConfigFile(modelDir: string): string {
  const configFile = path.join(modelDir, 'model_config.json');

  if (!fs.existsSync(configFile)) {
    throw new InitializationError(`Model config file not found: ${configFile}`);
  }

  return configFile;
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    throw new InitializationError(`Failed to create directory ${dirPath}: ${error.message}`);
  }
}

export async function isPathWritable(filePath: string): Promise<boolean> {
  try {
    const dirPath = path.dirname(filePath);

    if (!fs.existsSync(dirPath)) {
      await ensureDirectoryExists(dirPath);
      return true;
    }

    await fs.promises.access(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export async function copyFile(source: string, destination: string): Promise<void> {
  try {
    const destDir = path.dirname(destination);
    await ensureDirectoryExists(destDir);

    await fs.promises.copyFile(source, destination);
  } catch (error: any) {
    throw new InitializationError(
      `Failed to copy file from ${source} to ${destination}: ${error.message}`
    );
  }
}

export async function copyDirectory(source: string, destination: string): Promise<void> {
  try {
    await ensureDirectoryExists(destination);

    const entries = await fs.promises.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  } catch (error: any) {
    throw new InitializationError(
      `Failed to copy directory from ${source} to ${destination}: ${error.message}`
    );
  }
}

export async function initializeBaselineModel(): Promise<void> {
  const baselinePath = getBaselineModelPath();

  if (fs.existsSync(path.join(baselinePath, 'model.json'))) {
    return;
  }

  try {
    const packageModelPath = path.join(__dirname, '../../models/baseline');

    if (!fs.existsSync(packageModelPath)) {
      throw new InitializationError(`Package baseline model not found at ${packageModelPath}`);
    }

    await copyDirectory(packageModelPath, baselinePath);
  } catch (error: any) {
    throw new InitializationError(`Failed to initialize baseline model: ${error.message}`);
  }
}

export function getFraudGuardBaseDir(): string {
  return path.join(os.homedir(), '.fraud-guard');
}