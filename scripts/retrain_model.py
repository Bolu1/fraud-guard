#!/usr/bin/env python3
"""
Fraud Detection Model Retraining Script

This script retrains the fraud detection model using feedback data
from the SQLite database.
"""

import sys
import json
import sqlite3
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score
)
import joblib
import warnings

warnings.filterwarnings('ignore')


def load_current_model_metrics(output_dir: str) -> dict:
    """Load current model metrics from metadata.json"""
    metadata_path = Path(output_dir) / 'metadata.json'
    
    if not metadata_path.exists():
        print("No existing model found - this is first training")
        return None
    
    try:
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        print(f"Current model version: {metadata.get('version', 'unknown')}")
        print(f"Current model accuracy: {metadata['metrics']['accuracy']:.4f}")
        
        return metadata['metrics']
    except Exception as e:
        print(f"Warning: Could not load current model metrics: {e}")
        return None


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


def prepare_features(df: pd.DataFrame) -> tuple:
    """Prepare features and labels"""
    print("Preparing features...")
    
    # One-hot encode category
    category_dummies = pd.get_dummies(df['category'], prefix='category')
    
    # Combine features
    feature_cols = ['amt', 'hour', 'month', 'dayofweek', 'day']
    X = pd.concat([df[feature_cols], category_dummies], axis=1)
    y = df['actual_fraud']
    
    print(f"Features shape: {X.shape}")
    print(f"Class distribution: Fraud={y.sum()}, Legitimate={len(y)-y.sum()}")
    
    return X, y


def train_model(X: pd.DataFrame, y: pd.Series, test_size: float = 0.2) -> dict:
    """Train Random Forest model"""
    print("Training model...")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )
    
    print(f"Training set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # Train model
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        class_weight='balanced',
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    metrics = {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred)),
        'recall': float(recall_score(y_test, y_pred)),
        'f1': float(f1_score(y_test, y_pred)),
        'auc': float(roc_auc_score(y_test, y_prob)),
        'training_samples': int(len(X_train)),
        'test_samples': int(len(X_test)),
    }
    
    print("\nModel Performance:")
    print(f"  Accuracy:  {metrics['accuracy']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  F1 Score:  {metrics['f1']:.4f}")
    print(f"  AUC:       {metrics['auc']:.4f}")
    
    return model, metrics, X.columns.tolist()


def calculate_scaler_params(X: pd.DataFrame) -> dict:
    """Calculate mean and std for standardization"""
    print("Calculating scaler parameters...")
    
    scaler_params = {
        'mean': {k: float(v) for k, v in X.mean().to_dict().items()},
        'std': {k: float(v) for k, v in X.std().to_dict().items()}
    }
    
    return scaler_params


def save_model(model, scaler_params: dict, feature_names: list, 
               output_dir: str, metrics: dict) -> str:
    """Save model and parameters"""
    print(f"Saving model to: {output_dir}")
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Save sklearn model
    model_path = output_path / 'model.pkl'
    joblib.dump(model, model_path)
    print(f"  ✓ Saved model: {model_path}")
    
    # Save scaler parameters
    scaler_path = output_path / 'scaler_params.json'
    with open(scaler_path, 'w') as f:
        json.dump(scaler_params, f, indent=2)
    print(f"  ✓ Saved scaler: {scaler_path}")
    
    # Save feature names
    features_path = output_path / 'feature_names.json'
    with open(features_path, 'w') as f:
        json.dump(feature_names, f, indent=2)
    print(f"  ✓ Saved features: {features_path}")
    
    # Save metadata
    version = datetime.now().strftime('%Y%m%d_%H%M%S')
    metadata = {
        'version': version,
        'created_at': datetime.now().isoformat(),
        'metrics': metrics,
        'feature_count': len(feature_names),
        'model_type': 'RandomForestClassifier'
    }
    
    metadata_path = output_path / 'metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"  ✓ Saved metadata: {metadata_path}")
    
    return version


def main():
    """Main retraining function"""
    if len(sys.argv) < 3:
        print("Usage: python retrain_model.py <db_path> <output_dir>")
        sys.exit(1)
    
    db_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    print("=" * 80)
    print("FRAUD DETECTION MODEL RETRAINING")
    print("=" * 80)
    print()
    
    try:
        # Load current model metrics (if exists)
        current_metrics = load_current_model_metrics(output_dir)
        
        # Load data
        df = load_feedback_data(db_path)
        
        # Prepare features
        X, y = prepare_features(df)
        
        # Train model
        model, new_metrics, feature_names = train_model(X, y)
        
        # Compare with current model
        if current_metrics is not None:
            print()
            print("=" * 80)
            print("MODEL COMPARISON")
            print("=" * 80)
            print(f"Current Accuracy: {current_metrics['accuracy']:.4f}")
            print(f"New Accuracy:     {new_metrics['accuracy']:.4f}")
            
            if new_metrics['accuracy'] <= current_metrics['accuracy']:
                print()
                print("❌ NEW MODEL IS NOT BETTER")
                print(f"   New model accuracy ({new_metrics['accuracy']:.4f}) <= Current ({current_metrics['accuracy']:.4f})")
                print("   Aborting - keeping current model")
                print()
                
                result = {
                    'success': False,
                    'error': 'New model accuracy not better than current model',
                    'current_accuracy': current_metrics['accuracy'],
                    'new_accuracy': new_metrics['accuracy'],
                    'metrics': new_metrics
                }
                
                print("RESULT_JSON:", json.dumps(result))
                sys.exit(1)
            else:
                improvement = new_metrics['accuracy'] - current_metrics['accuracy']
                print()
                print(f"✓ NEW MODEL IS BETTER (+{improvement:.4f})")
                print()
        
        # Calculate scaler parameters
        scaler_params = calculate_scaler_params(X)
        
        # Save model
        version = save_model(model, scaler_params, feature_names, output_dir, new_metrics)
        
        print()
        print("=" * 80)
        print("RETRAINING COMPLETE")
        print("=" * 80)
        print(f"Model Version: {version}")
        print(f"Accuracy: {new_metrics['accuracy']:.4f}")
        print(f"Output: {output_dir}")
        print()
        
        # Output JSON for TypeScript to parse
        result = {
            'success': True,
            'version': version,
            'metrics': new_metrics,
            'output_dir': output_dir,
            'improvement': new_metrics['accuracy'] - current_metrics['accuracy'] if current_metrics else None
        }
        
        print("RESULT_JSON:", json.dumps(result))
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}", file=sys.stderr)
        result = {
            'success': False,
            'error': str(e)
        }
        print("RESULT_JSON:", json.dumps(result), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()