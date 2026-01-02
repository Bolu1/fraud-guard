#!/usr/bin/env node

import { FraudGuard } from '../core/fraud-guard';

console.log('='.repeat(80));
console.log('FRAUD GUARD - PREDICTION STATISTICS');
console.log('='.repeat(80));
console.log('');

async function showPredictionStats() {
  const guard = new FraudGuard();
  const config = guard.getConfig();
  
  if (!config.storage?.enabled) {
    console.error('❌ Storage must be enabled to view prediction statistics');
    console.error('');
    console.error('Enable storage in fraud-guard.config.yml:');
    console.error('');
    console.error('storage:');
    console.error('  enabled: true');
    console.error('');
    process.exit(1);
  }
  
  try {
    // Initialize storage without running a check
    await (guard as any).ensureInitialized();
    
    // Access storage manager
    const storageManager = (guard as any).storageManager;
    
    if (!storageManager) {
      throw new Error('Storage manager not initialized');
    }
    
    const feedbackCount = await storageManager.countPredictionsWithFeedback();
    const totalPredictions = await storageManager.getTotalPredictions();
    
    console.log('Prediction Statistics:');
    console.log(`  Total Predictions:         ${totalPredictions}`);
    console.log(`  Predictions with Feedback: ${feedbackCount}`);
    console.log(`  Feedback Rate:             ${totalPredictions > 0 ? ((feedbackCount / totalPredictions) * 100).toFixed(2) : 0}%`);
    console.log('');
    
    if (config.retraining?.enabled) {
      const minSamples = config.retraining.min_samples || 100;
      const remaining = Math.max(0, minSamples - feedbackCount);
      
      console.log('Retraining Status:');
      console.log(`  Required Samples:  ${minSamples}`);
      console.log(`  Current Samples:   ${feedbackCount}`);
      console.log(`  Remaining:         ${remaining}`);
      console.log('');
      
      if (feedbackCount >= minSamples) {
        console.log('✅ Ready to retrain!');
        console.log('');
        console.log('Run: npx fraud-guard retrain');
      } else {
        console.log(`⚠️  Need ${remaining} more feedback sample(s) before retraining`);
        console.log('');
        console.log('Provide more feedback using:');
        console.log('  await guard.feedback(transactionId, actualFraud, status)');
      }
      console.log('');
    }
    
    guard.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    guard.close();
    process.exit(1);
  }
}

showPredictionStats();