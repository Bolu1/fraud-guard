import { ModelMetadata, TransactionData, FeatureVector } from '../interfaces/types';
import { MetadataLoader } from './metadata';
import { InferenceEngine } from './inference';
import { FeatureExtractor } from '../features/extractor';
import { ModelError } from '../utils/errors';
import {
  resolveModelFile,
  resolveMetadataFile,
  initializeModelDirectory,
} from '../utils/paths';

/**
 * Model prediction result (internal)
 */
export interface PredictionResult {
  score: number; // Fraud probability (0-1)
  label: number; // Binary classification (0 or 1)
  probabilities: {
    notFraud: number; // Probability of class 0
    fraud: number; // Probability of class 1
  };
}

/**
 * Model manager
 * Orchestrates model loading, feature extraction, and prediction
 */
export class ModelManager {
  private metadata: ModelMetadata | null = null;
  private inferenceEngine: InferenceEngine;
  private featureExtractor: FeatureExtractor | null = null;
  private modelDir: string | null = null;

  constructor() {
    this.inferenceEngine = new InferenceEngine();
  }

  /**
   * Initialize model from directory
   * Loads model, metadata, and sets up feature extractor
   */
  async initialize(modelDir: string): Promise<void> {
    try {
      this.modelDir = modelDir;

      // Initialize model directory 
      await initializeModelDirectory(modelDir);

      // Resolve paths
      const modelFile = resolveModelFile(modelDir);
      const metadataFile = resolveMetadataFile(modelDir);

      // Load metadata
      this.metadata = MetadataLoader.load(metadataFile);

      // Load ONNX model
      await this.inferenceEngine.loadModel(modelFile);

      // Create feature extractor
      this.featureExtractor = new FeatureExtractor(this.metadata);
    } catch (error: any) {
      throw new ModelError(`Failed to initialize model: ${error.message}`);
    }
  }

  /**
   * Predict fraud for a transaction
   */
  async predict(transaction: TransactionData): Promise<PredictionResult> {
    if (!this.featureExtractor || !this.metadata) {
      throw new ModelError('Model not initialized. Call initialize() first.');
    }

    try {
      // Extract features from transaction
      const features: FeatureVector = this.featureExtractor.extract(transaction);

      // Standardize features
      const standardizedFeatures: Float32Array = this.featureExtractor.standardize(features);

      // Run inference
      const probabilities: Float32Array = await this.inferenceEngine.predict(
        standardizedFeatures
      );

      // Extract results
      // probabilities = [prob_not_fraud, prob_fraud]
      const notFraudProb = probabilities[0];
      const fraudProb = probabilities[1];

      // Determine classification (threshold 0.5)
      const label = fraudProb > 0.5 ? 1 : 0;

      return {
        score: fraudProb,
        label,
        probabilities: {
          notFraud: notFraudProb,
          fraud: fraudProb,
        },
      };
    } catch (error: any) {
      if (error instanceof ModelError) {
        throw error;
      }
      throw new ModelError(`Prediction failed: ${error.message}`);
    }
  }

  /**
   * Get model metadata
   */
  getMetadata(): ModelMetadata {
    if (!this.metadata) {
      throw new ModelError('Model not initialized');
    }
    return this.metadata;
  }

  /**
   * Get model version
   */
  getVersion(): string {
    if (!this.metadata) {
      throw new ModelError('Model not initialized');
    }
    return MetadataLoader.getVersion(this.metadata);
  }

  /**
   * Get model AUC score
   */
  getAucScore(): number {
    if (!this.metadata) {
      throw new ModelError('Model not initialized');
    }
    return MetadataLoader.getAucScore(this.metadata);
  }

  /**
   * Get model directory
   */
  getModelDirectory(): string | null {
    return this.modelDir;
  }

  /**
   * Check if model is initialized
   */
  isInitialized(): boolean {
    return this.metadata !== null && this.inferenceEngine.isLoaded();
  }

  /**
   * Close model and free resources
   */
  async close(): Promise<void> {
    await this.inferenceEngine.close();
    this.metadata = null;
    this.featureExtractor = null;
    this.modelDir = null;
  }
}