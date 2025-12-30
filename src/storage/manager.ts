import * as sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import {
  PredictionRecord,
  FraudCheckResult,
  TransactionData,
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

  constructor(dbPath: string, logger: Logger) {
    this.dbPath = dbPath;
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
          score, risk_level, action, model_version,
          actual_fraud, feedback_provided, feedback_at, feedback_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    actualFraud: boolean
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
             feedback_at = ?
         WHERE transaction_id = ?`,
        [actualFraud ? 1 : 0, feedbackAt, transactionId]
      );

      if (result.changes === 0) {
        throw new StorageError(
          `No prediction found for transaction ID: ${transactionId}`
        );
      }

      this.logger.debug(`Feedback updated for transaction: ${transactionId}`);
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

  isInitialized(): boolean {
    return this.initialized;
  }

  async close(): Promise<void> {
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
