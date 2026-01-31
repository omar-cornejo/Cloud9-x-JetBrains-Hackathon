# Atom.gg - League of Legends Draft Assistant

Atom.gg is an advanced League of Legends esports analysis platform and draft assistant. It combines a modern desktop application with a sophisticated Machine Learning engine to provide real-time drafting recommendations.

## Project Structure

This repository is organized into four main components:

### 1. [Atom.gg](./Atom.gg) (Desktop Application)
The core user interface, built using **Tauri**, **React**, and **TypeScript**. 
- **Frontend**: A responsive dashboard for draft simulation.
- **Inference Engine**: Integrates with a local Python-based ML server to provide real-time win-probability predictions and champion recommendations during the drafting phase.
- **Cross-Platform**: Designed to run as a native desktop application.

### 2. [ML](./ML) (Machine Learning Development)
The laboratory where the "Draft Oracle" was born.
- **Notebooks**: Contains Jupyter notebooks (`Jupiters/`) used for data exploration, feature engineering, and training the XGBoost models.
- **Model Artifacts**: Stores the trained model (`draft_oracle_brain_v12_final.json`) and feature mapping configurations.
- **Embeddings**: Includes scripts for generating professional player signatures and champion synergy matrices using advanced vector representations.

### 3. [Scripts](./scripts) (Data Pipeline)
A collection of Python utilities designed to fetch and process data from the **GRID API**.
- **Syncing**: Tools to synchronize teams, rosters, and tournament data directly from GRID's GraphQL API.
- **Processing**: Scripts to parse raw game JSON files into a structured SQLite database (`esports_data.db`).
- **Automation**: Includes tasks for downloading team logos and maintaining data integrity.
- *Detailed documentation for these scripts can be found in [scripts/README.md](./scripts/README.md).*

### 4. [Docs](./doc) (Project Documentation)
Comprehensive technical documentation regarding the project's architecture, data models, and ML approach.
- Available in both **LaTeX** source and **PDF** formats.
- Covers the theoretical background of the draft analysis and the system's implementation details.

---
Developed as part of the Cloud9 x JetBrains Hackathon.

Created by:
- Andres Lucian Laptes Costan
- Omar Antonio Cornejo Vargas
- Dídac Dalmases Valcàrcel
- Rubén Palà Vacas

Computer Engineering students from the Universitat Politècnica de Catalunya (UPC)

<p align="left">
  <img src="logo-upc.png" alt="UPC" width="150"/>
  <img src="logo-fiblletres-upc-color.svg" alt="FIB" width="450"/>
</p>
