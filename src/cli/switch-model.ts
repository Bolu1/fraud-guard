#!/usr/bin/env node

import { FraudGuard } from '../core/fraud-guard';

console.log('='.repeat(80));
console.log('FRAUD GUARD - SWITCH ACTIVE MODEL');
console.log('='.repeat(80));
console.log('');

async function main() {
  // Get model version from command line argument
  const modelVersion =process.argv[3] || process.argv[2];

  if (!modelVersion) {
    console.error('❌ Error: Model version required');
    console.error('');
    console.error('Usage: npx fraud-guard switch-model <version>');
    console.error('');
    console.error('Examples:');
    console.error('  npx fraud-guard switch-model 20260103_100426');
    console.error('  npx fraud-guard switch-model v1.0.0');
    console.error('');
    console.error('To see available models, run:');
    console.error('  npx fraud-guard list-models');
    console.error('');
    process.exit(1);
  }

  const guard = new FraudGuard();
  const config = guard.getConfig();

  console.log('Configuration:');
  console.log(`  Project:  ${config.project.name}`);
  console.log(`  Storage:  ${config.storage.enabled ? 'Enabled' : 'Disabled'}`);
  console.log('');

  if (!config.storage.enabled) {
    console.error('❌ Storage must be enabled to switch models');
    console.error('');
    console.error('Enable storage in fraud-guard.config.yml:');
    console.error('');
    console.error('storage:');
    console.error('  enabled: true');
    console.error('');
    process.exit(1);
  }

  try {
    // Initialize to setup storage
    console.log('Initializing...');
    await guard.ensureInitialized();
    console.log('');

    // Switch to the specified model
    console.log(`Switching to model version: ${modelVersion}...`);
    console.log('');

    await guard.switchModel(modelVersion);

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ MODEL SWITCHED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Active Model: ${modelVersion}`);
    console.log('');
    console.log('✓ Model loaded and ready to use');
    console.log('  No restart required.');
    console.log('');

    guard.close();
    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('❌ MODEL SWITCH FAILED');
    console.error('');
    console.error(`Error: ${error.message}`);
    console.error('');
    console.error('To see available models, run:');
    console.error('  npx fraud-guard list-models');
    console.error('');

    guard.close();
    process.exit(1);
  }
}

main();