import {
  TransactionData,
  FraudCheckResult,
  PredictionResult,
  ModelInfo,
  RiskLevel,
  Action,
} from "../interfaces/types";
import { ModelManager } from "../model/manager";
import { buildFraudCheckResult } from "../model/result-builder";
import { resolveModelPath, initializeBaselineModel } from "../utils/paths";
import { Logger } from "../utils/logger";
import { InitializationError, ModelError } from "../utils/errors";
import { StorageManager } from "../storage/manager";
import * as path from "path";
import * as os from "os";

export class PredictionService {
  private modelManager: ModelManager | null = null;
  private storageManager: StorageManager | null;
  private logger: Logger;
  private projectName: string;
  private modelPath: string | undefined;
  private thresholds: { review: number; reject: number };
  private initialized: boolean = false;

  constructor(
    projectName: string,
    modelPath: string | undefined,
    thresholds: { review: number; reject: number },
    logger: Logger,
    storageManager?: StorageManager
  ) {
    this.projectName = projectName;
    this.modelPath = modelPath;
    this.thresholds = thresholds;
    this.storageManager = storageManager || null;
    this.logger = logger;

    this.modelManager = null as any;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info("Initializing prediction service...");

      await initializeBaselineModel();
      // Determine model path
      let effectiveModelPath: string;

      // 1. Check if storage is available and has active model
      if (this.storageManager) {
        const activeModel = await this.storageManager.getActiveModel();

        if (activeModel && activeModel.path) {
          effectiveModelPath = activeModel.path;
          this.logger.info(`Using active model: ${activeModel.version}`);
          this.logger.info(`Model path: ${effectiveModelPath}`);
        } else {
          // No active model in DB - use baseline
          effectiveModelPath = this.getBaselineModelPath();
          this.logger.info("No active model found - using baseline");
        }
      } else {
        // No storage - use configured path or baseline
        effectiveModelPath = this.modelPath || this.getBaselineModelPath();
      }

      this.modelPath = effectiveModelPath;

      // Create ModelManager with the model directory
      this.modelManager = new ModelManager(this.modelPath, this.logger);

      // Use ModelManager's initialize method (it does everything!)
      await this.modelManager.initialize();

      this.initialized = true;
      this.logger.info("Prediction service ready");
    } catch (error: any) {
      this.logger.error("Failed to initialize prediction service", error);
      throw new InitializationError(
        `Prediction service initialization failed: ${error.message}`
      );
    }
  }

  async predict(transaction: TransactionData): Promise<FraudCheckResult> {
    if (!this.initialized) {
      throw new ModelError(
        "Prediction service not initialized. Call initialize() first."
      );
    }

    if (!this.modelManager) {
      throw new ModelError("Model manager not available");
    }

    try {
      this.logTransactionDetails(transaction);

      const prediction = await this.modelManager.predict(transaction);
      this.logger.debug(
        `Model prediction score: ${prediction.score.toFixed(4)}`
      );

      const modelInfo = this.modelManager.getModelInfo();

      let result = buildFraudCheckResult(
        transaction,
        prediction,
        this.thresholds,
        modelInfo.version
      );

      this.logger.info(
        `Prediction complete: ${result.id} | Score: ${result.score.toFixed(3)} | Risk: ${result.risk} | Action: ${result.action}`
      );

      return result;
    } catch (error: any) {
      this.logger.error("Prediction failed", error);
      throw error;
    }
  }

  getModelInfo(): ModelInfo {
    if (!this.modelManager) {
      throw new ModelError("Model manager not available");
    }

    return this.modelManager.getModelInfo();
  }

  /**
   * Reload model from a new path
   */
  async reload(modelPath?: string): Promise<void> {
    this.logger.info("Reloading model...");

    try {
      // Dispose current model
      this.dispose();

      // Update model path if provided
      if (modelPath) {
        this.modelPath = modelPath;
        this.logger.info(`Using new model path: ${modelPath}`);
      }

      // Reinitialize
      this.initialized = false;
      await this.initialize();

      this.logger.info("Model reloaded successfully");
    } catch (error: any) {
      this.logger.error("Failed to reload model", error);
      throw new Error(`Model reload failed: ${error.message}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  dispose(): void {
    if (this.modelManager) {
      this.modelManager.dispose();
      this.modelManager = null;
    }

    this.initialized = false;
    this.logger.debug("Prediction service disposed");
  }

  private logTransactionDetails(transaction: TransactionData): void {
    this.logger.debug("Transaction details:");
    this.logger.debug(`  Amount: $${transaction.amount}`);
    this.logger.debug(`  Category: ${transaction.category}`);
    this.logger.debug(`  Timestamp: ${transaction.timestamp.toISOString()}`);

    if (transaction.id) {
      this.logger.debug(`  Transaction ID: ${transaction.id}`);
    }

    if (transaction.customerId) {
      this.logger.debug(`  Customer ID: ${transaction.customerId}`);
    }

    if (transaction.walletBalance !== undefined) {
      this.logger.debug(`  Wallet Balance: $${transaction.walletBalance}`);
    }

    if (transaction.ipAddress) {
      this.logger.debug(`  IP Address: ${transaction.ipAddress}`);
    }

    if (transaction.deviceId) {
      this.logger.debug(`  Device ID: ${transaction.deviceId}`);
    }
  }

  private applyOptionalFieldChecks(
    transaction: TransactionData,
    result: FraudCheckResult
  ): FraudCheckResult {
    const additionalReasons: string[] = [];
    let scoreAdjustment = 0;

    if (transaction.walletBalance !== undefined) {
      const walletChecks = this.checkWalletBalance(
        transaction.amount,
        transaction.walletBalance
      );
      additionalReasons.push(...walletChecks.reasons);
      scoreAdjustment += walletChecks.scoreAdjustment;
    }

    if (transaction.ipAddress) {
      const ipChecks = this.checkIpAddress(transaction.ipAddress);
      additionalReasons.push(...ipChecks.reasons);
      scoreAdjustment += ipChecks.scoreAdjustment;
    }

    if (transaction.deviceId) {
      const deviceChecks = this.checkDeviceId(transaction.deviceId);
      additionalReasons.push(...deviceChecks.reasons);
      scoreAdjustment += deviceChecks.scoreAdjustment;
    }

    if (additionalReasons.length > 0) {
      this.logger.debug(
        `Optional field checks triggered ${additionalReasons.length} additional reasons`
      );
      result.reasons.push(...additionalReasons);
    }

    if (scoreAdjustment !== 0) {
      const originalScore = result.score;
      result.score = Math.max(0, Math.min(1, result.score + scoreAdjustment));

      if (result.score !== originalScore) {
        this.logger.debug(
          `Score adjusted: ${originalScore.toFixed(4)} → ${result.score.toFixed(4)} (${scoreAdjustment >= 0 ? "+" : ""}${scoreAdjustment.toFixed(4)})`
        );

        const newRisk = this.determineRiskLevel(result.score);
        const newAction = this.determineAction(result.score);

        if (newRisk !== result.risk || newAction !== result.action) {
          this.logger.debug(
            `Risk/Action updated: ${result.risk}/${result.action} → ${newRisk}/${newAction}`
          );
          result.risk = newRisk;
          result.action = newAction;
        }
      }
    }

    return result;
  }

  private checkWalletBalance(
    amount: number,
    walletBalance: number
  ): { reasons: string[]; scoreAdjustment: number } {
    const reasons: string[] = [];
    let scoreAdjustment = 0;

    if (amount > walletBalance) {
      reasons.push("Transaction amount exceeds wallet balance");
      scoreAdjustment += 0.15;
      this.logger.debug(
        "Wallet check: Amount exceeds balance (impossible transaction)"
      );
    }

    const percentageOfBalance = (amount / walletBalance) * 100;

    if (percentageOfBalance >= 95) {
      reasons.push("Transaction draining wallet balance (≥95%)");
      scoreAdjustment += 0.1;
      this.logger.debug(
        `Wallet check: Draining ${percentageOfBalance.toFixed(1)}% of balance`
      );
    } else if (percentageOfBalance >= 80) {
      reasons.push("Large percentage of wallet balance (≥80%)");
      scoreAdjustment += 0.05;
      this.logger.debug(
        `Wallet check: Using ${percentageOfBalance.toFixed(1)}% of balance`
      );
    }

    if (walletBalance === 0 && amount > 0) {
      reasons.push("Transaction attempted with zero wallet balance");
      scoreAdjustment += 0.1;
      this.logger.debug("Wallet check: Zero balance transaction attempt");
    }

    return { reasons, scoreAdjustment };
  }

  private checkIpAddress(ipAddress: string): {
    reasons: string[];
    scoreAdjustment: number;
  } {
    const reasons: string[] = [];
    let scoreAdjustment = 0;

    if (this.isPrivateIp(ipAddress)) {
      this.logger.debug(`IP check: Private IP detected (${ipAddress})`);
    } else if (this.isLocalhostIp(ipAddress)) {
      reasons.push("Transaction from localhost IP address");
      scoreAdjustment += 0.05;
      this.logger.debug("IP check: Localhost detected");
    }

    return { reasons, scoreAdjustment };
  }

  private checkDeviceId(deviceId: string): {
    reasons: string[];
    scoreAdjustment: number;
  } {
    const reasons: string[] = [];
    let scoreAdjustment = 0;

    if (!deviceId || deviceId.trim().length === 0) {
      reasons.push("Missing or empty device identifier");
      scoreAdjustment += 0.05;
      this.logger.debug("Device check: Empty device ID");
    }

    return { reasons, scoreAdjustment };
  }

  private getBaselineModelPath(): string {
    const baselinePath = path.join(os.homedir(), ".fraud-guard/baseline");
    this.logger.debug("Baseline model ready");
    return baselinePath;
  }

  private isPrivateIp(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
    ];
    return privateRanges.some((range) => range.test(ip));
  }

  private isLocalhostIp(ip: string): boolean {
    return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
  }

  private determineRiskLevel(score: number): RiskLevel {
    if (score >= this.thresholds.reject) {
      return RiskLevel.HIGH;
    }
    if (score >= this.thresholds.review) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  private determineAction(score: number): Action {
    if (score >= this.thresholds.reject) {
      return Action.REJECT;
    }
    if (score >= this.thresholds.review) {
      return Action.REVIEW;
    }
    return Action.ACCEPT;
  }
}
