import { TransactionData, TransactionType } from '../interfaces/types';
import { ValidationError } from './errors';

/**
 * Validate transaction data
 */
export function validateTransaction(transaction: TransactionData): void {
  if (!transaction) {
    throw new ValidationError('Transaction data is required');
  }

  // Validate step
  validateStep(transaction.step);

  // Validate type
  validateTransactionType(transaction.type);

  // Validate amount
  validateAmount(transaction.amount);

  // Validate balances
  validateBalance(transaction.oldBalanceOrigin, 'oldBalanceOrigin');
  validateBalance(transaction.newBalanceOrigin, 'newBalanceOrigin');
  validateBalance(transaction.oldBalanceDestination, 'oldBalanceDestination');
  validateBalance(transaction.newBalanceDestination, 'newBalanceDestination');
}

/**
 * Validate step field
 */
export function validateStep(step: any): void {
  if (step === undefined || step === null) {
    throw new ValidationError('Field "step" is required');
  }

  if (typeof step !== 'number') {
    throw new ValidationError('Field "step" must be a number');
  }

  if (step < 0) {
    throw new ValidationError('Field "step" must be non-negative');
  }

  if (!Number.isInteger(step)) {
    throw new ValidationError('Field "step" must be an integer');
  }
}

/**
 * Validate transaction type
 */
export function validateTransactionType(type: any): void {
  if (!type) {
    throw new ValidationError('Field "type" is required');
  }

  if (typeof type !== 'string') {
    throw new ValidationError('Field "type" must be a string');
  }

  const validTypes = Object.values(TransactionType);
  if (!validTypes.includes(type as TransactionType)) {
    throw new ValidationError(
      `Invalid transaction type: "${type}". Must be one of: ${validTypes.join(', ')}`
    );
  }
}

/**
 * Validate amount
 */
export function validateAmount(amount: any): void {
  if (amount === undefined || amount === null) {
    throw new ValidationError('Field "amount" is required');
  }

  if (typeof amount !== 'number') {
    throw new ValidationError('Field "amount" must be a number');
  }

  if (amount < 0) {
    throw new ValidationError('Field "amount" must be non-negative');
  }

  if (!isFinite(amount)) {
    throw new ValidationError('Field "amount" must be a finite number');
  }
}

/**
 * Validate balance field
 */
export function validateBalance(balance: any, fieldName: string): void {
  if (balance === undefined || balance === null) {
    throw new ValidationError(`Field "${fieldName}" is required`);
  }

  if (typeof balance !== 'number') {
    throw new ValidationError(`Field "${fieldName}" must be a number`);
  }

  if (balance < 0) {
    throw new ValidationError(`Field "${fieldName}" must be non-negative`);
  }

  if (!isFinite(balance)) {
    throw new ValidationError(`Field "${fieldName}" must be a finite number`);
  }
}

/**
 * Validate check ID format
 */
export function validateCheckId(checkId: any): void {
  if (!checkId) {
    throw new ValidationError('Check ID is required');
  }

  if (typeof checkId !== 'string') {
    throw new ValidationError('Check ID must be a string');
  }

  if (checkId.trim().length === 0) {
    throw new ValidationError('Check ID cannot be empty');
  }
}

/**
 * Validate threshold value (0-1 range)
 */
export function validateThreshold(value: any, name: string): void {
  if (value === undefined || value === null) {
    throw new ValidationError(`${name} is required`);
  }

  if (typeof value !== 'number') {
    throw new ValidationError(`${name} must be a number`);
  }

  if (value < 0 || value > 1) {
    throw new ValidationError(`${name} must be between 0 and 1, got ${value}`);
  }
}

/**
 * Sanitize transaction data (remove any unexpected fields)
 */
export function sanitizeTransaction(transaction: any): TransactionData {
  return {
    step: transaction.step,
    type: transaction.type,
    amount: transaction.amount,
    oldBalanceOrigin: transaction.oldBalanceOrigin,
    newBalanceOrigin: transaction.newBalanceOrigin,
    oldBalanceDestination: transaction.oldBalanceDestination,
    newBalanceDestination: transaction.newBalanceDestination,
    id: transaction.id,
    timestamp: transaction.timestamp,
  };
}

/**
 * Validate model metadata structure
 */
export function validateModelMetadata(metadata: any): void {
  if (!metadata) {
    throw new ValidationError('Model metadata is required');
  }

  // Required fields
  const requiredFields = [
    'feature_columns',
    'type_encoder_classes',
    'scaler_mean',
    'scaler_scale',
    'model_version',
  ];

  for (const field of requiredFields) {
    if (!(field in metadata)) {
      throw new ValidationError(`Model metadata missing required field: ${field}`);
    }
  }

  // Validate arrays
  if (!Array.isArray(metadata.feature_columns) || metadata.feature_columns.length !== 12) {
    throw new ValidationError('Model metadata "feature_columns" must be an array of 12 elements');
  }

  if (!Array.isArray(metadata.type_encoder_classes) || metadata.type_encoder_classes.length !== 5) {
    throw new ValidationError(
      'Model metadata "type_encoder_classes" must be an array of 5 elements'
    );
  }

  if (!Array.isArray(metadata.scaler_mean) || metadata.scaler_mean.length !== 12) {
    throw new ValidationError('Model metadata "scaler_mean" must be an array of 12 elements');
  }

  if (!Array.isArray(metadata.scaler_scale) || metadata.scaler_scale.length !== 12) {
    throw new ValidationError('Model metadata "scaler_scale" must be an array of 12 elements');
  }

  // Validate version
  if (typeof metadata.model_version !== 'string') {
    throw new ValidationError('Model metadata "model_version" must be a string');
  }
}