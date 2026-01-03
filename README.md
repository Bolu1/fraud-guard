
# fraud-guard

An on-premise fraud detection package for Node.js applications with incremental learning for it's AI model and velocity checks.
<!-- 
[![npm version](https://badge.fury.io/js/fraud-guard.svg)](https://www.npmjs.com/package/fraud-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) -->

**Key Features:**
- 🤖 Real-time fraud detection using CNN model
- 📈 Incremental learning - model improves with feedback
- ⚡  Velocity checks for behavioral patterns
- 💾 Completely on-premise storage
- 🔄 Automatic model retraining
- 📊 Model versioning and rollback
- 👨🏾‍💻 CLI tool utility tools
- 🚀 Zero external dependencies for inference

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Basic Usage](#basic-usage)
- [Configuration](#configuration)
  - [Configuration File Structure](#configuration-file-structure)
  - [Configuration Options](#configuration-options)
  - [Configuration Examples](#configuration-examples)
- [Core Concepts](#core-concepts)
- [Features](#features)
  - [Velocity Checks](#velocity-checks)
  - [Model Retraining](#model-retraining)
  - [Model Management](#model-management)
- [CLI Commands](#cli-commands)
- [API Reference](#api-reference)
- [Production Deployment](#production-deployment)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [License](#license)

---

## Installation

```bash
npm install @bolu1/fraud-guard
```

TypeScript types are included by default.

---

## Quick Start

**1. Create a configuration file:**

Create `fraud-guard.config.yml` in your project root:

```yaml
project:
  name: "my-app"

thresholds:
  review: 0.4  # Flag for review if score > 40%
  reject: 0.7  # Auto-reject if score > 70%
```

**2. Use in your application:**

```typescript
import { FraudGuard } from '@bolu1/fraud-guard';

const guard = new FraudGuard();

const result = await guard.check({
  amount: 1500.00,
  category: 'shopping_net',
  timestamp: new Date()
});

console.log(`Risk: ${result.risk}`);        // LOW, MEDIUM, HIGH, CRITICAL
console.log(`Action: ${result.action}`);    // ACCEPT, REVIEW, REJECT
console.log(`Score: ${result.score}%`);     // Fraud probability

guard.close();
```

---

## Basic Usage

### 1. Initialize Fraud Guard

```typescript
import { FraudGuard } from '@bolu1/fraud-guard';

const guard = new FraudGuard();
```

### 2. Check Transactions

```typescript
const transaction = {
  amount: 250.50,
  category: 'food_dining',
  timestamp: new Date()
};

const result = await guard.check(transaction);

// Result contains:
// - checkId: Unique identifier for this check
// - score: Fraud probability (0-1, shown as percentage)
// - risk: LOW | MEDIUM | HIGH | CRITICAL
// - action: ACCEPT | REVIEW | REJECT
// - velocityScore: (if velocity checks enabled)
// - velocityChecks: Details of velocity violations
```

### 3. Handle Results

```typescript
switch (result.action) {
  case 'ACCEPT':
    // Process transaction normally
    await processPayment(transaction);
    break;
    
  case 'REVIEW':
    // Flag for manual review
    await queueForReview(transaction, result);
    break;
    
  case 'REJECT':
    // Block transaction
    throw new Error('Transaction rejected due to fraud risk');
}
```

### 4. Provide Feedback (Optional but Recommended)

After investigation, provide feedback for velocity checks to improve the model:

```typescript
import { FraudGuard } from '@bolu1/fraud-guard';

const guard = new FraudGuard();

const result = await guard.check({
  id: `test_tx` // Required when you want to provide feedback, should be your transaction  so it's easy to provide feedback
  amount: 1500.00,
  category: 'shopping_net',
  timestamp: new Date()
});

// Transaction was legitimate
await guard.feedback(transactionId, false); //same id passed when the transaction was checked

// Transaction was fraud
await guard.feedback(transactionId, true);

// Transaction with status(optional for failed transaction check)
await guard.feedback(transactionId, true, "failed");
```

### 5. Close When Done

```typescript
// Clean shutdown
guard.close();
```

---

## Configuration

### Configuration File Structure
You can create an optional configuration file to access the additional functionalities of the package, without the configuration file, the AI model just makes a prediction using the baseline model

Create `fraud-guard.config.yml` in your project root:

```yaml
# Project identification (REQUIRED)
project:
  name: "my-ecommerce-store"  # Unique name for this project

# Fraud detection thresholds
thresholds:
  review: 0.4   # Score above 40% triggers review (default: 0.4)
  reject: 0.7   # Score above 70% triggers rejection (default: 0.7)

# Data storage for feedback and retraining
storage:
  enabled: false                    # Enable storage (default: false)
  path: null                        # Auto-generated if not specified
  retention:
    predictions_days: 90            # Keep predictions for 90 days (default: 90)

# Custom model path (optional)
model:
  path: null                        # Use baseline model if not specified

# Velocity checks - detect suspicious behavioral patterns
velocity:
  enabled: false                    # Enable velocity checks (default: false)
  scoring:
    model_weight: 0.6               # Weight for ML model score (default: 0.6)
    velocity_weight: 0.4            # Weight for velocity score (default: 0.4)
  
  # Transaction frequency rules
  frequency:
    enabled: true
    time_windows:
      - period_minutes: 10          # 5 transactions in 10 minutes
        max_transactions: 5
        score_adjustment: 0.2       # Adds 20% to fraud score
      - period_minutes: 60          # 10 transactions in 1 hour
        max_transactions: 10
        score_adjustment: 0.3
      - period_minutes: 1440        # 50 transactions in 24 hours
        max_transactions: 50
        score_adjustment: 0.4
  
  # Spending amount rules
  amount:
    enabled: true
    time_windows:
      - period_minutes: 60          # $5000 in 1 hour
        max_amount: 5000
        score_adjustment: 0.2
      - period_minutes: 1440        # $10000 in 24 hours
        max_amount: 10000
        score_adjustment: 0.3
    spike_detection:
      enabled: true
      lookback_days: 30             # Compare to last 30 days
      multiplier: 5                 # 5x normal spending
      score_adjustment: 0.4
  
  # Failed transaction monitoring
  failed_transactions:
    enabled: true
    time_windows:
      - period_minutes: 10          # 3 failures in 10 minutes
        max_failed: 3
        score_adjustment: 0.3
      - period_minutes: 60          # 5 failures in 1 hour
        max_failed: 5
        score_adjustment: 0.4

# Automatic model retraining
retraining:
  enabled: false                    # Enable retraining (default: false)
  python_path: "python3"            # Python executable (default: python3)
  python_venv: "bin/python"         # Virtual env relative path (default: bin/python)
  min_samples: 100                  # Minimum feedback needed (default: 100)
  schedule: "0 2 * * *"             # Cron schedule - 2 AM daily (default: 0 2 * * *)
  retained_versions: 5              # Keep last 5 models (default: 5)

# Logging configuration
logging:
  level: "INFO"                     # DEBUG, INFO, WARN, ERROR (default: INFO)
  console: true                     # Log to console (default: true)
```

### Configuration Options

#### **Project Settings**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `project.name` | string | Yes | - | Unique identifier for this project |

#### **Threshold Settings**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `thresholds.review` | number | No | 0.4 | Fraud score threshold for manual review (0-1) |
| `thresholds.reject` | number | No | 0.7 | Fraud score threshold for automatic rejection (0-1) |

#### **Storage Settings**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `storage.enabled` | boolean | No | false | Enable data storage for feedback and retraining |
| `storage.path` | string | No | auto | Path to SQLite database file |
| `storage.retention.predictions_days` | number | No | 90 | Days to retain prediction history |

#### **Model Settings**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `model.path` | string | No | baseline | Custom model directory path |

#### **Velocity Check Settings**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `velocity.enabled` | boolean | No | false | Enable behavioral pattern detection |
| `velocity.scoring.model_weight` | number | No | 0.6 | Weight for ML model score in final calculation |
| `velocity.scoring.velocity_weight` | number | No | 0.4 | Weight for velocity score in final calculation |
| `velocity.frequency` | object | No | See config | Transaction frequency rules |
| `velocity.amount` | object | No | See config | Spending amount rules |
| `velocity.failed_transactions` | object | No | See config | Failed transaction rules |

#### **Retraining Settings**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `retraining.enabled` | boolean | No | false | Enable automatic model retraining |
| `retraining.python_path` | string | No | "python3" | Path to Python executable |
| `retraining.python_venv` | string | No | "bin/python" | Virtual environment path |
| `retraining.min_samples` | number | No | 100 | Minimum feedback samples required for retraining |
| `retraining.schedule` | string | No | "0 2 * * *" | Cron schedule for automatic retraining |
| `retraining.retained_versions` | number | No | 5 | Number of model versions to keep |

#### **Logging Settings**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `logging.level` | string | No | "INFO" | Log level: DEBUG, INFO, WARN, ERROR |
| `logging.console` | boolean | No | true | Enable console logging |

### Configuration Examples

#### **Minimal Configuration (Detection Only)**

```yaml
project:
  name: "my-app"

thresholds:
  review: 0.4
  reject: 0.7
```

#### **With Storage (For feedback stored on-premise)**

```yaml
project:
  name: "my-app"

thresholds:
  review: 0.4
  reject: 0.7

storage:
  enabled: true
  retention:
    predictions_days: 90
```

#### **With Velocity Checks**

```yaml
project:
  name: "my-app"

thresholds:
  review: 0.4
  reject: 0.7

storage:
  enabled: true

velocity:
  enabled: true
  scoring:
    model_weight: 0.6
    velocity_weight: 0.4
```

#### **Full Production Setup**

```yaml
project:
  name: "my-ecommerce-store"

thresholds:
  review: 0.4
  reject: 0.7

storage:
  enabled: true
  retention:
    predictions_days: 90

velocity:
  enabled: true
  scoring:
    model_weight: 0.6
    velocity_weight: 0.4

retraining:
  enabled: true
  min_samples: 100
  schedule: "0 2 * * *"
  retained_versions: 5

logging:
  level: "INFO"
  console: true
```

---

## Core Concepts

### How Fraud Detection Works

1. **ML Model Scoring**: A CNN model analyzes transaction features (amount, time, category, etc.) and outputs a fraud probability (0-1)
2. **Velocity Checks** (optional): Behavioral pattern analysis adds context-based risk scoring
3. **Combined Scoring**: If velocity is enabled, scores are weighted and combined
4. **Threshold Evaluation**: Final score is compared against review/reject thresholds
5. **Action Recommendation**: Returns ACCEPT, REVIEW, or REJECT

### Thresholds

- **Review threshold** (default 0.4): Scores above this trigger manual review
- **Reject threshold** (default 0.7): Scores above this trigger automatic rejection
- **Risk levels**:
  - LOW: score < review threshold
  - MEDIUM: review ≤ score < reject
  - HIGH: score ≥ reject threshold
  - CRITICAL: score ≥ 0.9

### Feedback Loop

Providing feedback after manual review helps the model learn:

```typescript
// After confirming transaction was fraud
await guard.feedback(checkId, true);

// After confirming transaction was legitimate
await guard.feedback(checkId, false);
```

The model uses this feedback during automatic retraining to improve accuracy.

### Velocity Checks

Velocity checks detect suspicious behavioral patterns:

- **Frequency**: Too many transactions in short time
- **Amount**: Unusual spending patterns or spikes
- **Failed attempts**: Multiple failed transactions

These checks complement the ML model by catching behavioral red flags.

### Model Retraining

When enabled, the model automatically retrains on new feedback data:

1. Runs on schedule (default: 2 AM daily)
2. Requires minimum feedback samples (default: 100)
3. Creates new model version only if accuracy improves
4. Automatically loads improved model (no restart needed)
5. Keeps last N versions for rollback (default: 5)

---

## Features

### Velocity Checks

**What They Detect:**
- Rapid transaction bursts (credential testing)
- Unusual spending spikes (compromised accounts)
- Multiple failed attempts (brute force)

**Configuration:**

```yaml
velocity:
  enabled: true
  frequency:
    time_windows:
      - period_minutes: 10
        max_transactions: 5
        score_adjustment: 0.2
```

**Example Result:**

```typescript
{
  score: 45.2,
  velocityScore: 20.0,
  velocityChecks: [
    {
      type: 'frequency',
      period: 10,
      count: 7,
      limit: 5,
      adjustment: 0.2
    }
  ]
}
```

### Model Retraining

**Setup:**

```bash
# 1. Install Python dependencies
npx fraud-guard setup-retraining

# 2. Enable in config
```

```yaml
retraining:
  enabled: true
  min_samples: 100
  schedule: "0 2 * * *"  # Daily at 2 AM
```

**How It Works:**

1. Collects feedback from `provideFeedback()` calls
2. Waits for minimum samples (default: 100)
3. Runs scheduled retraining (default: 2 AM daily)
4. Compares new model accuracy to current
5. Deploys new model if better (automatic, no restart)
6. Keeps last 5 versions for rollback

**Manual Trigger:**

```bash
npx fraud-guard retrain
```

**Monitoring:**

```bash
# View retraining statistics
npx fraud-guard prediction-stats
```

### Model Management

**List Available Models:**

```bash
npx fraud-guard list-models
```

Output:
```
● 20260103_163557
  Created:  Jan 3, 2026, 4:35:57 PM
  Accuracy: 98.50%
  Samples:  120

  20260103_160412
  Created:  Jan 3, 2026, 4:04:12 PM
  Accuracy: 97.80%
  Samples:  100

  v1.0.0 [BASELINE]
  Created:  Jan 1, 2026, 12:00:00 AM
  Accuracy: 95.00%
  Samples:  1000
```

**Switch Model Version:**

```bash
npx fraud-guard switch-model 20260103_160412
```

**Programmatic Access:**

```typescript
// List all models
const models = await guard.listModels();

// Switch to specific version
await guard.switchModel('20260103_160412');
```

---

## CLI Commands

```bash
npx fraud-guard --help                    # Show help
npx fraud-guard setup-retraining   # Setup Python environment
npx fraud-guard model-info         # Current model information
npx fraud-guard prediction-stats   # Feedback statistics
npx fraud-guard retrain            # Manual retraining
npx fraud-guard list-models        # List all model versions
npx fraud-guard switch-model <ver> # Switch active model
```

### setup-retraining

Setup Python virtual environment and install dependencies for model retraining.

```bash
npx fraud-guard setup-retraining
```

### model-info

Display current model information and configuration.

```bash
npx fraud-guard model-info
```

Output:
```
Current Model: v1.0.0 (baseline)
Location: ~/.fraud-guard/baseline

Configuration:
  Project: my-app
  Storage: Enabled
  Velocity: Disabled
  Retraining: Enabled
```

### prediction-stats

View feedback statistics and retraining readiness.

```bash
npx fraud-guard prediction-stats
```

Output:
```
Total Predictions: 1,250
Predictions with Feedback: 85
Feedback Rate: 6.8%

Retraining Status:
  Minimum Required: 100 samples
  Currently Have: 85 samples
  Ready to Retrain: No (need 15 more)
```

### retrain

Manually trigger model retraining.

```bash
npx fraud-guard retrain
```

### list-models

List all available model versions.

```bash
npx fraud-guard list-models
```

### switch-model

Switch to a different model version.

```bash
npx fraud-guard switch-model 20260103_163557
```

---

## API Reference

### FraudGuard Class

```typescript
import { FraudGuard } from '@bolu1/fraud-guard';
```

#### Constructor

```typescript
const guard = new FraudGuard();
```

Loads configuration from `fraud-guard.config.yml`.

#### Methods

**`check(transaction: TransactionData): Promise<FraudCheckResult>`**

Check a transaction for fraud.

```typescript
const result = await guard.check({
  amount: 150.00,
  category: 'shopping_net',
  timestamp: new Date(),
  customerId: 'user_123',
  ipAddress: '192.168.1.1',
  deviceId: 'device_abc'
});
```

**`provideFeedback(checkId: string, isFraud: boolean): Promise<void>`**

Provide feedback on a previous fraud check.

```typescript
await guard.feedback(result.checkId, true);
```

**`retrain(): Promise<RetrainingResult>`**

Manually trigger model retraining.

```typescript
const result = await guard.retrain();
console.log(`New model accuracy: ${result.metrics.accuracy}`);
```

**`listModels(): Promise<ModelVersion[]>`**

List all available model versions.

```typescript
const models = await guard.listModels();
models.forEach(m => console.log(`${m.version}: ${m.accuracy}`));
```

**`switchModel(version: string): Promise<void>`**

Switch to a different model version.

```typescript
await guard.switchModel('20260103_160412');
```

**`close(): void`**

Clean shutdown - stops scheduled jobs and closes connections.

```typescript
guard.close();
```

### Types

**TransactionData**

```typescript
interface TransactionData {
  amount: number;
  category: string;
  timestamp: Date;
  customerId?: string;
  ipAddress?: string;
  deviceId?: string;
  id?: string;
}
```

**FraudCheckResult**

```typescript
interface FraudCheckResult {
  checkId: string;
  score: number;              // 0-100
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action: 'ACCEPT' | 'REVIEW' | 'REJECT';
  velocityScore?: number;
  velocityChecks?: VelocityCheck[];
}
```

**RetrainingResult**

```typescript
interface RetrainingResult {
  success: boolean;
  version?: string;
  metrics?: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    auc: number;
  };
  improvement?: number;
  error?: string;
}
```

---

## Production Deployment

### Best Practices

**1. Enable Storage**
```yaml
storage:
  enabled: true
```

**2. Configure Appropriate Thresholds**

Adjust based on your risk tolerance:
- Conservative: `review: 0.3, reject: 0.6`
- Balanced: `review: 0.4, reject: 0.7` (default)
- Aggressive: `review: 0.5, reject: 0.8`

**3. Enable Velocity Checks**

For payment processing, velocity checks significantly improve detection.

**4. Provide Feedback Consistently**

The model only improves if you provide feedback on reviewed cases.

**5. Monitor Retraining**

Check logs to ensure retraining completes successfully:
```bash
npx fraud-guard prediction-stats
```

**6. Database Cleanup**

Automatic cleanup runs daily. Adjust retention as needed:
```yaml
storage:
  retention:
    predictions_days: 90
```

### Security

- **Data Retention**: Configure appropriate retention for compliance (GDPR, etc.)
- **PII Handling**: customerID, IP, deviceID are optional - exclude if not needed
- **Model Security**: Model files stored on-premise in `~/.fraud-guard/` with user permissions
- **Database**: SQLite database uses filesystem permissions

---

## Examples

### E-commerce Checkout

```typescript
import { FraudGuard } from '@bolu1/fraud-guard';
import express from 'express';

const app = express();
const guard = new FraudGuard();

app.post('/checkout', async (req, res) => {
  const { userId, amount, cartItems, ip, deviceId } = req.body;
  
  // Check for fraud
  const result = await guard.check({
    amount,
    category: 'shopping_net',
    timestamp: new Date(),
    customerId: userId,
    ipAddress: ip,
    deviceId
  });
  
  switch (result.action) {
    case 'ACCEPT':
      await processOrder(req.body);
      res.json({ success: true });
      break;
      
    case 'REVIEW':
      await flagForReview(req.body, result);
      res.json({ success: true, review: true });
      break;
      
    case 'REJECT':
      res.status(403).json({ error: 'Payment declined' });
      break;
  }
});

// After manual review
app.post('/review/:checkId', async (req, res) => {
  const { isFraud } = req.body;
  await guard.feedback(req.params.checkId, isFraud);
  res.json({ success: true });
});
```

### Payment Gateway Integration

```typescript
async function processPayment(payment: Payment) {
  const fraudCheck = await guard.check({
    amount: payment.amount,
    category: payment.category,
    timestamp: new Date(),
    customerId: payment.customerId,
    ipAddress: payment.metadata.ip,
    deviceId: payment.metadata.device
  });
  
  // Add fraud score to payment metadata
  payment.metadata.fraudScore = fraudCheck.score;
  payment.metadata.fraudCheckId = fraudCheck.checkId;
  
  if (fraudCheck.action === 'REJECT') {
    throw new PaymentError('Transaction blocked - fraud risk');
  }
  
  if (fraudCheck.action === 'REVIEW') {
    payment.status = 'PENDING_REVIEW';
    await sendToReviewQueue(payment);
  } else {
    payment.status = 'APPROVED';
    await executePayment(payment);
  }
  
  return payment;
}
```

### Subscription Fraud Detection

```typescript
async function createSubscription(user: User, plan: Plan) {
  // Check signup for fraud
  const result = await guard.check({
    amount: plan.price,
    category: 'misc_net',
    timestamp: new Date(),
    customerId: user.id,
    ipAddress: user.signupIp,
    deviceId: user.deviceFingerprint
  });
  
  if (result.risk === 'HIGH' || result.risk === 'CRITICAL') {
    // Require additional verification
    await sendVerificationEmail(user);
    await requirePhoneVerification(user);
  }
  
  // Track the check ID for later feedback
  const subscription = await createSub(user, plan);
  subscription.fraudCheckId = result.checkId;
  
  return subscription;
}

// After user proves legitimacy (or commits fraud)
async function updateFraudStatus(subscription: Subscription) {
  if (subscription.fraudCheckId) {
    await guard.feedback(
      subscription.fraudCheckId,
      subscription.isFraud
    );
  }
}
```

---

## Troubleshooting

### Python Environment Issues

**Problem**: `npx fraud-guard setup-retraining` fails

**Solution**:
- Ensure Python 3.8+ is installed: `python3 --version`
- On Ubuntu, install venv: `sudo apt-get install python3-venv`
- Check Python path in config matches your system

### Model Not Loading

**Problem**: "Model file not found" error

**Solution**:
- Verify baseline model exists: `ls ~/.fraud-guard/baseline/`
- Check model.path in config if using custom model
- Ensure model directory contains all required files (model.json, etc.)

### Storage Connection Errors

**Problem**: "Storage not initialized" error

**Solution**:
- Enable storage in config: `storage.enabled: true`
- Verify database path is writable
- Check disk space

### Retraining Failures

**Problem**: Retraining completes but model not improving

**Solution**:
- Ensure sufficient feedback data (100+ samples)
- Check feedback quality - balance of fraud/legitimate
- Review Python logs for training errors

### Performance Issues

**Problem**: Slow fraud checks

**Solution**:
- Disable velocity checks if not needed
- Reduce database retention period
- Use appropriate hardware (model runs on CPU)

---

## FAQ


**Q: What data is stored?**

A: Only prediction results and feedback. Raw transaction data is not stored. You control retention period via config.

**Q: Can I use my own model?**

A: Yes, specify `model.path` in config. Model must be TensorFlow.js format with matching feature structure.

**Q: How much does retraining cost (compute)?**

A: Retraining typically takes 30-60 seconds on a standard CPU. No GPU required.

**Q: Does it work offline?**

A: Yes, fraud detection works completely offline. Only retraining requires Python packages (one-time install).

**Q: How is this different from rule-based systems?**

A: ML models detect patterns humans miss. Velocity rules complement ML for known attack patterns.

**Q: Can I customize velocity rules?**

A: Yes, all velocity thresholds and time windows are configurable in `fraud-guard.config.yml`.

---

## License

MIT License - see LICENSE file for details

---

## 📞 Support

For issues and questions, please visit our [GitHub repository](https://github.com/Bolu1/fraud-guard).