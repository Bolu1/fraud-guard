export const SCHEMA = `
-- Predictions table (stores all predictions and feedback)
CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  
  amt REAL NOT NULL,
  hour INTEGER NOT NULL,
  month INTEGER NOT NULL,
  dayofweek INTEGER NOT NULL,
  day INTEGER NOT NULL,
  category TEXT NOT NULL,
  
  score REAL NOT NULL,
  risk_level TEXT NOT NULL,
  action TEXT NOT NULL,
  model_version TEXT NOT NULL,
  
  actual_fraud INTEGER,
  feedback_provided INTEGER DEFAULT 0,
  feedback_at DATETIME,
  feedback_notes TEXT,
  transaction_status TEXT,

  device_id TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_transaction_id ON predictions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_customer_id ON predictions(customer_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_provided ON predictions(feedback_provided);
CREATE INDEX IF NOT EXISTS idx_model_version ON predictions(model_version);
CREATE INDEX IF NOT EXISTS idx_customer_created ON predictions(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_device_created ON predictions(device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ip_created ON predictions(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_status ON predictions(transaction_status);

-- Model versions table
CREATE TABLE IF NOT EXISTS model_versions (
  version TEXT PRIMARY KEY,
  created_at DATETIME NOT NULL,
  is_baseline INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 0,
  training_samples INTEGER,
  training_duration_seconds REAL,
  accuracy REAL,
  notes TEXT,
  model_path TEXT
);

-- Metadata table
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME
);
`;