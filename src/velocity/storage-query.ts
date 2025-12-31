import { StorageManager } from "../storage/manager";
import { StorageError } from "../utils/errors";

export class VelocityStorageQuery {
  private storageManager: StorageManager;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
  }

  /**
   * Count transactions for a given field and value in a time period
   */
  async countTransactions(
    field: "customer_id" | "device_id" | "ip_address",
    value: string,
    periodMinutes: number
  ): Promise<number> {
    try {
      const sql = `
        SELECT COUNT(*) as count 
        FROM predictions 
        WHERE ${field} = ? 
        AND created_at > datetime('now', '-${periodMinutes} minutes')
      `;

      const result = await this.storageManager.query(sql, [value]);
      return result?.count || 0;
    } catch (error: any) {
      throw new StorageError(`Failed to count transactions: ${error.message}`);
    }
  }

  /**
   * Sum transaction amounts for a customer in a time period
   */
  async sumAmounts(customerId: string, periodMinutes: number): Promise<number> {
    try {
      const sql = `
        SELECT COALESCE(SUM(amt), 0) as total 
        FROM predictions 
        WHERE customer_id = ? 
        AND created_at > datetime('now', '-${periodMinutes} minutes')
      `;

      const result = await this.storageManager.query(sql, [customerId]);
      return result?.total || 0;
    } catch (error: any) {
      throw new StorageError(`Failed to sum amounts: ${error.message}`);
    }
  }

  /**
   * Get average daily spending for a customer over N days
   */
  async getAverageDailySpending(
    customerId: string,
    lookbackDays: number
  ): Promise<number> {
    try {
      const sql = `
        SELECT COALESCE(AVG(daily_sum), 0) as avg_daily
        FROM (
          SELECT DATE(created_at) as day, SUM(amt) as daily_sum
          FROM predictions 
          WHERE customer_id = ?
          AND created_at > datetime('now', '-${lookbackDays} days')
          GROUP BY DATE(created_at)
        )
      `;

      const result = await this.storageManager.query(sql, [customerId]);
      return result?.avg_daily || 0;
    } catch (error: any) {
      throw new StorageError(
        `Failed to get average daily spending: ${error.message}`
      );
    }
  }

  /**
   * Get today's total spending for a customer
   */
  async getTodaySpending(customerId: string): Promise<number> {
    try {
      const sql = `
        SELECT COALESCE(SUM(amt), 0) as total
        FROM predictions 
        WHERE customer_id = ?
        AND DATE(created_at) = DATE('now')
      `;

      const result = await this.storageManager.query(sql, [customerId]);
      return result?.total || 0;
    } catch (error: any) {
      throw new StorageError(
        `Failed to get today's spending: ${error.message}`
      );
    }
  }

  /**
   * Count failed transactions for a customer in a time period
   */
  async countFailedTransactions(
    customerId: string,
    periodMinutes: number
  ): Promise<number> {
    try {
      const sql = `
        SELECT COUNT(*) as count 
        FROM predictions 
        WHERE customer_id = ? 
        AND transaction_status = ?
        AND created_at > datetime('now', '-${periodMinutes} minutes')
      `;

      const result = await this.storageManager.query(sql, [
        customerId,
        "failed",
      ]);
      return result?.count || 0;
    } catch (error: any) {
      throw new StorageError(
        `Failed to count failed transactions: ${error.message}`
      );
    }
  }

  /**
   * Get customer age in days (days since first transaction)
   */
  async getCustomerAgeDays(customerId: string): Promise<number> {
    try {
      const sql = `
        SELECT 
          CAST((julianday('now') - julianday(MIN(created_at))) AS INTEGER) as age_days
        FROM predictions 
        WHERE customer_id = ?
      `;

      const result = await this.storageManager.query(sql, [customerId]);
      return result?.age_days || 0;
    } catch (error: any) {
      throw new StorageError(`Failed to get customer age: ${error.message}`);
    }
  }
}
