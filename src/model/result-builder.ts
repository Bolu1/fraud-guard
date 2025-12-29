import { nanoid } from 'nanoid';
import {
  FraudCheckResult,
  PredictionResult,
  TransactionData,
  RiskLevel,
  Action,
} from '../interfaces/types';

/**
 * Build fraud check result from model prediction
 */
export function buildFraudCheckResult(
  transaction: TransactionData,
  prediction: PredictionResult,
  thresholds: { review: number; reject: number },
  modelVersion: string
): FraudCheckResult {
  const checkId = generateCheckId();
  const risk = determineRiskLevel(prediction.score, thresholds);
  const action = determineAction(prediction.score, thresholds);
  const reasons = generateReasons(transaction, prediction, risk, action);

  const result: FraudCheckResult = {
    id: checkId,
    transactionId: transaction.id,
    score: prediction.score,
    risk: risk,
    action: action,
    reasons: reasons,
    timestamp: new Date(),
    modelVersion: modelVersion,
  };

  return result;
}

/**
 * Generate unique check ID
 */
function generateCheckId(): string {
  return `check_${nanoid(16)}`;
}

/**
 * Determine risk level based on score
 */
function determineRiskLevel(score: number, thresholds: { review: number; reject: number }): RiskLevel {
  if (score >= thresholds.reject) {
    return RiskLevel.HIGH;
  }

  if (score >= thresholds.review) {
    return RiskLevel.MEDIUM;
  }

  return RiskLevel.LOW;
}

/**
 * Determine recommended action based on score
 */
function determineAction(score: number, thresholds: { review: number; reject: number }): Action {
  if (score >= thresholds.reject) {
    return Action.REJECT;
  }

  if (score >= thresholds.review) {
    return Action.REVIEW;
  }

  return Action.ACCEPT;
}

/**
 * Generate human-readable reasons for the decision
 */
function generateReasons(
  transaction: TransactionData,
  prediction: PredictionResult,
  risk: RiskLevel,
  action: Action
): string[] {
  const reasons: string[] = [];

  if (risk === RiskLevel.HIGH) {
    reasons.push(`High fraud probability: ${(prediction.score * 100).toFixed(1)}%`);
  } else if (risk === RiskLevel.MEDIUM) {
    reasons.push(`Medium fraud probability: ${(prediction.score * 100).toFixed(1)}%`);
  } else {
    reasons.push(`Low fraud probability: ${(prediction.score * 100).toFixed(1)}%`);
  }

  if (transaction.amount >= 1000) {
    reasons.push('High transaction amount');
  }

  const hour = transaction.timestamp.getHours();
  if (hour >= 0 && hour <= 5) {
    reasons.push('Unusual transaction time (late night/early morning)');
  }

  if (transaction.category === 'travel' || transaction.category === 'misc_net') {
    reasons.push('Transaction category has elevated fraud risk');
  }

  if (action === Action.REJECT) {
    reasons.push('Recommendation: Block transaction and notify customer');
  } else if (action === Action.REVIEW) {
    reasons.push('Recommendation: Manual review required');
  } else {
    reasons.push('Recommendation: Approve transaction');
  }

  return reasons;
}