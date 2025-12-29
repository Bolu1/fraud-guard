import { TransactionData, TransactionCategory } from '../interfaces/types';
import { ValidationError } from './errors';

export function validateTransaction(transaction: TransactionData): void {
  if (!transaction) {
    throw new ValidationError('Transaction data is required');
  }

  validateAmount(transaction.amount);

  validateTimestamp(transaction.timestamp);

  validateCategory(transaction.category);

  if (transaction.id !== undefined) {
    validateTransactionId(transaction.id);
  }

  if (transaction.customerId !== undefined) {
    validateCustomerId(transaction.customerId);
  }

  if (transaction.walletBalance !== undefined) {
    validateWalletBalance(transaction.walletBalance);
  }

  if (transaction.ipAddress !== undefined) {
    validateIpAddress(transaction.ipAddress);
  }

  if (transaction.deviceId !== undefined) {
    validateDeviceId(transaction.deviceId);
  }
}

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

export function validateTimestamp(timestamp: any): void {
  if (!timestamp) {
    throw new ValidationError('Field "timestamp" is required');
  }

  if (!(timestamp instanceof Date)) {
    throw new ValidationError('Field "timestamp" must be a Date object');
  }

  if (isNaN(timestamp.getTime())) {
    throw new ValidationError('Field "timestamp" is an invalid Date');
  }
}

export function validateCategory(category: any): void {
  if (!category) {
    throw new ValidationError('Field "category" is required');
  }

  if (typeof category !== 'string') {
    throw new ValidationError('Field "category" must be a string');
  }

  const validCategories = Object.values(TransactionCategory);
  if (!validCategories.includes(category as TransactionCategory)) {
    throw new ValidationError(
      `Invalid category: "${category}". Must be one of: ${validCategories.join(', ')}`
    );
  }
}

export function validateTransactionId(id: any): void {
  if (typeof id !== 'string') {
    throw new ValidationError('Transaction ID must be a string');
  }

  if (id.trim().length === 0) {
    throw new ValidationError('Transaction ID cannot be empty');
  }
}

export function validateCustomerId(customerId: any): void {
  if (typeof customerId !== 'string') {
    throw new ValidationError('Customer ID must be a string');
  }

  if (customerId.trim().length === 0) {
    throw new ValidationError('Customer ID cannot be empty');
  }
}

export function validateWalletBalance(balance: any): void {
  if (typeof balance !== 'number') {
    throw new ValidationError('Wallet balance must be a number');
  }

  if (balance < 0) {
    throw new ValidationError('Wallet balance must be non-negative');
  }

  if (!isFinite(balance)) {
    throw new ValidationError('Wallet balance must be a finite number');
  }
}

export function validateIpAddress(ip: any): void {
  if (typeof ip !== 'string') {
    throw new ValidationError('IP address must be a string');
  }

  if (ip.trim().length === 0) {
    throw new ValidationError('IP address cannot be empty');
  }
}

export function validateDeviceId(deviceId: any): void {
  if (typeof deviceId !== 'string') {
    throw new ValidationError('Device ID must be a string');
  }

  if (deviceId.trim().length === 0) {
    throw new ValidationError('Device ID cannot be empty');
  }
}

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