import {
  TransactionData,
  TransactionType,
  FeatureVector,
  ModelMetadata,
} from '../interfaces/types';
import { ValidationError } from '../utils/errors';

/**
 * Feature extractor for fraud detection
 * Extracts and engineers features from transaction data
 */
export class FeatureExtractor {
  private metadata: ModelMetadata;
  private typeEncoder: Map<TransactionType, number>;

  constructor(metadata: ModelMetadata) {
    this.metadata = metadata;
    this.typeEncoder = this.buildTypeEncoder();
  }

  /**
   * Build transaction type encoder from metadata
   */
  private buildTypeEncoder(): Map<TransactionType, number> {
    const encoder = new Map<TransactionType, number>();

    // Map from metadata type_encoder_classes
    // ['CASH_IN', 'CASH_OUT', 'DEBIT', 'PAYMENT', 'TRANSFER']
    this.metadata.type_encoder_classes.forEach((type, index) => {
      encoder.set(type as TransactionType, index);
    });

    return encoder;
  }

  /**
   * Extract and engineer features from transaction data
   */
  extract(transaction: TransactionData): FeatureVector {
    // Validate transaction has all required fields
    this.validateTransaction(transaction);

    // Encode transaction type
    const typeEncoded = this.encodeType(transaction.type);

    // Calculate engineered features
    const originBalanceDiff = transaction.oldBalanceOrigin - transaction.newBalanceOrigin;
    const destinationBalanceDiff =
      transaction.newBalanceDestination - transaction.oldBalanceDestination;

    const originZeroBalance = transaction.oldBalanceOrigin === 0 ? 1 : 0;
    const destinationZeroBalance = transaction.oldBalanceDestination === 0 ? 1 : 0;

    const amountToBalanceRatio = transaction.amount / (transaction.oldBalanceOrigin + 1);

    // Return feature vector matching model's expected order
    return {
      step: transaction.step,
      typeEncoded,
      amount: transaction.amount,
      oldBalanceOrigin: transaction.oldBalanceOrigin,
      newBalanceOrigin: transaction.newBalanceOrigin,
      oldBalanceDestination: transaction.oldBalanceDestination,
      newBalanceDestination: transaction.newBalanceDestination,
      originBalanceDiff,
      destinationBalanceDiff,
      originZeroBalance,
      destinationZeroBalance,
      amountToBalanceRatio,
    };
  }

  /**
   * Standardize features using scaler parameters from metadata
   */
  standardize(features: FeatureVector): Float32Array {
    const featureArray = this.featureVectorToArray(features);
    const scalerMean = this.metadata.scaler_mean;
    const scalerScale = this.metadata.scaler_scale;

    const standardized = featureArray.map((value, index) => {
      return (value - scalerMean[index]) / scalerScale[index];
    });

    return Float32Array.from(standardized);
  }

  /**
   * Convert feature vector object to array in correct order
   */
  private featureVectorToArray(features: FeatureVector): number[] {
    return [
      features.step,
      features.typeEncoded,
      features.amount,
      features.oldBalanceOrigin,
      features.newBalanceOrigin,
      features.oldBalanceDestination,
      features.newBalanceDestination,
      features.originBalanceDiff,
      features.destinationBalanceDiff,
      features.originZeroBalance,
      features.destinationZeroBalance,
      features.amountToBalanceRatio,
    ];
  }

  /**
   * Encode transaction type to numeric value
   */
  private encodeType(type: TransactionType): number {
    const encoded = this.typeEncoder.get(type);

    if (encoded === undefined) {
      throw new ValidationError(
        `Unknown transaction type: ${type}. Valid types: ${Array.from(this.typeEncoder.keys()).join(', ')}`
      );
    }

    return encoded;
  }

  /**
   * Validate transaction has all required fields
   */
/**
 * Validate transaction has all required fields
 */
private validateTransaction(transaction: TransactionData): void {
  // Check required fields exist
  if (transaction.step === undefined || transaction.step === null) {
    throw new ValidationError('Missing required field: step');
  }
  if (transaction.type === undefined || transaction.type === null) {
    throw new ValidationError('Missing required field: type');
  }
  if (transaction.amount === undefined || transaction.amount === null) {
    throw new ValidationError('Missing required field: amount');
  }
  if (transaction.oldBalanceOrigin === undefined || transaction.oldBalanceOrigin === null) {
    throw new ValidationError('Missing required field: oldBalanceOrigin');
  }
  if (transaction.newBalanceOrigin === undefined || transaction.newBalanceOrigin === null) {
    throw new ValidationError('Missing required field: newBalanceOrigin');
  }
  if (transaction.oldBalanceDestination === undefined || transaction.oldBalanceDestination === null) {
    throw new ValidationError('Missing required field: oldBalanceDestination');
  }
  if (transaction.newBalanceDestination === undefined || transaction.newBalanceDestination === null) {
    throw new ValidationError('Missing required field: newBalanceDestination');
  }

  // Validate types
  if (typeof transaction.step !== 'number') {
    throw new ValidationError('Field "step" must be a number');
  }

  if (!Object.values(TransactionType).includes(transaction.type)) {
    throw new ValidationError(
      `Invalid transaction type: ${transaction.type}. Must be one of: ${Object.values(TransactionType).join(', ')}`
    );
  }

  if (typeof transaction.amount !== 'number' || transaction.amount < 0) {
    throw new ValidationError('Field "amount" must be a non-negative number');
  }

  // Validate balances
  if (typeof transaction.oldBalanceOrigin !== 'number' || transaction.oldBalanceOrigin < 0) {
    throw new ValidationError('Field "oldBalanceOrigin" must be a non-negative number');
  }

  if (typeof transaction.newBalanceOrigin !== 'number' || transaction.newBalanceOrigin < 0) {
    throw new ValidationError('Field "newBalanceOrigin" must be a non-negative number');
  }

  if (typeof transaction.oldBalanceDestination !== 'number' || transaction.oldBalanceDestination < 0) {
    throw new ValidationError('Field "oldBalanceDestination" must be a non-negative number');
  }

  if (typeof transaction.newBalanceDestination !== 'number' || transaction.newBalanceDestination < 0) {
    throw new ValidationError('Field "newBalanceDestination" must be a non-negative number');
  }
}
}