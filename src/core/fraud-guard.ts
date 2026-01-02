import { IFraudGuard } from "../interfaces/fraud-guard.interface";
import {
  TransactionData,
  FraudCheckResult,
  FeedbackData,
  ModelInfo,
  FraudGuardConfig,
  CustomerTransactionFeedbackStatus,
  RetrainingResult,
} from "../interfaces/types";
import { loadConfig } from "../config/loader";
import { PredictionService } from "../services/prediction.service";
import { StorageManager } from "../storage/manager";
import {
  validateTransaction,
  validateTransactionForStorage,
} from "../utils/validation";
import { Logger } from "../utils/logger";
import { InitializationError, ValidationError } from "../utils/errors";
import { VelocityService } from "../services/velocity.service";
import { buildResult } from "../utils/result-builder";
import { RetrainingService } from "../services/retraining.service";

export class FraudGuard implements IFraudGuard {
  private config: FraudGuardConfig;
  private predictionService: PredictionService;
  private velocityService: VelocityService | null = null;
  private storageManager: StorageManager | null = null;
  private logger: Logger;
  private initialized: boolean = false;
  private retrainingService: RetrainingService | null = null;

  constructor() {
    this.config = loadConfig();

    this.logger = new Logger(this.config.logging);

    const thresholds = {
      review: this.config.thresholds?.review || 0.4,
      reject: this.config.thresholds?.reject || 0.7,
    };

    this.predictionService = new PredictionService(
      this.config.project.name,
      this.config.model.path,
      thresholds,
      this.logger,
      this.storageManager || undefined
    );

    if (this.config.storage.enabled && this.config.storage.path) {
      const retentionDays =
        this.config.storage.retention?.predictions_days || 90;
      this.storageManager = new StorageManager(
        this.config.storage.path,
        retentionDays,
        this.logger
      );
    }

    if (this.storageManager && this.config.retraining?.enabled) {
      this.retrainingService = new RetrainingService(
        this.config,
        this.storageManager,
        this.logger
      );
    }

    this.logger.info("Fraud Guard initialized");
    this.logger.debug(`Project: ${this.config.project.name}`);
    this.logger.debug(
      `Storage: ${this.config.storage.enabled ? "Enabled" : "Disabled"}`
    );
  }

  async check(transaction: TransactionData): Promise<FraudCheckResult> {
    try {
      await this.ensureInitialized();

      if (this.config.storage.enabled) {
        validateTransactionForStorage(transaction);
      } else {
        validateTransaction(transaction);
      }

      // 1. Get model prediction
      const modelPrediction = await this.predictionService.predict(transaction);

      // 2. Get velocity score (if enabled and storage available)
      let velocityResult = null;

      if (this.velocityService && this.config.velocity?.enabled) {
        this.logger.debug("Running velocity checks...");
        velocityResult = await this.velocityService.checkVelocity(transaction);
        this.logger.debug(`Velocity score: ${velocityResult.score.toFixed(3)}`);
      }

      // 3. Combine scores
      const modelScore = modelPrediction.score;
      const velocityScore = velocityResult?.score || 0;

      const modelWeight = this.config.velocity?.scoring?.model_weight || 0.6;
      const velocityWeight =
        this.config.velocity?.scoring?.velocity_weight || 0.4;

      // If velocity is disabled or no velocity score, final score = model score
      const finalScore =
        this.config.velocity?.enabled && velocityScore > 0
          ? modelScore * modelWeight + velocityScore * velocityWeight
          : modelScore;

      this.logger.debug(`Model score: ${modelScore.toFixed(3)}`);
      this.logger.debug(`Velocity score: ${velocityScore.toFixed(3)}`);
      this.logger.debug(`Final score: ${finalScore.toFixed(3)}`);

      // 4. Build result
      const result = await buildResult(
        transaction,
        modelPrediction,
        modelScore,
        velocityScore,
        finalScore,
        velocityResult?.reasons || [],
        this.config.thresholds,
        this.predictionService.getModelInfo().version
      );

      // 5. Save to storage
      if (this.storageManager && this.config.storage.enabled) {
        await this.storageManager.savePrediction(result, transaction);
        this.logger.debug(`Prediction stored: ${result.id}`);
      }

      return result;
    } catch (error: any) {
      this.logger.error("Check failed", error);
      throw error;
    }
  }

  async feedback(
    transactionId: string,
    actualFraud: boolean,
    transactionStatus?: CustomerTransactionFeedbackStatus
  ): Promise<void> {
    try {
      if (!this.config.storage.enabled) {
        throw new ValidationError(
          "Feedback requires storage to be enabled. Please enable storage in your configuration."
        );
      }

      if (!this.storageManager) {
        throw new InitializationError("Storage manager not initialized");
      }

      this.logger.info(`Feedback received for transaction: ${transactionId}`);
      if (transactionStatus) {
        this.logger.debug(`Transaction status: ${transactionStatus}`);
      }

      await this.storageManager.updateFeedback(
        transactionId,
        actualFraud,
        transactionStatus
      );

      this.logger.info(`Feedback saved for transaction: ${transactionId}`);
    } catch (error: any) {
      this.logger.error("Feedback failed", error);
      throw error;
    }
  }

  async retrain(): Promise<any> {
    if (!this.config.retraining?.enabled) {
      throw new ValidationError("Retraining is not enabled in configuration");
    }

    if (!this.retrainingService) {
      throw new InitializationError("Retraining service not initialized");
    }

    if (!this.config.storage.enabled) {
      throw new ValidationError("Retraining requires storage to be enabled");
    }

    this.logger.info("Starting model retraining...");

    const result = await this.retrainingService.retrain();

    if (!result.success) {
      throw new Error(`Retraining failed: ${result.error}`);
    }

    await this.reloadModelAfterRetraining(result);

    return {
      version: result.version,
      metrics: result.metrics,
      output_dir: result.output_dir,
    };
  }

  getModelInfo(): ModelInfo {
    if (!this.initialized) {
      throw new InitializationError("Fraud Guard not initialized");
    }

    return this.predictionService.getModelInfo();
  }

  getConfig(): FraudGuardConfig {
    return { ...this.config };
  }

  async close(): Promise<void> {
    this.predictionService.dispose();

    if (this.storageManager) {
      await this.storageManager.close();
    }

    this.initialized = false;
    this.logger.info("Fraud Guard closed");
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info("Initializing Fraud Guard...");

      if (this.storageManager && this.config.storage.enabled) {
        await this.storageManager.initialize();
        this.storageManager.startCleanupJob();

        // Initialize velocity service (only if storage is enabled)
        if (this.config.velocity?.enabled) {
          this.velocityService = new VelocityService(
            this.config.velocity,
            this.storageManager,
            this.logger
          );
          this.logger.info("Velocity checks enabled");
        }
      } else if (this.config.velocity?.enabled) {
        this.logger.warn(
          "Velocity checks require storage to be enabled. Velocity checks will be skipped."
        );
      }

      await this.predictionService.initialize();

      // Then initialize retraining service (if enabled)
      if (this.storageManager && this.config.retraining?.enabled) {
        this.retrainingService = new RetrainingService(
          this.config,
          this.storageManager,
          this.logger
        );

        this.retrainingService.setRetrainingCallback(
          this.reloadModelAfterRetraining.bind(this)
        );

        this.retrainingService.startScheduledRetraining();

        this.logger.info("Retraining enabled");
      }

      this.initialized = true;
      this.logger.info("Fraud Guard ready");
    } catch (error: any) {
      this.logger.error("Initialization failed", error);
      throw new InitializationError(`Failed to initialize: ${error.message}`);
    }
  }

  /**
   * Reload model after retraining completes
   */
  private async reloadModelAfterRetraining(
    result: RetrainingResult
  ): Promise<void> {
    if (!result.success) {
      // Model was not better - don't reload
      this.logger.info(
        "New model was not better than current - no reload needed"
      );
      return;
    }

    if (!result.output_dir) {
      return;
    }

    try {
      this.logger.info("Reloading model with newly trained version...");

      await this.predictionService.reload(result.output_dir);

      this.logger.info(
        "✓ Model reloaded successfully - using new version immediately!"
      );
      this.logger.info(`New model version: ${result.version}`);

      if (result.improvement) {
        this.logger.info(
          `Model improvement: +${(result.improvement * 100).toFixed(2)}%`
        );
      }
    } catch (error: any) {
      this.logger.error("Failed to reload model after retraining", error);
      this.logger.warn(
        "Continuing with current model. Restart application to use new model."
      );
    }
  }
}
