import * as ort from 'onnxruntime-node';
import * as fs from 'fs';
import { ModelError } from '../utils/errors';

/**
 * ONNX inference engine
 * Handles low-level model loading and prediction
 */
export class InferenceEngine {
  private session: ort.InferenceSession | null = null;
  private modelPath: string | null = null;

  /**
   * Load ONNX model
   */
  async loadModel(modelPath: string): Promise<void> {
    try {
      // Validate model file exists
      if (!fs.existsSync(modelPath)) {
        throw new ModelError(`Model file not found: ${modelPath}`);
      }

      // Load ONNX session
      this.session = await ort.InferenceSession.create(modelPath);
      this.modelPath = modelPath;
    } catch (error: any) {
      if (error instanceof ModelError) {
        throw error;
      }

      throw new ModelError(`Failed to load ONNX model: ${error.message}`);
    }
  }

  /**
   * Run inference on feature vector
   * Returns probabilities [prob_class_0, prob_class_1]
   */
  async predict(features: Float32Array): Promise<Float32Array> {
    if (!this.session) {
      throw new ModelError('Model not loaded. Call loadModel() first.');
    }

    try {
      // Create input tensor
      // Shape: [1, 12] - 1 sample, 12 features
      const inputTensor = new ort.Tensor('float32', features, [1, 12]);

      // Prepare feeds
      const feeds = { float_input: inputTensor };

      // Run inference
      const results = await this.session.run(feeds);

      // Extract probabilities
      // Output: { probabilities: Tensor }
      const probabilities = results.probabilities.data as Float32Array;

      return probabilities;
    } catch (error: any) {
      throw new ModelError(`Inference failed: ${error.message}`);
    }
  }

  /**
   * Get loaded model path
   */
  getModelPath(): string | null {
    return this.modelPath;
  }

  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.session !== null;
  }

  /**
   * Close session and free resources
   */
  async close(): Promise<void> {
    if (this.session) {
      // ONNX Runtime doesn't have explicit close in Node.js binding
      // Setting to null allows garbage collection
      this.session = null;
      this.modelPath = null;
    }
  }
}