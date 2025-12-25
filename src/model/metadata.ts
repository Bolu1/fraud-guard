import * as fs from 'fs';
import { ModelMetadata } from '../interfaces/types';
import { ModelError } from '../utils/errors';
import { validateModelMetadata } from '../utils/validation';

/**
 * Model metadata loader
 * Loads and validates model metadata from JSON file
 */
export class MetadataLoader {
  /**
   * Load metadata from file
   */
  static load(metadataPath: string): ModelMetadata {
    try {
      // Check file exists
      if (!fs.existsSync(metadataPath)) {
        throw new ModelError(`Metadata file not found: ${metadataPath}`);
      }

      // Read file
      const fileContent = fs.readFileSync(metadataPath, 'utf8');

      // Parse JSON
      const metadata = JSON.parse(fileContent);

      // Validate structure
      validateModelMetadata(metadata);

      return metadata as ModelMetadata;
    } catch (error: any) {
      if (error instanceof ModelError) {
        throw error;
      }

      if (error.name === 'SyntaxError') {
        throw new ModelError(`Invalid JSON in metadata file: ${error.message}`);
      }

      throw new ModelError(`Failed to load metadata: ${error.message}`);
    }
  }

  /**
   * Get model version from metadata
   */
  static getVersion(metadata: ModelMetadata): string {
    return metadata.model_version;
  }

  /**
   * Get AUC score from metadata
   */
  static getAucScore(metadata: ModelMetadata): number {
    return metadata.auc_score || 0;
  }

  /**
   * Get feature count from metadata
   */
  static getFeatureCount(metadata: ModelMetadata): number {
    return metadata.feature_columns.length;
  }

  /**
   * Get transaction types from metadata
   */
  static getTransactionTypes(metadata: ModelMetadata): string[] {
    return metadata.type_encoder_classes;
  }
}