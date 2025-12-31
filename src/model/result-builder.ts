import { nanoid } from 'nanoid';
import {
  FraudCheckResult,
  PredictionResult,
  TransactionData,
} from '../interfaces/types';
import { determineAction, determineRiskLevel } from '../utils/result-builder';

/**
 * Build fraud check result from model prediction
 */
export function buildFraudCheckResult(
  transaction: TransactionData,
  prediction: PredictionResult,
  thresholds: { review: number; reject: number },
  modelVersion: string,
  velocityScore?: number,
  velocityReasons?: string[]
): FraudCheckResult {
  const checkId = nanoid();

  const modelScore = prediction.score;
  const finalVelocityScore = velocityScore || 0;

  // Final score is just model score for now (will be overridden by FraudGuard)
  const finalScore = modelScore;

  const risk = determineRiskLevel(finalScore, thresholds);
  const action = determineAction(finalScore, thresholds);

  const reasons = [...generateReasons(prediction, transaction)];
  if (velocityReasons && velocityReasons.length > 0) {
    reasons.push(...velocityReasons);
  }

  return {
    id: checkId,
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    modelScore: modelScore,
    velocityScore: finalVelocityScore,
    score: finalScore,
    risk,
    action,
    reasons,
    modelVersion,
  };
}


/**
 * Generate human-readable reasons for the decision
 */
function generateReasons(prediction: PredictionResult, transaction: TransactionData): string[] {
  const reasons: string[] = [];

  const score = prediction.score;

  if (score >= 0.7) {
    reasons.push('High fraud probability detected by AI model');
  } else if (score >= 0.4) {
    reasons.push('Moderate fraud risk indicated by transaction patterns');
  } else {
    reasons.push('Transaction appears legitimate based on AI analysis');
  }

  return reasons;
}