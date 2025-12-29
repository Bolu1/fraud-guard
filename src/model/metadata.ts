import * as fs from 'fs';
import * as path from 'path';
import { ModelMetadata, ScalerParams } from '../interfaces/types';
import { ModelError } from '../utils/errors';

/**
 * Load model metadata from model_config.json
 */
export function loadModelMetadata(modelDir: string): ModelMetadata {
  const metadataPath = path.join(modelDir, 'model_config.json');

  if (!fs.existsSync(metadataPath)) {
    throw new ModelError(`Model metadata not found: ${metadataPath}`);
  }

  try {
    const content = fs.readFileSync(metadataPath, 'utf8');
    const metadata = JSON.parse(content) as ModelMetadata;

    validateModelMetadata(metadata);

    return metadata;
  } catch (error: any) {
    throw new ModelError(`Failed to load model metadata: ${error.message}`);
  }
}

/**
 * Load scaler parameters from scaler_params.json
 */
export function loadScalerParams(modelDir: string): ScalerParams {
  const scalerPath = path.join(modelDir, 'scaler_params.json');

  if (!fs.existsSync(scalerPath)) {
    throw new ModelError(`Scaler parameters not found: ${scalerPath}`);
  }

  try {
    const content = fs.readFileSync(scalerPath, 'utf8');
    const scaler = JSON.parse(content) as ScalerParams;

    validateScalerParams(scaler);

    return scaler;
  } catch (error: any) {
    throw new ModelError(`Failed to load scaler parameters: ${error.message}`);
  }
}

/**
 * Validate model metadata structure
 */
function validateModelMetadata(metadata: ModelMetadata): void {
  if (!metadata.feature_columns || !Array.isArray(metadata.feature_columns)) {
    throw new ModelError('Invalid model metadata: feature_columns must be an array');
  }

  if (metadata.feature_columns.length !== 19) {
    throw new ModelError(
      `Invalid model metadata: expected 19 features, got ${metadata.feature_columns.length}`
    );
  }

  if (!metadata.input_shape || !Array.isArray(metadata.input_shape)) {
    throw new ModelError('Invalid model metadata: input_shape must be an array');
  }

  if (!metadata.required_fields || !Array.isArray(metadata.required_fields)) {
    throw new ModelError('Invalid model metadata: required_fields must be an array');
  }
}

/**
 * Validate scaler parameters structure
 */
function validateScalerParams(scaler: ScalerParams): void {
  if (!scaler.mean || !Array.isArray(scaler.mean)) {
    throw new ModelError('Invalid scaler parameters: mean must be an array');
  }

  if (!scaler.std || !Array.isArray(scaler.std)) {
    throw new ModelError('Invalid scaler parameters: std must be an array');
  }

  if (!scaler.feature_columns || !Array.isArray(scaler.feature_columns)) {
    throw new ModelError('Invalid scaler parameters: feature_columns must be an array');
  }

  if (scaler.mean.length !== scaler.std.length) {
    throw new ModelError('Invalid scaler parameters: mean and std must have same length');
  }

  if (scaler.mean.length !== scaler.feature_columns.length) {
    throw new ModelError(
      'Invalid scaler parameters: mean length must match feature_columns length'
    );
  }

  if (scaler.feature_columns.length !== 19) {
    throw new ModelError(
      `Invalid scaler parameters: expected 19 features, got ${scaler.feature_columns.length}`
    );
  }
}