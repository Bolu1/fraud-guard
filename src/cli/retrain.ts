#!/usr/bin/env node

import { FraudGuard } from '../core/fraud-guard';

console.log('='.repeat(80));
console.log('FRAUD GUARD - MODEL RETRAINING');
console.log('='.repeat(80));
console.log('');

async function main() {
  const guard = new FraudGuard();
  const config = guard.getConfig();

  console.log('Configuration:');
  console.log(`  Project:    ${config.project.name}`);
  console.log(`  Storage:    ${config.storage.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`  Retraining: ${config.retraining?.enabled ? 'Enabled' : 'Disabled'}`);
  console.log('');

  if (!config.retraining?.enabled) {
    console.error('❌ Retraining is not enabled in configuration');
    console.error('');
    console.error('Enable retraining in fraud-guard.config.yml:');
    console.error('');
    console.error('retraining:');
    console.error('  enabled: true');
    console.error('  min_samples: 10');
    console.error('');
    process.exit(1);
  }

  if (!config.storage.enabled) {
    console.error('❌ Storage must be enabled for retraining');
    process.exit(1);
  }

  try {
    console.log('Starting retraining process...');
    console.log('This may take 1-2 minutes...');
    console.log('');

    const result = await guard.retrain();

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ RETRAINING SUCCESSFUL');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Model Version: ${result.version}`);
    console.log('');
    console.log('Performance Metrics:');
    console.log(`  Accuracy:  ${(result.metrics.accuracy * 100).toFixed(2)}%`);
    console.log(`  Precision: ${(result.metrics.precision * 100).toFixed(2)}%`);
    console.log(`  Recall:    ${(result.metrics.recall * 100).toFixed(2)}%`);
    console.log(`  F1 Score:  ${(result.metrics.f1 * 100).toFixed(2)}%`);
    console.log(`  AUC:       ${(result.metrics.auc * 100).toFixed(2)}%`);
    console.log('');
    console.log('Training Data:');
    console.log(`  Training Samples: ${result.metrics.training_samples}`);
    console.log(`  Test Samples:     ${result.metrics.test_samples}`);
    console.log('');
    
    if (result.improvement !== null && result.improvement !== undefined) {
      console.log(`Model Improvement: +${(result.improvement * 100).toFixed(2)}%`);
      console.log('');
    }
    
    console.log(`Output Directory: ${result.output_dir}`);
    console.log('');
    console.log('✓ New model automatically loaded and active!');
    console.log('  No restart required.');
    console.log('');

    guard.close();
    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('❌ RETRAINING FAILED');
    console.error('');
    console.error(`Error: ${error.message}`);
    console.error('');

    guard.close();
    process.exit(1);
  }
}

main();