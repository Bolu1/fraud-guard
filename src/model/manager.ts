import * as path from 'path';
import { ModelInfo, TransactionData, PredictionResult, ScalerParams } from '../interfaces/types';
import { TensorFlowInference } from './inference';
import { extractFeatures, featureVectorToArray, standardizeFeatures, reshapeForModel } from './feature-extractor';
import { loadModelMetadata, loadScalerParams } from './metadata';
import { resolveModelFile } from '../utils/paths';
import { ModelError, InitializationError } from '../utils/errors';
import { Logger } from '../utils/logger';

/**
 * Model manager - handles model lifecycle and predictions
 */
export class ModelManager {
  private modelDir: string;
  private inference: TensorFlowInference;
  private scaler: ScalerParams | null = null;
  private logger: Logger;
  private initialized: boolean = false;

  constructor(modelDir: string, logger: Logger) {
    this.modelDir = modelDir;
    this.logger = logger;
    this.inference = new TensorFlowInference(logger);
  }

  /**
   * Initialize model manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug('Model already initialized');
      return;
    }

    try {
      this.logger.info('Initializing model...');

      this.scaler = loadScalerParams(this.modelDir);
      this.logger.debug('Scaler parameters loaded');

      const metadata = loadModelMetadata(this.modelDir);
      this.logger.debug('Model metadata loaded');

      const modelFile = resolveModelFile(this.modelDir);
      await this.inference.loadModel(modelFile);

      this.initialized = true;
      this.logger.info('Model initialization complete');
    } catch (error: any) {
      throw new InitializationError(`Failed to initialize model: ${error.message}`);
    }
  }

  /**
   * Make prediction for a transaction
   */
  async predict(transaction: TransactionData): Promise<PredictionResult> {
    if (!this.initialized) {
      throw new ModelError('Model not initialized. Call initialize() first.');
    }

    if (!this.scaler) {
      throw new ModelError('Scaler not loaded');
    }

    try {
      const features = extractFeatures(transaction);
      this.logger.debug('Features extracted');

      const featureArray = featureVectorToArray(features, this.scaler.feature_columns);
      this.logger.debug(`Feature array created: ${featureArray.length} features`);

      const standardized = standardizeFeatures(featureArray, this.scaler.mean, this.scaler.std);
      this.logger.debug('Features standardized');

      const reshaped = reshapeForModel(standardized);
      this.logger.debug('Features reshaped for model');

      const result = await this.inference.predict(reshaped);
      this.logger.debug(`Prediction complete: score=${result.score}`);

      return result;
    } catch (error: any) {
      if (error instanceof ModelError) {
        throw error;
      }
      throw new ModelError(`Prediction failed: ${error.message}`);
    }
  }

  /**
   * Get model information
   */
  getModelInfo(): ModelInfo {
    const version = this.getModelVersion();
    const isBaseline = this.modelDir.includes('baseline');

    return {
      version: version,
      modelPath: this.modelDir,
      isBaseline: isBaseline,
    };
  }

  /**
   * Get model version from directory name
   */
  private getModelVersion(): string {
    const dirName = path.basename(this.modelDir);

    if (dirName === 'baseline') {
      return 'v1.0.0';
    }

    if (dirName.startsWith('retrained-')) {
      return dirName.replace('retrained-', '');
    }

    return dirName;
  }

  /**
   * Reload model (for hot-reloading after retraining)
   */
  async reload(newModelDir: string): Promise<void> {
    this.logger.info(`Reloading model from: ${newModelDir}`);

    this.dispose();

    this.modelDir = newModelDir;
    this.initialized = false;

    await this.initialize();

    this.logger.info('Model reloaded successfully');
  }

  /**
   * Check if model is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.inference.dispose();
    this.scaler = null;
    this.initialized = false;
    this.logger.debug('Model manager disposed');
  }
}