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
