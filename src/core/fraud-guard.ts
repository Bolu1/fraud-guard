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
import { StorageManager } from '../storage/manager';
import { validateTransaction, validateTransactionForStorage } from '../utils/validation';
import { Logger } from '../utils/logger';
import { InitializationError, ValidationError } from '../utils/errors';

export class FraudGuard implements IFraudGuard {
  private config: FraudGuardConfig;
  private predictionService: PredictionService;
  private storageManager: StorageManager | null = null;
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

    if (this.config.storage.enabled && this.config.storage.path) {
      this.storageManager = new StorageManager(this.config.storage.path, this.logger);
    }

    this.logger.info('Fraud Guard initialized');
    this.logger.debug(`Project: ${this.config.project.name}`);
    this.logger.debug(`Storage: ${this.config.storage.enabled ? 'Enabled' : 'Disabled'}`);
  }

  async check(transaction: TransactionData): Promise<FraudCheckResult> {
    try {
      await this.ensureInitialized();

      if (this.config.storage.enabled) {
        validateTransactionForStorage(transaction);
      } else {
        validateTransaction(transaction);
      }

      const result = await this.predictionService.predict(transaction);

      if (this.storageManager && this.config.storage.enabled) {
        await this.storageManager.savePrediction(result, transaction);
        this.logger.debug(`Prediction stored: ${result.id}`);
      }

      return result;
    } catch (error: any) {
      this.logger.error('Check failed', error);
      throw error;
    }
  }

  async feedback(transactionId: string, actualFraud: boolean): Promise<void> {
    try {
      if (!this.config.storage.enabled) {
        throw new ValidationError(
          'Feedback requires storage to be enabled. Please enable storage in your configuration.'
        );
      }

      if (!this.storageManager) {
        throw new InitializationError('Storage manager not initialized');
      }

      this.logger.info(`Feedback received for transaction: ${transactionId}`);

      await this.storageManager.updateFeedback(
        transactionId,
        actualFraud,
      );

      this.logger.info(`Feedback saved for transaction: ${transactionId}`);
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

  async close(): Promise<void> {
    this.predictionService.dispose();

    if (this.storageManager) {
      await this.storageManager.close();
    }

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

      if (this.storageManager && this.config.storage.enabled) {
        await this.storageManager.initialize();
      }

      this.initialized = true;
      this.logger.info('Fraud Guard ready');
    } catch (error: any) {
      this.logger.error('Initialization failed', error);
      throw new InitializationError(`Failed to initialize: ${error.message}`);
    }
  }
}