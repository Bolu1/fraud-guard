```
fraud-guard/
├── src/
│   ├── index.ts                    # Main exports
│   ├── fraud-guard.ts              # FraudGuard class
│   ├── types.ts                    # TypeScript types/interfaces
│   │
│   ├── config/
│   │   ├── defaults.ts             # Default configuration
│   │   ├── loader.ts               # YAML config loader
│   │   └── paths.ts                # Path resolution
│   │
│   ├── model/
│   │   ├── inference.ts            # ONNX inference engine
│   │   ├── manager.ts              # Model management
│   │   └── versioning.ts           # Version tracking
│   │
│   ├── features/
│   │   ├── extractor.ts            # Feature extraction
│   │   ├── velocity.ts             # Velocity checks
│   │   └── engineering.ts          # Feature engineering
│   │
│   ├── storage/
│   │   ├── sqlite.ts               # SQLite implementation
│   │   ├── schema.ts               # Database schema
│   │   └── migrations.ts           # Schema migrations
│   │
│   ├── retraining/
│   │   ├── manager.ts              # Retraining orchestration
│   │   ├── python-trainer.ts      # Python subprocess wrapper
│   │   └── scheduler.ts            # Auto-retraining scheduler
│   │
│   ├── rules/
│   │   └── engine.ts               # Rules evaluation
│   │
│   ├── cli/
│   │   ├── index.ts                # CLI entry point
│   │   └── commands/               # CLI commands
│   │       ├── init.ts
│   │       ├── info.ts
│   │       ├── retrain.ts
│   │       └── setup.ts
│   │
│   └── utils/
│       ├── logger.ts               # Logging utility
│       ├── errors.ts               # Custom errors
│       └── validation.ts           # Input validation
│
├── models/
│   └── baseline.onnx               # Pre-trained baseline model
│
├── training/
│   ├── train.py                    # Python training script
│   ├── requirements.txt            # Python dependencies
│   └── utils/
│       └── data_prep.py
│
├── examples/
│   ├── basic.ts                    # Basic usage
│   ├── express.ts                  # Express integration
│   └── with-config.ts              # With configuration
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── setup.ts
│
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── tsconfig.json
├── jest.config.js
├── package.json
├── README.md
├── LICENSE
└── CHANGELOG.md


