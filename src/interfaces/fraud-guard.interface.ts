import { TransactionData, FraudCheckResult, FraudGuardConfig } from './types';

/**
 * Fraud Guard interface
 * Defines the contract for fraud detection operations
 */
export interface IFraudGuard {
  /**
   * Check a transaction for fraud
   * @param transaction - Transaction data to analyze
   * @returns Fraud check result with score and recommendation
   */
  check(transaction: TransactionData): Promise<FraudCheckResult>;

  /**
   * Get current configuration
   * @returns Current fraud guard configuration
   */
  getConfig(): FraudGuardConfig;

  /**
   * Get model information
   * @returns Model version and metadata
   */
  getModelInfo(): Promise<{
    version: string;
    aucScore: number;
    modelPath: string | null;
  }>;

  /**
   * Close fraud guard and release resources
   */
  close(): Promise<void>;
}