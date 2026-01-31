# Atom.gg - League of Legends Draft Assistant

A Tauri + React + TypeScript application for League of Legends draft analysis and recommendations.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/tools/install)
- [Python 3.10+](https://www.python.org/downloads/) (for ML features)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/es/visual-cpp-build-tools/) (for Tauri Windows build)

## Quick Start

**First time setup:**

```bash
npm install
npm run setup
```

This will set up the Python virtual environment and install all ML dependencies (numpy, polars, xgboost, pandas, pyarrow).

**Then start the application:**

```bash
npm run tauri dev
```

The setup only needs to be run once. After that, you can directly use `npm run tauri dev` to start the application.

## Project Structure

- `src/` - React frontend code
- `src-tauri/` - Rust backend (Tauri)
- `python-ml/` - Python ML server for draft predictions
- `scripts/` - Setup and utility scripts

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
