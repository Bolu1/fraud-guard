#!/usr/bin/env node

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

console.log('='.repeat(80));
console.log('FRAUD GUARD - PYTHON ENVIRONMENT SETUP');
console.log('='.repeat(80));
console.log('');

async function checkPython(): Promise<string> {
  console.log('Checking Python installation...');
  
  // Try python3 first
  try {
    const check = spawn('python3', ['--version']);
    
    const result = await new Promise<string>((resolve, reject) => {
      let output = '';
      
      check.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      check.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      check.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error('python3 not found'));
        }
      });
    });
    
    console.log(`✓ Found Python: ${result}`);
    console.log('');
    return 'python3';
  } catch {
    // Try python
    try {
      const check = spawn('python', ['--version']);
      
      const result = await new Promise<string>((resolve, reject) => {
        let output = '';
        
        check.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        check.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        check.on('close', (code) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error('python not found'));
          }
        });
      });
      
      console.log(`✓ Found Python: ${result}`);
      console.log('');
      return 'python';
    } catch {
      throw new Error(`
Python 3 not found!

Please install Python 3.8 or higher:
  - macOS: brew install python3
  - Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip
  - Windows: Download from https://www.python.org/downloads/
      `);
    }
  }
}

async function setupVenv() {
  try {
    const pythonCmd = await checkPython();
    
    console.log('Creating virtual environment...');
    
    // Create venv in project root
    const venvPath = path.join(process.cwd(), '.fraud-guard-venv');
    
    if (fs.existsSync(venvPath)) {
      console.log('⚠️  Virtual environment already exists');
      console.log(`   Location: ${venvPath}`);
      console.log('');
      console.log('Reinstalling dependencies...');
      console.log('');
    } else {
      const createVenv = spawn(pythonCmd, ['-m', 'venv', venvPath]);
      
      await new Promise<void>((resolve, reject) => {
        createVenv.on('close', (code) => {
          if (code === 0) {
            console.log(`✓ Virtual environment created`);
            console.log(`  Location: ${venvPath}`);
            console.log('');
            resolve();
          } else {
            reject(new Error(`
Failed to create virtual environment.

On Ubuntu/Debian, you may need:
  sudo apt install python3-venv

On other systems, ensure Python 3.8+ is properly installed.
            `));
          }
        });
      });
    }
    
    console.log('Installing Python dependencies...');
    console.log('This may take a minute...');
    console.log('');
    
    const venvPython = path.join(
      venvPath,
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
    );
    
    const requirementsPath = path.join(
      __dirname,
      '../../scripts/requirements.txt'
    );
    
    const installDeps = spawn(
      venvPython,
      ['-m', 'pip', 'install', '--upgrade', 'pip'],
      { stdio: 'inherit' }
    );
    
    await new Promise<void>((resolve, reject) => {
      installDeps.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Failed to upgrade pip'));
        }
      });
    });
    
    const installReqs = spawn(
      venvPython,
      ['-m', 'pip', 'install', '-r', requirementsPath],
      { stdio: 'inherit' }
    );
    
    await new Promise<void>((resolve, reject) => {
      installReqs.on('close', (code) => {
        if (code === 0) {
          console.log('');
          console.log('✓ Dependencies installed');
          console.log('');
          resolve();
        } else {
          reject(new Error('Failed to install dependencies'));
        }
      });
    });
    
    console.log('='.repeat(80));
    console.log('✅ SETUP COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Python environment ready for retraining!');
    console.log(`Location: ${venvPath}`);
    console.log('');
    console.log('Installed packages:');
    console.log('  - numpy==1.24.3');
    console.log('  - pandas==2.0.3');
    console.log('  - scikit-learn==1.3.0');
    console.log('  - joblib==1.3.2');
    console.log('');
    console.log('You can now use:');
    console.log('  await guard.retrain()');
    console.log('');
    
    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('='.repeat(80));
    console.error('❌ SETUP FAILED');
    console.error('='.repeat(80));
    console.error('');
    console.error(error.message);
    console.error('');
    process.exit(1);
  }
}

setupVenv();