import * as tf from '@tensorflow/tfjs-node';
import { PredictionResult } from '../interfaces/types';
import { ModelError } from '../utils/errors';
import { Logger } from '../utils/logger';

/**
 * TensorFlow.js inference engine
 */
export class TensorFlowInference {
  private model: tf.LayersModel | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Load TensorFlow.js model
   */
  async loadModel(modelPath: string): Promise<void> {
    try {
      this.logger.debug(`Loading model from: ${modelPath}`);

      const modelUrl = `file://${modelPath}`;
      this.model = await tf.loadLayersModel(modelUrl);

      this.logger.info('Model loaded successfully');
    } catch (error: any) {
      throw new ModelError(`Failed to load model: ${error.message}`);
    }
  }

  /**
   * Run prediction on standardized features
   */
  async predict(reshapedFeatures: number[][][]): Promise<PredictionResult> {
    if (!this.model) {
      throw new ModelError('Model not loaded. Call loadModel() first.');
    }

    let inputTensor: tf.Tensor | null = null;
    let outputTensor: tf.Tensor | null = null;

    try {
      inputTensor = tf.tensor3d(reshapedFeatures);

      outputTensor = this.model.predict(inputTensor) as tf.Tensor;

      const outputData = await outputTensor.data();

      const score = outputData[0];

      if (!isFinite(score) || score < 0 || score > 1) {
        throw new ModelError(`Invalid prediction score: ${score}`);
      }

      const result: PredictionResult = {
        score: score,
        label: score >= 0.5 ? 1 : 0,
        probabilities: {
          notFraud: 1 - score,
          fraud: score,
        },
      };

      return result;
    } catch (error: any) {
      throw new ModelError(`Prediction failed: ${error.message}`);
    } finally {
      if (inputTensor) {
        inputTensor.dispose();
      }
      if (outputTensor) {
        outputTensor.dispose();
      }
    }
  }

  /**
   * Clean up model resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.logger.debug('Model disposed');
    }
  }

  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.model !== null;
  }
}