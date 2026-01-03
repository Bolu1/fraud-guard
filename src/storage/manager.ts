import * as sqlite3 from "sqlite3";
import * as cron from "node-cron";
import { open, Database } from "sqlite";
import {
  PredictionRecord,
  FraudCheckResult,
  TransactionData,
  CustomerTransactionFeedbackStatus,
} from "../interfaces/types";
import { SCHEMA } from "./schema";
import { StorageError } from "../utils/errors";
import { Logger } from "../utils/logger";
import { ensureDirectoryExists } from "../utils/paths";
import * as path from "path";
import * as os from "os";

export class StorageManager {
  private db: Database | null = null;
  private dbPath: string;
  private logger: Logger;
  private initialized: boolean = false;
  private retentionDays: number;
  private cleanupJob: cron.ScheduledTask | null = null;

  constructor(dbPath: string, retentionDays: number, logger: Logger) {
    this.dbPath = dbPath;
    this.retentionDays = retentionDays;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info("Initializing storage...");

      const dbDir = path.dirname(this.dbPath);
      await ensureDirectoryExists(dbDir);

      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });

      await this.db.exec(SCHEMA);

      this.initialized = true;
      this.logger.info(`Storage initialized: ${this.dbPath}`);

      await this.ensureBaselineRegistered();
      this.logger.debug(`Retention period: ${this.retentionDays} days`);
    } catch (error: any) {
      throw new StorageError(`Failed to initialize storage: ${error.message}`);
    }
  }

  async savePrediction(
    result: FraudCheckResult,
    transaction: TransactionData
  ): Promise<void> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    if (!transaction.id) {
      throw new StorageError(
        "Transaction ID is required when storage is enabled"
      );
    }

    if (!transaction.customerId) {
      throw new StorageError("Customer ID is required when storage is enabled");
    }

    try {
      const timeFeatures = this.extractTimeFeatures(transaction.timestamp);

      await this.db.run(
        `INSERT INTO predictions (
          id, transaction_id, customer_id, created_at,
          amt, hour, month, dayofweek, day, category,
          device_id, ip_address,
          score, risk_level, action, model_version,
          actual_fraud, feedback_provided, feedback_at, transaction_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.id,
          transaction.id,
          transaction.customerId,
          result.timestamp.toISOString(),
          transaction.amount,
          timeFeatures.hour,
          timeFeatures.month,
          timeFeatures.dayofweek,
          timeFeatures.day,
          transaction.category,
          transaction.deviceId || null,
          transaction.ipAddress || null,
          result.score,
          result.risk,
          result.action,
          result.modelVersion,
          null,
          0,
          null,
          null,
        ]
      );

      this.logger.debug(`Prediction saved: ${result.id}`);
    } catch (error: any) {
      throw new StorageError(`Failed to save prediction: ${error.message}`);
    }
  }

  async updateFeedback(
    transactionId: string,
    actualFraud: boolean,
    transactionStatus?: CustomerTransactionFeedbackStatus
  ): Promise<void> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      const feedbackAt = new Date().toISOString();

      const result = await this.db.run(
        `UPDATE predictions 
         SET actual_fraud = ?, 
             feedback_provided = 1, 
             feedback_at = ?,
             transaction_status = ?
         WHERE transaction_id = ?`,
        [
          actualFraud ? 1 : 0,
          feedbackAt,
          transactionStatus || null,
          transactionId,
        ]
      );

      if (result.changes === 0) {
        throw new StorageError(
          `No prediction found for transaction ID: ${transactionId}`
        );
      }

      this.logger.debug(`Feedback updated for transaction: ${transactionId}`);
      if (transactionStatus) {
        this.logger.debug(`Transaction status set to: ${transactionStatus}`);
      }
    } catch (error: any) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to update feedback: ${error.message}`);
    }
  }

  async getPrediction(transactionId: string): Promise<PredictionRecord | null> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      const row = await this.db.get<PredictionRecord>(
        "SELECT * FROM predictions WHERE transaction_id = ?",
        transactionId
      );

      return row || null;
    } catch (error: any) {
      throw new StorageError(`Failed to get prediction: ${error.message}`);
    }
  }

  async countPredictionsWithFeedback(): Promise<number> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      const result = await this.db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM predictions WHERE feedback_provided = 1"
      );

      return result?.count || 0;
    } catch (error: any) {
      throw new StorageError(`Failed to count feedback: ${error.message}`);
    }
  }

  private async cleanupOldPredictions(): Promise<number> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      const cutoffISO = cutoffDate.toISOString();

      this.logger.debug(`Cleaning up predictions older than ${cutoffISO}`);

      const result = await this.db.run(
        "DELETE FROM predictions WHERE created_at < ?",
        cutoffISO
      );

      const deletedCount = result.changes || 0;

      if (deletedCount > 0) {
        this.logger.info(`Cleaned up ${deletedCount} old prediction(s)`);
      } else {
        this.logger.debug("No old predictions to clean up");
      }

      await this.db.run("VACUUM");

      return deletedCount;
    } catch (error: any) {
      throw new StorageError(
        `Failed to cleanup old predictions: ${error.message}`
      );
    }
  }

  /**
   * Execute a raw SQL query (for velocity checks)
   */
  public async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      const result = await this.db.get(sql, params);
      return result;
    } catch (error: any) {
      throw new StorageError(`Query failed: ${error.message}`);
    }
  }

  public startCleanupJob(): void {
    this.cleanupJob = cron.schedule("0 0 * * *", async () => {
      try {
        this.logger.info("Starting scheduled data cleanup...");
        const deletedCount = await this.cleanupOldPredictions();
        this.logger.info(
          `Scheduled cleanup complete: ${deletedCount} record(s) deleted`
        );
      } catch (error: any) {
        this.logger.error("Scheduled cleanup failed", error);
      }
    });

    this.logger.info("Cleanup job scheduled: Every day at midnight (00:00)");
  }

  /**
   * Get total number of predictions
   */
  async getTotalPredictions(): Promise<number> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      const result = await this.db.get(
        "SELECT COUNT(*) as count FROM predictions"
      );
      return result?.count || 0;
    } catch (error: any) {
      throw new StorageError(
        `Failed to get total predictions: ${error.message}`
      );
    }
  }

  /**
   * Get the currently active model
   */
  async getActiveModel(): Promise<{ version: string; path: string } | null> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      const result = await this.db.get(`
      SELECT version, model_path 
      FROM model_versions 
      WHERE is_active = 1
      LIMIT 1
    `);

      if (!result) {
        return null;
      }

      return {
        version: result.version,
        path: result.model_path || "",
      };
    } catch (error: any) {
      throw new StorageError(`Failed to get active model: ${error.message}`);
    }
  }

  /**
   * Register a new model version
   */
  async registerModelVersion(
    version: string,
    modelPath: string,
    metrics: {
      accuracy: number;
      precision: number;
      recall: number;
      f1: number;
      auc: number;
      training_samples: number;
      test_samples: number;
    },
    isBaseline: boolean = false
  ): Promise<void> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      // Deactivate all existing models
      await this.db.run("UPDATE model_versions SET is_active = 0");

      // Insert new model as active
      await this.db.run(
        `INSERT INTO model_versions (
        version, created_at, is_baseline, is_active, 
        training_samples, accuracy, model_path
      ) VALUES (?, datetime('now'), ?, 1, ?, ?, ?)`,
        [
          version,
          isBaseline ? 1 : 0,
          metrics.training_samples,
          metrics.accuracy,
          modelPath,
        ]
      );

      this.logger.info(`Registered model version: ${version} (active)`);
    } catch (error: any) {
      throw new StorageError(`Failed to register model: ${error.message}`);
    }
  }

  /**
   * Get all model versions
   */
  async getModelVersions(): Promise<any[]> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      const results = await this.db.all(`
      SELECT 
        version, created_at, is_baseline, is_active,
        training_samples, accuracy, model_path
      FROM model_versions
      ORDER BY created_at DESC
    `);

      return results || [];
    } catch (error: any) {
      throw new StorageError(`Failed to get model versions: ${error.message}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async close(): Promise<void> {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
      this.logger.debug("Cleanup job stopped");
    }
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.initialized = false;
      this.logger.debug("Storage closed");
    }
  }

  async ensureBaselineRegistered(): Promise<void> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      // Check if any models exist
      const existing = await this.db.get(
        "SELECT COUNT(*) as count FROM model_versions"
      );

      if (existing.count === 0) {
        // No models registered - register baseline
        const baselinePath = path.join(os.homedir(), ".fraud-guard/baseline");

        await this.registerModelVersion(
          "v1.0.0",
          baselinePath,
          {
            accuracy: 0.95, // Baseline model metrics
            precision: 0.93,
            recall: 0.91,
            f1: 0.92,
            auc: 0.96,
            training_samples: 1000,
            test_samples: 250,
          },
          true // Is baseline
        );

        this.logger.info("Baseline model registered");
      }
    } catch (error: any) {
      throw new StorageError(`Failed to register baseline: ${error.message}`);
    }
  }

  /**
   * Get a specific model version by version ID
   */
  async getModelByVersion(version: string): Promise<any | null> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      const result = await this.db.get(
        `SELECT * FROM model_versions WHERE version = ?`,
        [version]
      );

      return result || null;
    } catch (error: any) {
      throw new StorageError(`Failed to get model version: ${error.message}`);
    }
  }

  /**
   * Set a specific model version as active
   */
  async setActiveModel(version: string): Promise<void> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      // Deactivate all models
      await this.db.run("UPDATE model_versions SET is_active = 0");

      // Activate the specified model
      const result = await this.db.run(
        "UPDATE model_versions SET is_active = 1 WHERE version = ?",
        [version]
      );

      if (result.changes === 0) {
        throw new Error(`Model version not found: ${version}`);
      }

      this.logger.info(`Set active model: ${version}`);
    } catch (error: any) {
      throw new StorageError(`Failed to set active model: ${error.message}`);
    }
  }

  /**
   * Delete a model version from the database
   */
  async deleteModelVersion(version: string): Promise<void> {
    if (!this.db) {
      throw new StorageError("Storage not initialized");
    }

    try {
      await this.db.run("DELETE FROM model_versions WHERE version = ?", [
        version,
      ]);

      this.logger.debug(`Deleted model version: ${version}`);
    } catch (error: any) {
      throw new StorageError(
        `Failed to delete model version: ${error.message}`
      );
    }
  }

  private extractTimeFeatures(timestamp: Date): {
    hour: number;
    month: number;
    dayofweek: number;
    day: number;
  } {
    return {
      hour: timestamp.getHours(),
      month: timestamp.getMonth() + 1,
      dayofweek: timestamp.getDay(),
      day: timestamp.getDate(),
    };
  }
}
