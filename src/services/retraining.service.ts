import { spawn } from "child_process";
import * as cron from "node-cron";
import { FraudGuardConfig, RetrainingResult } from "../interfaces/types";
import { StorageManager } from "../storage/manager";
import { Logger } from "../utils/logger";
import { getProjectBasePath } from "../config/defaults";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export class RetrainingService {
  private config: FraudGuardConfig;
  private storageManager: StorageManager;
  private logger: Logger;
  private retrainingJob: cron.ScheduledTask | null = null;
  private onRetrainingComplete?: (result: RetrainingResult) => Promise<void>;

  constructor(
    config: FraudGuardConfig,
    storageManager: StorageManager,
    logger: Logger
  ) {
    this.config = config;
    this.storageManager = storageManager;
    this.logger = logger;
  }

  /**
   * Set callback for when retraining completes
   */
  setRetrainingCallback(
    callback: (result: RetrainingResult) => Promise<void>
  ): void {
    this.onRetrainingComplete = callback;
  }

  /**
   * Start scheduled retraining job
   */
  startScheduledRetraining(): void {
    if (!this.config.retraining?.enabled) {
      return;
    }

    const schedule = this.config.retraining.schedule || "0 2 * * *"; // Default: 2 AM daily

    this.retrainingJob = cron.schedule(schedule, async () => {
      try {
        this.logger.info("Starting scheduled retraining...");

        // Check if we have enough feedback
        const shouldRetrain = await this.shouldRetrain();

        if (!shouldRetrain) {
          const feedbackCount =
            await this.storageManager.countPredictionsWithFeedback();
          const minSamples = this.config.retraining?.min_samples || 100;
          this.logger.info(
            `Skipping retraining: Not enough feedback (${feedbackCount}/${minSamples})`
          );
          return;
        }

        // Run retraining
        const result = await this.retrain();

        if (result.success) {
          this.logger.info(
            `Scheduled retraining successful! Version: ${result.version}`
          );

          // Call callback to reload model
          if (this.onRetrainingComplete) {
            await this.onRetrainingComplete(result);
          }
        } else {
          this.logger.error(`Scheduled retraining failed: ${result.error}`);
        }
      } catch (error: any) {
        this.logger.error("Scheduled retraining error", error);
      }
    });

    this.logger.info(`Retraining job scheduled: ${schedule}`);
  }

  /**
   * Stop scheduled retraining job
   */
  stopScheduledRetraining(): void {
    if (this.retrainingJob) {
      this.retrainingJob.stop();
      this.retrainingJob = null;
      this.logger.debug("Retraining job stopped");
    }
  }

  /**
   * Check if retraining is needed based on feedback count
   */
  async shouldRetrain(): Promise<boolean> {
    if (!this.config.retraining?.enabled) {
      return false;
    }

    const feedbackCount =
      await this.storageManager.countPredictionsWithFeedback();
    const minSamples = this.config.retraining?.min_samples || 100;

    this.logger.debug(
      `Feedback count: ${feedbackCount}, Min samples: ${minSamples}`
    );

    return feedbackCount >= minSamples;
  }

  /**
   * Retrain the model using feedback data
   */
  async retrain(): Promise<RetrainingResult> {
    this.logger.info("Starting model retraining...");

    try {
      // Check if we have enough feedback
      const shouldRetrain = await this.shouldRetrain();
      if (!shouldRetrain) {
        const feedbackCount =
          await this.storageManager.countPredictionsWithFeedback();
        const minSamples = this.config.retraining?.min_samples || 100;
        throw new Error(
          `Not enough feedback data. Have ${feedbackCount}, need ${minSamples}`
        );
      }

      // Get paths
      const dbPath = this.config.storage.path!;
      const projectPath = getProjectBasePath(this.config.project.name);
      const outputDir = path.join(projectPath, "models", "retrained");

      // Get currently active model directory
      const activeModel = await this.storageManager.getActiveModel();
      let currentModelDir: string;

      if (activeModel && activeModel.path) {
        currentModelDir = activeModel.path;
        this.logger.info(
          `Retraining from active model: ${activeModel.version}`
        );
      } else {
        // Fall back to baseline
        currentModelDir = path.join(os.homedir(), ".fraud-guard/baseline");
        this.logger.info("No active model found - using baseline");
      }

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Get Python path
      const pythonPath = this.getPythonPath();

      // Get script path
      const scriptPath = path.join(__dirname, "../../scripts/retrain_model.py");

      this.logger.info(`Database: ${dbPath}`);
      this.logger.info(`Output: ${outputDir}`);
      this.logger.info(`Current model: ${currentModelDir}`);
      this.logger.info(`Python: ${pythonPath}`);

      // Run Python retraining script
      const result = await this.runPythonScript(
        pythonPath,
        scriptPath,
        dbPath,
        outputDir,
        currentModelDir // Pass current active model directory
      );

      if (result.success) {
        this.logger.info(`✓ Retraining successful! Version: ${result.version}`);
        this.logger.info(`  Accuracy: ${result.metrics?.accuracy.toFixed(4)}`);

        // Register new model in database
        await this.storageManager.registerModelVersion(
          result.version!,
          result.output_dir!,
          result.metrics!,
          false // Not baseline
        );

        this.logger.info(`✓ Model registered and set as active`);

        if (result.improvement) {
          this.logger.info(`  Improvement: +${result.improvement.toFixed(4)}`);
        }
      } else {
        this.logger.warn(
          `Retraining completed but new model not saved: ${result.error}`
        );

        if (result.current_accuracy && result.new_accuracy) {
          this.logger.info(
            `  Current accuracy: ${result.current_accuracy.toFixed(4)}`
          );
          this.logger.info(
            `  New accuracy:     ${result.new_accuracy.toFixed(4)}`
          );
          this.logger.info("  Keeping current model");
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error("Retraining failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Run Python retraining script
   */
  private async runPythonScript(
    pythonPath: string,
    scriptPath: string,
    dbPath: string,
    outputDir: string,
    baselineDir: string
  ): Promise<RetrainingResult> {
    return new Promise((resolve, reject) => {
      const args = [scriptPath, dbPath, outputDir, baselineDir];

      this.logger.debug(`Executing: ${pythonPath} ${args.join(" ")}`);

      const process = spawn(pythonPath, args);

      let stdout = "";
      let stderr = "";
      let resultJson: RetrainingResult | null = null;

      process.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;

        // Log Python output
        output.split("\n").forEach((line: string) => {
          if (line.trim()) {
            // Check for result JSON
            if (line.includes("RESULT_JSON:")) {
              const jsonStr = line.split("RESULT_JSON:")[1].trim();
              try {
                resultJson = JSON.parse(jsonStr);
              } catch (e) {
                this.logger.error("Failed to parse result JSON", e);
              }
            } else {
              this.logger.info(`[Python] ${line}`);
            }
          }
        });
      });

      process.stderr.on("data", (data) => {
        const output = data.toString();
        stderr += output;

        // Log Python errors
        output.split("\n").forEach((line: string) => {
          if (line.trim()) {
            // Check for result JSON in stderr
            if (line.includes("RESULT_JSON:")) {
              const jsonStr = line.split("RESULT_JSON:")[1].trim();
              try {
                resultJson = JSON.parse(jsonStr);
              } catch (e) {
                this.logger.error("Failed to parse result JSON", e);
              }
            } else {
              this.logger.error(`[Python] ${line}`);
            }
          }
        });
      });

      process.on("close", (code) => {
        if (code === 0 && resultJson && resultJson.success) {
          resolve(resultJson);
        } else {
          const errorMsg =
            resultJson?.error || stderr || "Retraining script failed";
          reject(new Error(errorMsg));
        }
      });

      process.on("error", (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Get Python executable path with auto-detection
   */
  private getPythonPath(): string {
    // 1. User explicitly specified venv in config
    if (this.config.retraining?.python_venv) {
      const venvPython = path.join(
        this.config.retraining.python_venv,
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
      );

      if (fs.existsSync(venvPython)) {
        this.logger.info(`Using configured venv: ${venvPython}`);
        return venvPython;
      } else {
        this.logger.warn(`Configured venv not found: ${venvPython}`);
      }
    }

    // 2. Check if Node.js process is running in a venv
    if (process.env.VIRTUAL_ENV) {
      const venvPython = path.join(
        process.env.VIRTUAL_ENV,
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
      );

      if (fs.existsSync(venvPython)) {
        this.logger.info(`Using active venv: ${venvPython}`);
        return venvPython;
      }
    }

    // 3. Check project's .fraud-guard-venv (created by setup command)
    const projectVenv = path.join(
      process.cwd(),
      ".fraud-guard-venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
    );

    if (fs.existsSync(projectVenv)) {
      this.logger.info(`Using project venv: ${projectVenv}`);
      return projectVenv;
    }

    // 4. Fall back to system Python with warning
    this.logger.warn(
      "No virtual environment found. Using system Python.\n" +
        'Run "npx fraud-guard setup-retraining" for isolated environment with exact package versions.'
    );

    return this.config.retraining?.python_path || "python3";
  }
}
