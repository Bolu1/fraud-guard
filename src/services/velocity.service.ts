import { TransactionData, VelocityResult, VelocityConfig, VelocityCheckType } from '../interfaces/types';
import { StorageManager } from '../storage/manager';
import { VelocityStorageQuery } from '../velocity/storage-query';
import { FrequencyCheck } from '../velocity/checks/frequency-check';
import { AmountCheck } from '../velocity/checks/amount-check';
import { FailedTransactionCheck } from '../velocity/checks/failed-transaction-check';
import { VelocityResultAggregator } from '../velocity/result-aggregator';
import { Logger } from '../utils/logger';

export class VelocityService {
  private config: VelocityConfig;
  private storageQuery: VelocityStorageQuery;
  private frequencyCheck: FrequencyCheck;
  private amountCheck: AmountCheck;
  private failedTransactionCheck: FailedTransactionCheck;
  private resultAggregator: VelocityResultAggregator;
  private logger: Logger;

  constructor(config: VelocityConfig, storageManager: StorageManager, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Initialize storage query helper
    this.storageQuery = new VelocityStorageQuery(storageManager);

    // Initialize individual check classes
    this.frequencyCheck = new FrequencyCheck(
      config.frequency || {},
      this.storageQuery,
      logger
    );

    this.amountCheck = new AmountCheck(config.amount || {}, this.storageQuery, logger);

    this.failedTransactionCheck = new FailedTransactionCheck(
      config.failed_transactions || {},
      this.storageQuery,
      logger
    );

    // Initialize result aggregator
    this.resultAggregator = new VelocityResultAggregator();

    this.logger.debug('Velocity service initialized');
  }

  /**
   * Run all enabled velocity checks in parallel
   */
  async checkVelocity(transaction: TransactionData): Promise<VelocityResult> {
    this.logger.debug('Running velocity checks...');

    const checkPromises: Array<{ name: string; promise: Promise<any> }> = [];

    // 1. Frequency check (if enabled)
    if (this.config.frequency?.enabled) {
      checkPromises.push({
        name: VelocityCheckType.FREQUENCY,
        promise: this.frequencyCheck.check(transaction),
      });
    }

    // 2. Amount check (if enabled)
    if (this.config.amount?.enabled) {
      checkPromises.push({
        name: VelocityCheckType.AMOUNT,
        promise: this.amountCheck.check(transaction),
      });
    }

    // 3. Failed transaction check (if enabled)
    if (this.config.failed_transactions?.enabled) {
      checkPromises.push({
        name: VelocityCheckType.FAILED,
        promise: this.failedTransactionCheck.check(transaction),
      });
    }

    // If no checks are enabled, return zero score
    if (checkPromises.length === 0) {
      this.logger.debug('No velocity checks enabled');
      return {
        score: 0,
        reasons: [],
        checks: [],
      };
    }

    // Execute all checks in parallel with error handling
    const settledResults = await Promise.allSettled(checkPromises.map((c) => c.promise));

    const results: any[] = [];

    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // One check failed - log but continue with other checks
        this.logger.error(
          `Velocity check '${checkPromises[index].name}' failed: ${result.reason.message}`
        );

        // Add a zero-score result so aggregation still works
        results.push({
          type: checkPromises[index].name,
          score: 0,
          triggered: false,
          reasons: [],
        });
      }
    });

    // Aggregate results using MAX strategy
    const aggregatedResult = this.resultAggregator.aggregate(results);

    this.logger.debug(`Velocity checks complete: score=${aggregatedResult.score.toFixed(3)}`);

    return aggregatedResult;
  }
}