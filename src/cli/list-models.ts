#!/usr/bin/env node

import { FraudGuard } from '../core/fraud-guard';

console.log('='.repeat(80));
console.log('FRAUD GUARD - MODEL VERSIONS');
console.log('='.repeat(80));
console.log('');

async function main() {
  const guard = new FraudGuard();
  const config = guard.getConfig();

  console.log('Configuration:');
  console.log(`  Project:  ${config.project.name}`);
  console.log(`  Storage:  ${config.storage.enabled ? 'Enabled' : 'Disabled'}`);
  console.log('');

  if (!config.storage.enabled) {
    console.error('❌ Storage must be enabled to view model versions');
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
    await guard.ensureInitialized();

    // Get all model versions
    const models = await guard.listModels();

    if (models.length === 0) {
      console.log('No models found.');
      console.log('');
      console.log('Train a model by running:');
      console.log('  npx fraud-guard retrain');
      console.log('');
    } else {
      console.log(`Found ${models.length} model version(s):`);
      console.log('');

      for (const model of models) {
        const isActive = model.is_active ? '●' : ' ';
        const isBaseline = model.is_baseline ? '[BASELINE]' : '';
        
        console.log(`${isActive} ${model.version} ${isBaseline}`);
        console.log(`  Created:  ${new Date(model.created_at).toLocaleString()}`);
        console.log(`  Accuracy: ${model.accuracy ? (model.accuracy * 100).toFixed(2) + '%' : 'N/A'}`);
        console.log(`  Samples:  ${model.training_samples || 'N/A'}`);
        console.log(`  Path:     ${model.model_path || 'N/A'}`);
        console.log('');
      }

      console.log('Legend:');
      console.log('  ● = Active model');
      console.log('');
      console.log('To switch to a different model:');
      console.log('  npx fraud-guard switch-model <version>');
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

main();