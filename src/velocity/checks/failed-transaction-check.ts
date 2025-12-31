import { FailedTransactionsConfig, TransactionData, VelocityCheckResult, VelocityCheckType } from '../../interfaces/types';
import { VelocityStorageQuery } from '../storage-query';
import { Logger } from '../../utils/logger';


export class FailedTransactionCheck {
  private config: FailedTransactionsConfig;
  private storageQuery: VelocityStorageQuery;
  private logger: Logger;

  constructor(
    config: FailedTransactionsConfig,
    storageQuery: VelocityStorageQuery,
    logger: Logger
  ) {
    this.config = config;
    this.storageQuery = storageQuery;
    this.logger = logger;
  }

  async check(transaction: TransactionData): Promise<VelocityCheckResult> {
    const scores: number[] = [];
    const reasons: string[] = [];

    if (!transaction.customerId) {
      return {
        type: VelocityCheckType.FAILED,
        score: 0,
        triggered: false,
        reasons: [],
      };
    }

    if (!this.config.time_windows || this.config.time_windows.length === 0) {
      return {
        type: VelocityCheckType.FAILED,
        score: 0,
        triggered: false,
        reasons: [],
      };
    }

    // Check each configured time window
    for (const window of this.config.time_windows) {
      const failedCount = await this.storageQuery.countFailedTransactions(
        transaction.customerId,
        window.period_minutes
      );

      const maxFailed = window.max_failed ? window.max_failed : 5

      if (failedCount > maxFailed) {
        scores.push(window.score_adjustment);
        reasons.push(
          `${failedCount} failed transactions in ${window.period_minutes} minutes (limit: ${maxFailed})`
        );
      }
    }

    // Use MAX across all windows
    const finalScore = scores.length > 0 ? Math.max(...scores) : 0;

    if (finalScore > 0) {
      this.logger.debug(`Failed transaction check triggered: score=${finalScore.toFixed(3)}`);
    }

    return {
      type: VelocityCheckType.FAILED,
      score: finalScore,
      triggered: finalScore > 0,
      reasons,
    };
  }
}