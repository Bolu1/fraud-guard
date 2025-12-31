import { FrequencyConfig, TransactionData, VelocityCheckResult, VelocityCheckType } from '../../interfaces/types';
import { VelocityStorageQuery } from '../storage-query';
import { Logger } from '../../utils/logger';

export class FrequencyCheck {
  private config: FrequencyConfig;
  private storageQuery: VelocityStorageQuery;
  private logger: Logger;

  constructor(config: FrequencyConfig, storageQuery: VelocityStorageQuery, logger: Logger) {
    this.config = config;
    this.storageQuery = storageQuery;
    this.logger = logger;
  }

  async check(transaction: TransactionData): Promise<VelocityCheckResult> {
    const scores: number[] = [];
    const reasons: string[] = [];

    if (!this.config.time_windows || this.config.time_windows.length === 0) {
      return {
        type: VelocityCheckType.FREQUENCY,
        score: 0,
        triggered: false,
        reasons: [],
      };
    }

    // Check each configured time window
    for (const window of this.config.time_windows) {
      const windowScores: number[] = [];
      const windowReasons: string[] = [];

      const maxTransactions = window?.max_transactions ? window?.max_transactions : 50

      // 1. Check customer frequency
      if (transaction.customerId) {
        const customerCount = await this.storageQuery.countTransactions(
          'customer_id',
          transaction.customerId,
          window.period_minutes
        );

        if (customerCount > maxTransactions) {
          windowScores.push(window.score_adjustment);
          windowReasons.push(
            `Customer: ${customerCount} transactions in ${window.period_minutes} minutes (limit: ${maxTransactions})`
          );
        }
      }

      // 2. Check device frequency (if provided)
      if (transaction.deviceId) {
        const deviceCount = await this.storageQuery.countTransactions(
          'device_id',
          transaction.deviceId,
          window.period_minutes
        );

        if (deviceCount > maxTransactions) {
          windowScores.push(window.score_adjustment);
          windowReasons.push(
            `Device: ${deviceCount} transactions in ${window.period_minutes} minutes (limit: ${maxTransactions})`
          );
        }
      }

      // 3. Check IP frequency (if provided)
      if (transaction.ipAddress) {
        const ipCount = await this.storageQuery.countTransactions(
          'ip_address',
          transaction.ipAddress,
          window.period_minutes
        );

        if (ipCount > maxTransactions) {
          windowScores.push(window.score_adjustment);
          windowReasons.push(
            `IP: ${ipCount} transactions in ${window.period_minutes} minutes (limit: ${window.max_transactions})`
          );
        }
      }

      // Use MAX for this window (no double-counting)
      if (windowScores.length > 0) {
        scores.push(Math.max(...windowScores));
        reasons.push(...windowReasons);
      }
    }

    // Use MAX across all windows
    const finalScore = scores.length > 0 ? Math.max(...scores) : 0;

    if (finalScore > 0) {
      this.logger.debug(`Frequency check triggered: score=${finalScore.toFixed(3)}`);
    }

    return {
      type: VelocityCheckType.FREQUENCY,
      score: finalScore,
      triggered: finalScore > 0,
      reasons,
    };
  }
}