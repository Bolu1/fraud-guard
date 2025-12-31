#!/usr/bin/env node

const command = process.argv[2];

const commands: Record<string, string> = {
  "setup-retraining": "./setup-retraining.js",
  "model-info": "./model-info.js",
  "prediction-stats": "./prediction-stats.js",
  retrain: "./retrain.js",
};

if (!command) {
  console.log("");
  console.log("Fraud Guard CLI");
  console.log("");
  console.log("Usage: npx fraud-guard <command>");
  console.log("");
  console.log("Available commands:");
  console.log("  setup-retraining   Setup Python environment for retraining");
  console.log("  model-info         View current model information");
  console.log("  prediction-stats   View feedback statistics");
  console.log("  retrain            Trigger manual model retraining");
  console.log("");
  process.exit(0);
}

const commandPath = commands[command];

if (!commandPath) {
  console.error(`Unknown command: ${command}`);
  console.error("");
  console.error(
    "Available commands: setup-retraining, model-info, prediction-stats, retrain"
  );
  console.error("");
  process.exit(1);
}

// Execute the command
require(commandPath);
