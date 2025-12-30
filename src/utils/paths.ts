import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { InitializationError } from "./errors";
import { getBaselineModelPath, getProjectBasePath } from "../config/defaults";
import { Logger } from "./logger";

export function resolveStoragePath(
  projectName: string,
  configPath?: string
): string {
  if (configPath) {
    return configPath;
  }

  return path.join(getProjectBasePath(projectName), "data", "fraud-data.db");
}

export function resolveModelPath(
  projectName: string,
  configPath?: string,
  log?: Logger
): string {

  // 1. User override in config (highest priority)
  if (configPath) {
    return configPath;
  }

  // 3. Check for retrained model in project directory
  const projectModelPath = path.join(getProjectBasePath(projectName), "models");
  const currentModelLink = path.join(projectModelPath, "current");

  log?.info(".        ");
  log?.info(`projectModelPath ${projectModelPath} projectModelPath`);
  log?.info(".        ");

  log?.info(".        ");
  log?.info(`currentModelLink ${currentModelLink} currentModelLink`);
  log?.info(".        ");

  // Check if retrained model exists and is valid
  if (fs.existsSync(currentModelLink)) {
    const modelJsonPath = path.join(currentModelLink, "model.json");
    const scalerParamsPath = path.join(currentModelLink, "scaler_params.json");
      log?.info("11111   ");


    if (fs.existsSync(modelJsonPath) && fs.existsSync(scalerParamsPath)) {
      log?.info("2222   ");

      return currentModelLink;
    }
  }

  // Also check for direct model in project directory (no symlink)
  const directModelJsonPath = path.join(projectModelPath, "model.json");
  const directScalerPath = path.join(projectModelPath, "scaler_params.json");

    log?.info(".        ");
  log?.info(`directModelJsonPath ${directModelJsonPath} directModelJsonPath`);
  log?.info(".        ");

  log?.info(".        ");
  log?.info(`directScalerPath ${directScalerPath} directScalerPath`);
  log?.info(".        ");

  if (fs.existsSync(directModelJsonPath) && fs.existsSync(directScalerPath)) {
      log?.info("3333   ");

    return projectModelPath;
  }

  // 4. Fall back to baseline model
  return getBaselineModelPath();
}

export function resolveModelFile(modelDir: string): string {
  const modelFile = path.join(modelDir, "model.json");

  if (!fs.existsSync(modelFile)) {
    throw new InitializationError(`Model file not found: ${modelFile}`);
  }

  return modelFile;
}

export function resolveScalerFile(modelDir: string): string {
  const scalerFile = path.join(modelDir, "scaler_params.json");

  if (!fs.existsSync(scalerFile)) {
    throw new InitializationError(
      `Scaler parameters file not found: ${scalerFile}`
    );
  }

  return scalerFile;
}

export function resolveModelConfigFile(modelDir: string): string {
  const configFile = path.join(modelDir, "model_config.json");

  if (!fs.existsSync(configFile)) {
    throw new InitializationError(`Model config file not found: ${configFile}`);
  }

  return configFile;
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    throw new InitializationError(
      `Failed to create directory ${dirPath}: ${error.message}`
    );
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

export async function copyFile(
  source: string,
  destination: string
): Promise<void> {
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

export async function copyDirectory(
  source: string,
  destination: string
): Promise<void> {
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

  if (fs.existsSync(path.join(baselinePath, "model.json"))) {
    return;
  }

  try {
    const packageModelPath = path.join(__dirname, "../../models/baseline");

    if (!fs.existsSync(packageModelPath)) {
      throw new InitializationError(
        `Package baseline model not found at ${packageModelPath}`
      );
    }

    await copyDirectory(packageModelPath, baselinePath);
  } catch (error: any) {
    throw new InitializationError(
      `Failed to initialize baseline model: ${error.message}`
    );
  }
}

export function getFraudGuardBaseDir(): string {
  return path.join(os.homedir(), ".fraud-guard");
}
