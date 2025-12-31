import { AmountConfig, TransactionData, VelocityCheckResult, VelocityCheckType } from '../../interfaces/types';
import { VelocityStorageQuery } from '../storage-query';
import { Logger } from '../../utils/logger';

export class AmountCheck {
  private config: AmountConfig;
  private storageQuery: VelocityStorageQuery;
  private logger: Logger;
  private readonly MIN_HISTORY_DAYS = 28; // 4 weeks

  constructor(config: AmountConfig, storageQuery: VelocityStorageQuery, logger: Logger) {
    this.config = config;
    this.storageQuery = storageQuery;
    this.logger = logger;
  }

  async check(transaction: TransactionData): Promise<VelocityCheckResult> {
    const scores: number[] = [];
    const reasons: string[] = [];

    if (!transaction.customerId) {
      return {
        type: VelocityCheckType.AMOUNT,
        score: 0,
        triggered: false,
        reasons: [],
      };
    }

    // 1. Check time window amounts
    if (this.config.time_windows && this.config.time_windows.length > 0) {
      for (const window of this.config.time_windows) {
        const totalAmount = await this.storageQuery.sumAmounts(
          transaction.customerId,
          window.period_minutes
        );

        const maxAmount = window?.max_amount ? window?.max_amount : 5000

        if (totalAmount > maxAmount ) {
          scores.push(window.score_adjustment);
          reasons.push(
            `$${totalAmount.toFixed(2)} spent in ${window.period_minutes} minutes (limit: $${window.max_amount})`
          );
        }
      }
    }

    // 2. Check spending spike (if enabled)
    if (this.config.spike_detection?.enabled) {
      const spikeResult = await this.checkSpendingSpike(transaction.customerId);
      if (spikeResult.triggered) {
        scores.push(spikeResult.score);
        reasons.push(...spikeResult.reasons);
      }
    }

    // Use MAX across all checks
    const finalScore = scores.length > 0 ? Math.max(...scores) : 0;

    if (finalScore > 0) {
      this.logger.debug(`Amount check triggered: score=${finalScore.toFixed(3)}`);
    }

    return {
      type: VelocityCheckType.AMOUNT,
      score: finalScore,
      triggered: finalScore > 0,
      reasons,
    };
  }

  private async checkSpendingSpike(
    customerId: string
  ): Promise<{ triggered: boolean; score: number; reasons: string[] }> {
    // Get customer age (days since first transaction)
    const customerAgeDays = await this.storageQuery.getCustomerAgeDays(customerId);

    // Skip spike detection for customers with < 28 days history
    if (customerAgeDays < this.MIN_HISTORY_DAYS) {
      this.logger.debug(
        `Customer ${customerId} has ${customerAgeDays} days of history (< ${this.MIN_HISTORY_DAYS} days) - skipping spike detection`
      );
      return { triggered: false, score: 0, reasons: [] };
    }

    // Customer has enough history - run spike detection
    const lookbackDays = this.config.spike_detection?.lookback_days || 28;
    const avgDailySpending = await this.storageQuery.getAverageDailySpending(
      customerId,
      lookbackDays
    );

    const todaySpending = await this.storageQuery.getTodaySpending(customerId);

    // Only calculate spike if there's actual spending history
    if (avgDailySpending === 0) {
      return { triggered: false, score: 0, reasons: [] };
    }

    const multiplier = todaySpending / avgDailySpending;
    const configMultiplier = this.config.spike_detection?.multiplier || 5;

    if (multiplier >= configMultiplier) {
      const score = this.config.spike_detection?.score_adjustment || 0.4;
      const reason = `Spending spike: ${multiplier.toFixed(1)}x normal (today: $${todaySpending.toFixed(2)}, avg: $${avgDailySpending.toFixed(2)})`;

      return {
        triggered: true,
        score,
        reasons: [reason],
      };
    }

    return { triggered: false, score: 0, reasons: [] };
  }
}