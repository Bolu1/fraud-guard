#!/usr/bin/env python3
"""
Fraud Detection Model Incremental Retraining Script

This script retrains the fraud detection model using feedback data
from the SQLite database using incremental learning (fine-tuning).
"""

import sys
import json
import sqlite3
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TensorFlow warnings

import numpy as np
import pandas as pd
from datetime import datetime

# TensorFlow imports
import tensorflow as tf
import tf_keras as keras

# TensorFlow.js converter
import subprocess

def load_feedback_data(db_path: str) -> pd.DataFrame:
    """Load transactions with feedback from database"""
    print(f"Loading feedback data from: {db_path}")
    
    conn = sqlite3.connect(db_path)
    
    query = """
    SELECT 
        amt, hour, month, dayofweek, day, category,
        actual_fraud
    FROM predictions 
    WHERE feedback_provided = 1
    AND actual_fraud IS NOT NULL
    ORDER BY created_at DESC
    """
    
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    print(f"Loaded {len(df)} transactions with feedback")
    
    if len(df) == 0:
        raise ValueError("No feedback data available for retraining")
    
    return df


def load_scaler_params(scaler_path: str) -> dict:
    """Load frozen scaler parameters"""
    print(f"Loading scaler parameters from: {scaler_path}")
    
    with open(scaler_path, 'r') as f:
        scaler_params = json.load(f)
    
    print(f"Loaded scaler with {len(scaler_params['feature_columns'])} features")
    
    return scaler_params


def prepare_features(df: pd.DataFrame, scaler_params: dict) -> tuple:
    """Prepare features and labels using frozen scaler"""
    print("Preparing features...")
    
    # One-hot encode category
    category_dummies = pd.get_dummies(df['category'], prefix='category')
    
    # Combine features
    feature_cols = ['amt', 'hour', 'month', 'dayofweek', 'day']
    X = pd.concat([df[feature_cols], category_dummies], axis=1)
    y = df['actual_fraud'].values
    
    print(f"Features shape before alignment: {X.shape}")
    print(f"Class distribution: Fraud={y.sum()}, Legitimate={len(y)-y.sum()}")
    
    # Get expected feature columns from scaler
    expected_features = scaler_params['feature_columns']
    
    # Align columns with scaler (reorder and fill missing)
    # Note: category columns in scaler don't have 'category_' prefix
    # So we need to map them
    X_aligned = []
    for feature in expected_features:
        if feature in ['amt', 'hour', 'month', 'dayofweek', 'day']:
            # Direct numeric feature
            X_aligned.append(X[feature].values)
        else:
            # Category feature - add 'category_' prefix
            category_col = f'category_{feature}'
            if category_col in X.columns:
                X_aligned.append(X[category_col].values)
            else:
                # Category not present in data - fill with 0
                X_aligned.append(np.zeros(len(X)))
    
    X_aligned = np.array(X_aligned).T
    
    print(f"Features shape after alignment: {X_aligned.shape}")
    
    # Apply frozen scaler (standardization)
    scaler_mean = np.array(scaler_params['mean'])
    scaler_std = np.array(scaler_params['std'])
    
    X_scaled = (X_aligned - scaler_mean) / scaler_std
    X_scaled = X_scaled.astype(np.float32)
    
    # Reshape for CNN (add channel dimension)
    X_scaled = X_scaled.reshape(X_scaled.shape[0], X_scaled.shape[1], 1)
    y = y.astype(np.float32)
    
    print(f"Final shape: {X_scaled.shape}")
    
    return X_scaled, y

def load_base_model(model_path: str) -> keras.Model:
    """Load base Keras model"""
    print(f"Loading base model from: {model_path}")
    
    model = keras.models.load_model(model_path)
    
    print("Base model loaded successfully")
    print("\nModel architecture:")
    model.summary()
    
    return model


def load_current_model_metrics(model_config_path: str) -> dict:
    """Load current model metrics from model_config.json"""
    if not os.path.exists(model_config_path):
        print("No existing model config found - this is first retraining")
        return None
    
    try:
        with open(model_config_path, 'r') as f:
            model_config = json.load(f)
        
        print(f"Current model version: {model_config.get('version', 'unknown')}")
        print(f"Current model accuracy: {model_config['metrics']['accuracy']:.4f}")
        
        return model_config['metrics']
    except Exception as e:
        print(f"Warning: Could not load current model metrics: {e}")
        return None


def evaluate_model(model: keras.Model, X: np.ndarray, y: np.ndarray) -> dict:
    """Evaluate model and return metrics"""
    loss, accuracy = model.evaluate(X, y, verbose=0)
    
    # Get predictions for additional metrics
    y_pred_prob = model.predict(X, verbose=0)
    y_pred = (y_pred_prob > 0.5).astype(int).flatten()
    
    # Calculate precision, recall, F1
    from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score
    
    metrics = {
        'accuracy': float(accuracy),
        'loss': float(loss),
        'precision': float(precision_score(y, y_pred, zero_division=0)),
        'recall': float(recall_score(y, y_pred, zero_division=0)),
        'f1': float(f1_score(y, y_pred, zero_division=0)),
        'auc': float(roc_auc_score(y, y_pred_prob)),
    }
    
    return metrics


def fine_tune_model(model: keras.Model, X: np.ndarray, y: np.ndarray, 
                    epochs: int = 10, batch_size: int = 4) -> dict:
    """Fine-tune model with new data"""
    print(f"\nFine-tuning model...")
    print(f"  Epochs: {epochs}")
    print(f"  Batch size: {batch_size}")
    print(f"  Learning rate: 0.0001 (low to prevent catastrophic forgetting)")
    
    # Compile with very low learning rate
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.0001),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    # Train
    history = model.fit(
        X, y,
        epochs=epochs,
        batch_size=batch_size,
        validation_split=0.2,
        verbose=1
    )
    
    return history


def save_model(model: keras.Model, output_dir: str, metrics: dict, 
               training_samples: int, test_samples: int, feature_columns: list) -> str:
    """Save retrained model and metadata"""
    print(f"\nSaving model to: {output_dir}")
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Save Keras H5 model
    h5_path = os.path.join(output_dir, 'fraud_detection_model.h5')
    model.save(h5_path)
    print(f"  ✓ Saved Keras model: {h5_path}")
    
    # Save model_config.json
    version = datetime.now().strftime('%Y%m%d_%H%M%S')
    model_config = {
        'feature_columns': feature_columns,
        'input_shape': [len(feature_columns), 1],  # ← ADD THIS
        'threshold': 0.5,
        'note': 'Input features must be standardized using StandardScaler parameters',
        'required_fields': ['amt', 'hour', 'month', 'dayofweek', 'day', 'category'],
        'version': version,
        'created_at': datetime.now().isoformat(),
        'metrics': {
            'accuracy': metrics['accuracy'],
            'precision': metrics['precision'],
            'recall': metrics['recall'],
            'f1': metrics['f1'],
            'auc': metrics['auc'],
            'training_samples': training_samples,
            'test_samples': test_samples,
        },
        'model_type': 'CNN',
        'is_baseline': False,
    }
    
    config_path = os.path.join(output_dir, 'model_config.json')
    with open(config_path, 'w') as f:
        json.dump(model_config, f, indent=2)
    print(f"  ✓ Saved model config: {config_path}")
    
    return version


def convert_to_tfjs(h5_path: str, tfjs_output_dir: str):
    """Convert Keras H5 model to TensorFlow.js format"""
    print(f"\nConverting to TensorFlow.js...")
    print(f"  Output: {tfjs_output_dir}/")
    
    os.makedirs(tfjs_output_dir, exist_ok=True)
    
    result = subprocess.run(
        [
            'tensorflowjs_converter',
            '--input_format=keras',
            '--output_format=tfjs_layers_model',
            h5_path,
            tfjs_output_dir
        ],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print(f"  ✓ Conversion successful!")
        
        # List generated files
        files = os.listdir(tfjs_output_dir)
        print(f"\n  Generated files:")
        for f in sorted(files):
            file_path = os.path.join(tfjs_output_dir, f)
            size = os.path.getsize(file_path)
            size_kb = size / 1024
            print(f"    - {f} ({size_kb:.2f} KB)")
    else:
        print(f"  ❌ Conversion failed:")
        print(result.stderr)
        raise Exception("TensorFlow.js conversion failed")


def main():
    """Main retraining function"""
    if len(sys.argv) < 4:
        print("Usage: python retrain_model.py <db_path> <output_dir> <current_model_dir>")
        sys.exit(1)
    
    db_path = sys.argv[1]
    output_dir = sys.argv[2]
    current_model_dir = sys.argv[3]  # Current active model directory
    
    print("=" * 80)
    print("FRAUD DETECTION MODEL INCREMENTAL RETRAINING")
    print("=" * 80)
    print()
    
    # DEFINE VARIABLES BEFORE THE TRY BLOCK
    current_model_h5 = os.path.join(current_model_dir, 'fraud_detection_model.h5')
    scaler_path = os.path.join(current_model_dir, 'scaler_params.json')
    model_config_path = os.path.join(output_dir, 'model_config.json') 
    
    # NOW PRINT THEM
    print(f"Current model directory: {current_model_dir}")
    print(f"Current model H5: {current_model_h5}")
    print(f"Scaler params: {scaler_path}")
    print()
    
    try:
        # Check if H5 model exists
        if not os.path.exists(current_model_h5):
            raise FileNotFoundError(
                f"H5 model not found at {current_model_h5}. "
                "Ensure fraud_detection_model.h5 exists in the model directory."
            )
        
        # Load current model metrics (if exists)
        current_metrics = load_current_model_metrics(model_config_path)
        
        # Load data
        df = load_feedback_data(db_path)
        
        # Load scaler
        scaler_params = load_scaler_params(scaler_path)
        
        # Prepare features
        X, y = prepare_features(df, scaler_params)
        
        # Split for evaluation
        from sklearn.model_selection import train_test_split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        print(f"\nTraining samples: {len(X_train)}")
        print(f"Test samples: {len(X_test)}")
        
        # Load base model
        model = load_base_model(current_model_h5)
        
        # Evaluate before retraining
        print("\n" + "=" * 80)
        print("Evaluating BEFORE Retraining")
        print("=" * 80)
        metrics_before = evaluate_model(model, X_test, y_test)
        print(f"  Accuracy:  {metrics_before['accuracy']:.4f}")
        print(f"  Precision: {metrics_before['precision']:.4f}")
        print(f"  Recall:    {metrics_before['recall']:.4f}")
        print(f"  F1:        {metrics_before['f1']:.4f}")
        print(f"  AUC:       {metrics_before['auc']:.4f}")
        
        # Fine-tune model
        print("\n" + "=" * 80)
        print("Fine-Tuning Model")
        print("=" * 80)
        fine_tune_model(model, X_train, y_train, epochs=10, batch_size=4)
        
        # Evaluate after retraining
        print("\n" + "=" * 80)
        print("Evaluating AFTER Retraining")
        print("=" * 80)
        metrics_after = evaluate_model(model, X_test, y_test)
        print(f"  Accuracy:  {metrics_after['accuracy']:.4f}")
        print(f"  Precision: {metrics_after['precision']:.4f}")
        print(f"  Recall:    {metrics_after['recall']:.4f}")
        print(f"  F1:        {metrics_after['f1']:.4f}")
        print(f"  AUC:       {metrics_after['auc']:.4f}")
        
        # Compare with current model
        print("\n" + "=" * 80)
        print("MODEL COMPARISON")
        print("=" * 80)
        
        if current_metrics is not None:
            print(f"Current Accuracy: {current_metrics['accuracy']:.4f}")
            print(f"New Accuracy:     {metrics_after['accuracy']:.4f}")
            
            if metrics_after['accuracy'] < current_metrics['accuracy']:
                print()
                print("❌ NEW MODEL IS NOT BETTER")
                print(f"   New model accuracy ({metrics_after['accuracy']:.4f}) <= Current ({current_metrics['accuracy']:.4f})")
                print("   Aborting - keeping current model")
                print()
                
                result = {
                    'success': False,
                    'error': 'New model accuracy not better than current model',
                    'current_accuracy': current_metrics['accuracy'],
                    'new_accuracy': metrics_after['accuracy'],
                    'metrics': metrics_after
                }
                
                print("RESULT_JSON:", json.dumps(result))
                sys.exit(1)
            else:
                improvement = metrics_after['accuracy'] - current_metrics['accuracy']
                print()
                print(f"✓ NEW MODEL IS BETTER (+{improvement:.4f})")
                print()
        else:
            print("First retraining - no previous model to compare")
            print()
        
        # Save model
        version = save_model(
            model, 
            output_dir, 
            metrics_after,
            len(X_train),
            len(X_test),
            scaler_params['feature_columns']
        )
        
        # Convert to TensorFlow.js
        h5_path = os.path.join(output_dir, 'fraud_detection_model.h5')
        convert_to_tfjs(h5_path, output_dir)
        
        # Copy scaler params to output directory
        import shutil
        output_scaler = os.path.join(output_dir, 'scaler_params.json')

        if os.path.abspath(scaler_path) != os.path.abspath(output_scaler):
            shutil.copy(scaler_path, output_scaler)
            print(f"  ✓ Copied scaler params: {output_scaler}")
        else:
            print(f"  ✓ Scaler params already in output directory")

        
        print()
        print("=" * 80)
        print("RETRAINING COMPLETE")
        print("=" * 80)
        print(f"Model Version: {version}")
        print(f"Accuracy: {metrics_after['accuracy']:.4f}")
        print(f"Output: {output_dir}")
        print()
        
        # Output JSON for TypeScript to parse
        result = {
            'success': True,
            'version': version,
            'metrics': metrics_after,
            'output_dir': output_dir,
            'improvement': metrics_after['accuracy'] - current_metrics['accuracy'] if current_metrics else None
        }
        
        print("RESULT_JSON:", json.dumps(result))
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        result = {
            'success': False,
            'error': str(e)
        }
        print("RESULT_JSON:", json.dumps(result), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()