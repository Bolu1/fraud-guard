import { TransactionData, FeatureVector, TransactionCategory } from '../interfaces/types';
import { extractTimeFeatures } from '../utils/time-features';
import { ModelError } from '../utils/errors';

/**
 * Extract features from transaction data
 * Converts 6 input fields → 19 features for model
 */
export function extractFeatures(transaction: TransactionData): FeatureVector {
  const timeFeatures = extractTimeFeatures(transaction.timestamp);

  const categoryOneHot = oneHotEncodeCategory(transaction.category);

  const features: FeatureVector = {
    amt: transaction.amount,
    hour: timeFeatures.hour,
    month: timeFeatures.month,
    dayofweek: timeFeatures.dayofweek,
    day: timeFeatures.day,
    ...categoryOneHot,
  };

  return features;
}

/**
 * One-hot encode transaction category
 * Returns object with 14 binary features (one per category)
 */
function oneHotEncodeCategory(category: TransactionCategory): {
  entertainment: number;
  food_dining: number;
  gas_transport: number;
  grocery_net: number;
  grocery_pos: number;
  health_fitness: number;
  home: number;
  kids_pets: number;
  misc_net: number;
  misc_pos: number;
  personal_care: number;
  shopping_net: number;
  shopping_pos: number;
  travel: number;
} {
  const encoded = {
    entertainment: 0,
    food_dining: 0,
    gas_transport: 0,
    grocery_net: 0,
    grocery_pos: 0,
    health_fitness: 0,
    home: 0,
    kids_pets: 0,
    misc_net: 0,
    misc_pos: 0,
    personal_care: 0,
    shopping_net: 0,
    shopping_pos: 0,
    travel: 0,
  };

  switch (category) {
    case TransactionCategory.ENTERTAINMENT:
      encoded.entertainment = 1;
      break;
    case TransactionCategory.FOOD_DINING:
      encoded.food_dining = 1;
      break;
    case TransactionCategory.GAS_TRANSPORT:
      encoded.gas_transport = 1;
      break;
    case TransactionCategory.GROCERY_NET:
      encoded.grocery_net = 1;
      break;
    case TransactionCategory.GROCERY_POS:
      encoded.grocery_pos = 1;
      break;
    case TransactionCategory.HEALTH_FITNESS:
      encoded.health_fitness = 1;
      break;
    case TransactionCategory.HOME:
      encoded.home = 1;
      break;
    case TransactionCategory.KIDS_PETS:
      encoded.kids_pets = 1;
      break;
    case TransactionCategory.MISC_NET:
      encoded.misc_net = 1;
      break;
    case TransactionCategory.MISC_POS:
      encoded.misc_pos = 1;
      break;
    case TransactionCategory.PERSONAL_CARE:
      encoded.personal_care = 1;
      break;
    case TransactionCategory.SHOPPING_NET:
      encoded.shopping_net = 1;
      break;
    case TransactionCategory.SHOPPING_POS:
      encoded.shopping_pos = 1;
      break;
    case TransactionCategory.TRAVEL:
      encoded.travel = 1;
      break;
    default:
      throw new ModelError(`Unknown category: ${category}`);
  }

  return encoded;
}

/**
 * Convert feature vector to ordered array matching scaler feature columns
 */
export function featureVectorToArray(
  features: FeatureVector,
  featureColumns: string[]
): number[] {
  const featureArray: number[] = [];

  for (const column of featureColumns) {
    const value = features[column as keyof FeatureVector];

    if (value === undefined) {
      throw new ModelError(`Missing feature: ${column}`);
    }

    featureArray.push(value);
  }

  return featureArray;
}

/**
 * Standardize features using scaler parameters
 */
export function standardizeFeatures(features: number[], mean: number[], std: number[]): number[] {
  if (features.length !== mean.length || features.length !== std.length) {
    throw new ModelError('Feature array length must match scaler parameters length');
  }

  const standardized: number[] = [];

  for (let i = 0; i < features.length; i++) {
    const standardizedValue = (features[i] - mean[i]) / std[i];

    if (!isFinite(standardizedValue)) {
      throw new ModelError(`Invalid standardized value at index ${i}: ${standardizedValue}`);
    }

    standardized.push(standardizedValue);
  }

  return standardized;
}

/**
 * Reshape features for CNN model input
 * Model expects shape: [batch_size, features, channels]
 * We provide: [1, 19, 1]
 */
export function reshapeForModel(features: number[]): number[][][] {
  return [features.map((f) => [f])];
}