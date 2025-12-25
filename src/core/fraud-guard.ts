import { IFraudGuard } from "../interfaces/fraud-guard.interface";
import {
  TransactionData,
  FraudCheckResult,
  FraudGuardConfig,
  ModelConfig,
} from "../interfaces/types";
import { loadConfig, configFileExists } from "../config/loader";
import { Logger } from "../utils/logger";
import { ModelManager } from "../model/manager";
import { ResultBuilder } from "../model/result-builder";
import { validateTransaction } from "../utils/validation";
import { resolveModelPath } from "../utils/paths";
import { InitializationError } from "../utils/errors";


export class FraudGuard implements IFraudGuard {
  private config: FraudGuardConfig;
  private logger: Logger;
  private modelManager: ModelManager | null = null;
  private resultBuilder: ResultBuilder | null = null;
  private isInitialized: boolean = false;
  private hasConfigFile: boolean = false;

  /**
   * Create a new FraudGuard instance
   * Loads configuration if fraud-guard.config.yml exists
   */
  constructor() {
    // Check if config file exists
    this.hasConfigFile = configFileExists();

    // Load configuration
    this.config = loadConfig();

    // Create logger
    this.logger = new Logger(this.config.logging);

    // Log startup
    if (this.hasConfigFile) {
      this.logger.info("Fraud Guard: Configuration file found");
      this.logger.debug("Config loaded", this.config);
    } else {
      this.logger.info(
        "Fraud Guard: No configuration file found, using defaults"
      );
      this.logger.info(
        "Fraud Guard: Running in prediction-only mode (no storage)"
      );
    }

    // Note: Heavy initialization happens lazily on first check()
  }

  /**
   * Check a transaction for fraud
   *
   * @param transaction - Transaction data to analyze
   * @returns Fraud check result with score, risk level, and recommended action
   */
  async check(transaction: TransactionData): Promise<FraudCheckResult> {
    try {
      // Ensure initialized (lazy initialization)
      await this.ensureInitialized();

      // Validate input
      validateTransaction(transaction);

      this.logger.debug("Processing fraud check", {
        transactionId: transaction.id,
        amount: transaction.amount,
        type: transaction.type,
      });

      // Get prediction from model
      const prediction = await this.modelManager!.predict(transaction);

      this.logger.debug("Model prediction complete", {
        score: prediction.score,
        label: prediction.label,
      });

      // Build result
      const result = this.resultBuilder!.build(transaction, prediction);

      this.logger.info("Fraud check complete", {
        checkId: result.id,
        transactionId: transaction.id,
        score: result.score.toFixed(3),
        risk: result.risk,
        action: result.action,
      });

      // TODO: Store check result if storage is enabled (Phase 2)
      // if (this.hasConfigFile && this.config.storage) {
      //   await this.storageManager.storeCheck(result);
      // }

      return result;
    } catch (error: any) {
      this.logger.error("Fraud check failed", error);
      throw error;
    }
  }

  /**
   * Get current configuration
   *
   * @returns Current fraud guard configuration
   */
  getConfig(): FraudGuardConfig {
    return { ...this.config };
  }

  /**
   * Close fraud guard and release resources
   */
  async close(): Promise<void> {
    this.logger.info("Shutting down Fraud Guard");

    if (this.modelManager) {
      await this.modelManager.close();
    }

    this.isInitialized = false;
    this.modelManager = null;
    this.resultBuilder = null;

    this.logger.info("Fraud Guard shut down complete");
  }

  /**
   * Check if Fraud Guard is initialized
   *
   * @returns True if initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Ensure Fraud Guard is initialized
   * Performs lazy initialization on first use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.initialize();
  }

  /**
   * Initialize Fraud Guard
   * Loads model and prepares for predictions
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.info("Initializing Fraud Guard...");

      // Resolve model path
      const modelPath = resolveModelPath(this.config.model?.path);
      this.logger.debug("Model path resolved", { modelPath });

      // Initialize model manager
      this.modelManager = new ModelManager();
      await this.modelManager.initialize(modelPath);

      const version = this.modelManager.getVersion();
      const aucScore = this.modelManager.getAucScore();

      this.logger.info("Model loaded", {
        version,
        aucScore: (aucScore * 100).toFixed(2) + "%",
      });

      // Create result builder
      const modelConfig: ModelConfig = this.config.model || {
        thresholds: { review: 0.4, reject: 0.7 },
      };
      this.resultBuilder = new ResultBuilder(modelConfig, version);

      this.logger.info("Result builder initialized", {
        reviewThreshold: modelConfig.thresholds?.review || 0.4,
        rejectThreshold: modelConfig.thresholds?.reject || 0.7,
      });

      // Mark as initialized
      this.isInitialized = true;

      this.logger.info("✓ Fraud Guard ready");
    } catch (error: any) {
      this.logger.error("Initialization failed", error);
      throw new InitializationError(
        `Failed to initialize Fraud Guard: ${error.message}`
      );
    }
  }

  /**
   * Get model information
   *
   * @returns Model version and metadata
   */
  async getModelInfo(): Promise<{
    version: string;
    aucScore: number;
    modelPath: string | null;
  }> {
    await this.ensureInitialized();

    if (!this.modelManager) {
      throw new InitializationError("Model not initialized");
    }

    return {
      version: this.modelManager.getVersion(),
      aucScore: this.modelManager.getAucScore(),
      modelPath: this.modelManager.getModelDirectory(),
    };
  }
}
