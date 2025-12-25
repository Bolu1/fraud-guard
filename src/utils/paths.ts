import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { InitializationError } from './errors';

/**
 * Resolve model path
 * Priority:
 * 1. Config-specified path
 * 2. Home directory default
 * 3. Package bundled model
 */
export function resolveModelPath(configPath?: string): string {
  // If user specified a path in config, use it
  if (configPath) {
    return configPath;
  }

  // Default: home directory
  const homeDir = os.homedir();
  const defaultPath = path.join(homeDir, '.fraud-guard', 'models');

  // Check if model exists in home directory
  const modelFile = path.join(defaultPath, 'baseline.onnx');
  if (fs.existsSync(modelFile)) {
    return defaultPath;
  }

  // Fall back to package bundled model
  const packageModelPath = path.join(__dirname, '../../models');
  return packageModelPath;
}

/**
 * Resolve model file path (actual .onnx file)
 */
export function resolveModelFile(modelDir: string): string {
  // Look for current.onnx symlink first
  const currentModel = path.join(modelDir, 'current.onnx');
  if (fs.existsSync(currentModel)) {
    return currentModel;
  }

  // Fall back to baseline.onnx
  const baselineModel = path.join(modelDir, 'baseline.onnx');
  if (fs.existsSync(baselineModel)) {
    return baselineModel;
  }

  throw new InitializationError(`No model file found in ${modelDir}`);
}

/**
 * Resolve metadata file path
 */
export function resolveMetadataFile(modelDir: string): string {
  const metadataFile = path.join(modelDir, 'metadata.json');

  if (!fs.existsSync(metadataFile)) {
    throw new InitializationError(`Metadata file not found: ${metadataFile}`);
  }

  return metadataFile;
}

/**
 * Resolve storage database path
 */
export function resolveStoragePath(configPath?: string): string {
  if (configPath) {
    return configPath;
  }

  // Default: home directory
  const homeDir = os.homedir();
  return path.join(homeDir, '.fraud-guard', 'data', 'fraud-data.db');
}

/**
 * Get default base directory (home directory)
 */
export function getDefaultBaseDirectory(): string {
  return path.join(os.homedir(), '.fraud-guard');
}

/**
 * Ensure directory exists, create if not
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    throw new InitializationError(`Failed to create directory ${dirPath}: ${error.message}`);
  }
}

/**
 * Check if path is writable
 */
export async function isPathWritable(filePath: string): Promise<boolean> {
  try {
    const dirPath = path.dirname(filePath);

    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      // Try to create it
      await ensureDirectoryExists(dirPath);
      return true;
    }

    // Check if we can write to directory
    await fs.promises.access(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Get package root directory (where models/ folder is)
 */
export function getPackageRoot(): string {
  // From src/utils/paths.ts, go up two levels to package root
  return path.join(__dirname, '../..');
}

/**
 * Copy file from source to destination
 */
export async function copyFile(source: string, destination: string): Promise<void> {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destination);
    await ensureDirectoryExists(destDir);

    // Copy file
    await fs.promises.copyFile(source, destination);
  } catch (error: any) {
    throw new InitializationError(
      `Failed to copy file from ${source} to ${destination}: ${error.message}`
    );
  }
}

/**
 * Initialize model directory (copy baseline model if needed)
 */
export async function initializeModelDirectory(modelDir: string): Promise<void> {
  try {
    // Ensure directory exists
    await ensureDirectoryExists(modelDir);

    // Check if baseline model already exists
    const baselineModel = path.join(modelDir, 'baseline.onnx');
    if (fs.existsSync(baselineModel)) {
      return; // Already initialized
    }

    // Copy baseline model from package
    const packageRoot = getPackageRoot();
    const sourceModel = path.join(packageRoot, 'models', 'baseline.onnx');
    const sourceMetadata = path.join(packageRoot, 'models', 'metadata.json');

    if (!fs.existsSync(sourceModel)) {
      throw new InitializationError(
        `Baseline model not found in package: ${sourceModel}`
      );
    }

    // Copy model and metadata
    await copyFile(sourceModel, baselineModel);
    await copyFile(sourceMetadata, path.join(modelDir, 'metadata.json'));

    // Create current.onnx symlink pointing to baseline
    const currentLink = path.join(modelDir, 'current.onnx');
    if (!fs.existsSync(currentLink)) {
      await createSymlink('baseline.onnx', currentLink);
    }
  } catch (error: any) {
    throw new InitializationError(
      `Failed to initialize model directory: ${error.message}`
    );
  }
}

/**
 * Create symbolic link (cross-platform)
 */
async function createSymlink(target: string, linkPath: string): Promise<void> {
  try {
    // On Windows, symlinks require admin rights, so we'll just copy instead
    if (process.platform === 'win32') {
      const targetPath = path.join(path.dirname(linkPath), target);
      await copyFile(targetPath, linkPath);
    } else {
      await fs.promises.symlink(target, linkPath);
    }
  } catch (error: any) {
    // If symlink fails, fall back to copying
    const targetPath = path.join(path.dirname(linkPath), target);
    await copyFile(targetPath, linkPath);
  }
}