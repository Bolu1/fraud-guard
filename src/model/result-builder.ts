import { nanoid } from 'nanoid';
import {
  FraudCheckResult,
  TransactionData,
  RiskLevel,
  Action,
  ModelConfig,
} from '../interfaces/types';
import { PredictionResult } from './manager';

/**
 * Build FraudCheckResult from prediction
 */
export class ResultBuilder {
  private reviewThreshold: number;
  private rejectThreshold: number;
  private modelVersion: string;

  constructor(modelConfig: ModelConfig, modelVersion: string) {
    this.reviewThreshold = modelConfig.thresholds?.review || 0.4;
    this.rejectThreshold = modelConfig.thresholds?.reject || 0.7;
    this.modelVersion = modelVersion;
  }

  /**
   * Build complete fraud check result
   */
  build(transaction: TransactionData, prediction: PredictionResult): FraudCheckResult {
    const checkId = this.generateCheckId();
    const score = prediction.score;
    const isFraud = prediction.label === 1;
    const risk = this.determineRiskLevel(score);
    const action = this.determineAction(score);
    const reasons = this.generateReasons(transaction, prediction, risk);

    return {
      id: checkId,
      transactionId: transaction.id,
      score,
      isFraud,
      risk,
      action,
      reasons,
      timestamp: new Date(),
      modelVersion: this.modelVersion,
    };
  }

  /**
   * Generate unique check ID
   */
  private generateCheckId(): string {
    return `check_${nanoid(16)}`;
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(score: number): RiskLevel {
    if (score >= this.rejectThreshold) {
      return RiskLevel.HIGH;
    } else if (score >= this.reviewThreshold) {
      return RiskLevel.MEDIUM;
    } else {
      return RiskLevel.LOW;
    }
  }

  /**
   * Determine recommended action based on score
   */
  private determineAction(score: number): Action {
    if (score >= this.rejectThreshold) {
      return Action.REJECT;
    } else if (score >= this.reviewThreshold) {
      return Action.REVIEW;
    } else {
      return Action.ACCEPT;
    }
  }

  /**
   * Generate human-readable reasons for the decision
   */
  private generateReasons(
    transaction: TransactionData,
    prediction: PredictionResult,
    risk: RiskLevel
  ): string[] {
    const reasons: string[] = [];

    // Primary reason based on fraud score
    if (risk === RiskLevel.HIGH) {
      reasons.push(`High fraud probability: ${(prediction.score * 100).toFixed(1)}%`);
    } else if (risk === RiskLevel.MEDIUM) {
      reasons.push(`Moderate fraud probability: ${(prediction.score * 100).toFixed(1)}%`);
    } else {
      reasons.push(`Low fraud probability: ${(prediction.score * 100).toFixed(1)}%`);
    }

    // Transaction type context
    reasons.push(`Transaction type: ${transaction.type}`);

    // Balance-based reasons
    const originBalanceDiff = transaction.oldBalanceOrigin - transaction.newBalanceOrigin;
    if (transaction.oldBalanceOrigin > 0 && originBalanceDiff === transaction.amount) {
      reasons.push('Exact balance deduction matches amount');
    }

    if (transaction.oldBalanceOrigin === 0) {
      reasons.push('Origin account has zero balance');
    }

    if (transaction.oldBalanceDestination === 0 && transaction.newBalanceDestination === 0) {
      reasons.push('Destination account remains at zero balance');
    }

    // Amount to balance ratio
    const ratio = transaction.amount / (transaction.oldBalanceOrigin + 1);
    if (ratio > 0.9 && transaction.oldBalanceOrigin > 0) {
      reasons.push('Transaction amount is majority of origin balance');
    }

    return reasons;
  }

  /**
   * Update thresholds dynamically
   */
  updateThresholds(review: number, reject: number): void {
    this.reviewThreshold = review;
    this.rejectThreshold = reject;
  }

  /**
   * Get current thresholds
   */
  getThresholds(): { review: number; reject: number } {
    return {
      review: this.reviewThreshold,
      reject: this.rejectThreshold,
    };
  }
}