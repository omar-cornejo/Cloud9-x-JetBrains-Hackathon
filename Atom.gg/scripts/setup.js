import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      windowsVerbatimArguments: false
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function checkPython() {
  try {
    const proc = spawn('python', ['--version'], { stdio: 'pipe' });
    return new Promise((resolve) => {
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  } catch {
    return false;
  }
}

async function checkVenvReady(venvPython) {
  try {
    const proc = spawn(venvPython, ['-c', 'import numpy, polars, xgboost, pandas, pyarrow'], {
      stdio: 'pipe',
      windowsVerbatimArguments: false
    });

    return new Promise((resolve) => {
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  } catch {
    return false;
  }
}

async function setupPythonEnv() {
  console.log('\nChecking Python ML Environment...\n');

  const pythonMlDir = join(__dirname, '..', 'python-ml');
  const venvPath = join(pythonMlDir, '.venv');

  if (!existsSync(pythonMlDir)) {
    console.error('ERROR: python-ml directory not found!');
    console.error('   The ML server is required for this application to run.\n');
    process.exit(1);
  }

  const isWindows = process.platform === 'win32';
  const venvPython = isWindows
    ? join(venvPath, 'Scripts', 'python.exe')
    : join(venvPath, 'bin', 'python');

  // Check if venv exists and has all dependencies installed
  if (existsSync(venvPython)) {
    console.log('Verifying Python dependencies...');
    const isReady = await checkVenvReady(venvPython);

    if (isReady) {
      console.log('Python environment is ready!\n');
      return;
    } else {
      console.log('Virtual environment exists but dependencies are missing or outdated.');
      console.log('   Reinstalling dependencies...\n');
    }
  } else {
    console.log('Virtual environment not found. Setting up...\n');
  }

  // Check if Python is available
  const hasPython = await checkPython();
  if (!hasPython) {
    console.error('ERROR: Python not found on PATH!');
    console.error('   Please install Python 3.10+ from: https://www.python.org/downloads/');
    console.error('   Make sure to check "Add Python to PATH" during installation.\n');
    process.exit(1);
  }

  try {
    // Create or recreate virtual environment
    if (!existsSync(venvPython)) {
      console.log('Creating Python virtual environment...');
      await runCommand('python', ['-m', 'venv', '.venv'], pythonMlDir);
      console.log('Virtual environment created\n');
    }

    // Upgrade pip
    console.log('Upgrading pip...');
    await runCommand(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', '-q'], pythonMlDir);
    console.log('pip upgraded\n');

    // Install requirements
    console.log('Installing Python dependencies (this may take a few minutes)...');
    console.log('   Installing: polars, xgboost, numpy, pandas, pyarrow, requests\n');
    await runCommand(venvPython, ['-m', 'pip', 'install', '-r', 'requirements-venv.txt'], pythonMlDir);
    console.log('\nAll Python dependencies installed successfully!\n');

    // Verify installation
    console.log('Verifying installation...');
    const isReady = await checkVenvReady(venvPython);
    if (!isReady) {
      throw new Error('Verification failed after installation');
    }
    console.log('Verification passed!\n');

  } catch (error) {
    console.error('\nERROR: Failed to set up Python environment!');
    console.error('   Error:', error.message);
    console.error('\nYou can try setting up manually:');
    console.error('  cd Atom.gg/python-ml');
    if (isWindows) {
      console.error('  .\\setup_venv.ps1');
    } else {
      console.error('  python -m venv .venv');
      console.error('  source .venv/bin/activate');
      console.error('  pip install -r requirements-venv.txt');
    }
    console.error('');
    process.exit(1);
  }
}

async function main() {
  try {
    await setupPythonEnv();
    console.log('Environment ready! Starting application...\n');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  }
}

main();
