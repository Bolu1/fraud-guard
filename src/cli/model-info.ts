#!/usr/bin/env node

import { FraudGuard } from '../core/fraud-guard';

console.log('='.repeat(80));
console.log('FRAUD GUARD - MODEL INFORMATION');
console.log('='.repeat(80));
console.log('');

async function showModelInfo() {
  const guard = new FraudGuard();
  
  try {
    const config = guard.getConfig();
    
    // Initialize without running a check
    // We'll access modelInfo after initialization
    if (!config.storage?.enabled) {
      // If storage disabled, we need a check to initialize
      await guard.check({
        amount: 1,
        timestamp: new Date(),
        category: 'food_dining' as any,
      });
    } else {
      // If storage enabled, initialize directly
      await (guard as any).ensureInitialized();
    }
    
    const modelInfo = guard.getModelInfo();
    
    console.log('Current Model:');
    console.log(`  Version:     ${modelInfo.version}`);
    console.log(`  Type:        ${modelInfo.isBaseline ? 'Baseline' : 'Retrained'}`);
    console.log('');
    
    console.log('Configuration:');
    console.log(`  Project:     ${config.project.name}`);
    console.log(`  Storage:     ${config.storage?.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  Velocity:    ${config.velocity?.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  Retraining:  ${config.retraining?.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('');
    
    console.log('Thresholds:');
    console.log(`  Review:      ${(config.thresholds?.review || 0.4) * 100}%`);
    console.log(`  Reject:      ${(config.thresholds?.reject || 0.7) * 100}%`);
    console.log('');
    
    guard.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    guard.close();
    process.exit(1);
  }
}

showModelInfo();