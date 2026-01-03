#!/usr/bin/env node

const command = process.argv[2];

const commands: Record<string, string> = {
  "setup-retraining": "./setup-retraining.js",
  "model-info": "./model-info.js",
  "prediction-stats": "./prediction-stats.js",
  retrain: "./retrain.js",
  "list-models": "./list-models.js",
  "switch-model": "./switch-model.js",
};

if (!command || command == "--help" || command == "-h") {
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
  console.log("  list-models        List all available model versions");
  console.log("  switch-model       Switch to a different model version");
  console.log("");
  process.exit(0);
}

const commandPath = commands[command];

if (!commandPath) {
  console.error(`Unknown command: ${command}`);
  console.error("");
  console.error(
    'Run "npx fraud-guard --help" to see available commands'
  );
  console.error("");
  process.exit(1);
}

// Execute the command
require(commandPath);
