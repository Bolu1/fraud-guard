import { IFraudGuard } from '../interfaces/fraud-guard.interface';
import {
  TransactionData,
  FraudCheckResult,
  FeedbackData,
  ModelInfo,
  FraudGuardConfig,
} from '../interfaces/types';
import { loadConfig } from '../config/loader';
import { PredictionService } from '../services/prediction-service';
import { validateTransaction } from '../utils/validation';
import { Logger } from '../utils/logger';
import { InitializationError } from '../utils/errors';

export class FraudGuard implements IFraudGuard {
  private config: FraudGuardConfig;
  private predictionService: PredictionService;
  private logger: Logger;
  private initialized: boolean = false;

  constructor() {
    this.config = loadConfig();

    this.logger = new Logger(this.config.logging);

    const thresholds = {
      review: this.config.model.thresholds?.review || 0.4,
      reject: this.config.model.thresholds?.reject || 0.7,
    };

    this.predictionService = new PredictionService(
      this.config.project.name,
      this.config.model.path,
      thresholds,
      this.logger
    );

    this.logger.info('Fraud Guard initialized');
    this.logger.debug(`Project: ${this.config.project.name}`);
  }

  async check(transaction: TransactionData): Promise<FraudCheckResult> {
    try {
      await this.ensureInitialized();

      validateTransaction(transaction);

      const result = await this.predictionService.predict(transaction);

      return result;
    } catch (error: any) {
      this.logger.error('Check failed', error);
      throw error;
    }
  }

  async feedback(transactionId: string, feedback: FeedbackData): Promise<void> {
    try {
      this.logger.info(`Feedback received for transaction: ${transactionId}`);
      this.logger.debug(`Actual fraud: ${feedback.actualFraud}`);

      throw new Error('Feedback storage not yet implemented (Phase 2)');
    } catch (error: any) {
      this.logger.error('Feedback failed', error);
      throw error;
    }
  }

  getModelInfo(): ModelInfo {
    if (!this.initialized) {
      throw new InitializationError('Fraud Guard not initialized');
    }

    return this.predictionService.getModelInfo();
  }

  getConfig(): FraudGuardConfig {
    return { ...this.config };
  }

  close(): void {
    this.predictionService.dispose();
    this.initialized = false;
    this.logger.info('Fraud Guard closed');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info('Initializing Fraud Guard...');

      await this.predictionService.initialize();

      this.initialized = true;
      this.logger.info('Fraud Guard ready');
    } catch (error: any) {
      this.logger.error('Initialization failed', error);
      throw new InitializationError(`Failed to initialize: ${error.message}`);
    }
  }
}