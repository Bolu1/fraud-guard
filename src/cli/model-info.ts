#!/usr/bin/env node

import { FraudGuard } from "../core/fraud-guard";

console.log("=".repeat(80));
console.log("FRAUD GUARD - MODEL INFORMATION");
console.log("=".repeat(80));
console.log("");

async function showModelInfo() {
  const guard = new FraudGuard();

  try {
    // Initialize to load model
    await guard.check({
      amount: 1,
      timestamp: new Date(),
      category: "food_dining" as any,
    });

    const modelInfo = guard.getModelInfo();
    const config = guard.getConfig();

    console.log("Current Model:");
    console.log(`  Version:     ${modelInfo.version}`);
    console.log(
      `  Type:        ${modelInfo.isBaseline ? "Baseline" : "Retrained"}`
    );

    console.log("Configuration:");
    console.log(`  Project:     ${config.project.name}`);
    console.log(
      `  Storage:     ${config.storage?.enabled ? "Enabled" : "Disabled"}`
    );
    console.log(
      `  Velocity:    ${config.velocity?.enabled ? "Enabled" : "Disabled"}`
    );
    console.log(
      `  Retraining:  ${config.retraining?.enabled ? "Enabled" : "Disabled"}`
    );
    console.log("");

    console.log("Thresholds:");
    console.log(`  Review:      ${(config.thresholds?.review || 0.4) * 100}%`);
    console.log(`  Reject:      ${(config.thresholds?.reject || 0.7) * 100}%`);
    console.log("");

    guard.close();
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    guard.close();
    process.exit(1);
  }
}

showModelInfo();
