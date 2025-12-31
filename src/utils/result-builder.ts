import { Action, FraudCheckResult, RiskLevel, ThresholdsConfig, TransactionData } from "../interfaces/types";

export async function buildResult(
  transaction: TransactionData,
  modelPrediction: any,
  modelScore: number,
  velocityScore: number,
  finalScore: number,
  velocityReasons: string[],
  thresholdsConfig: ThresholdsConfig,
  modelVersion: any
): Promise<FraudCheckResult> {
  const { nanoid } = await import("nanoid");
  const checkId = nanoid();

  const thresholds = {
    review: thresholdsConfig?.review || 0.4,
    reject: thresholdsConfig?.reject || 0.7,
  };

  const risk = determineRiskLevel(finalScore, thresholds);
  const action = determineAction(finalScore, thresholds);

  const reasons: string[] = [];

  // Model reasons
  if (modelScore >= 0.7) {
    reasons.push("High fraud probability detected by AI model");
  } else if (modelScore >= 0.4) {
    reasons.push("Moderate fraud risk indicated by transaction patterns");
  } else {
    reasons.push("Transaction appears legitimate based on AI analysis");
  }

  // Velocity reasons
  if (velocityReasons.length > 0) {
    reasons.push(...velocityReasons);
  }

  return {
    id: checkId,
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    modelScore: modelScore,
    velocityScore: velocityScore,
    score: finalScore,
    risk,
    action,
    reasons,
    modelVersion
  };
}

/**
 * Determine risk level based on score
 */
export function determineRiskLevel(
  score: number,
  thresholds: { review: number; reject: number }
): RiskLevel {
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
export function determineAction(
  score: number,
  thresholds: { review: number; reject: number }
): Action {
  if (score >= thresholds.reject) {
    return Action.REJECT;
  }
  if (score >= thresholds.review) {
    return Action.REVIEW;
  }
  return Action.ACCEPT;
}