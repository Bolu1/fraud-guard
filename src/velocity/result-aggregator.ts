import { VelocityCheckResult, VelocityResult } from '../interfaces/types';

export class VelocityResultAggregator {
  /**
   * Aggregate multiple check results using MAX strategy
   * This prevents double-counting when multiple checks trigger for the same behavior
   */
  aggregate(results: VelocityCheckResult[]): VelocityResult {
    // Extract all scores
    const scores = results.map((r) => r.score);

    // Use MAX strategy (no double-counting)
    const finalScore = scores.length > 0 ? Math.max(...scores) : 0;

    // Combine all reasons from triggered checks
    const allReasons = results.filter((r) => r.triggered).flatMap((r) => r.reasons);

    return {
      score: finalScore,
      reasons: allReasons,
      checks: results,
    };
  }
}