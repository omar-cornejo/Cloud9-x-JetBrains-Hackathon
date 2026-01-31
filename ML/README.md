# Machine Learning Module - Draft Oracle

This directory contains the entire artificial intelligence test ecosystem for Atom.gg's **Draft Oracle**. The primary objective is to predict the win probability of a team composition in League of Legends based on historical professional and high-level match data.

## Directory Structure

- **`bd/`**: Contains the SQLite database (`esports_data.db`) with raw and semi-processed esports match data.
- **`Jupiters/`**: The laboratory for experimentation and processing. Contains Jupyter notebooks used for data exploration, feature engineering, and training the XGBoost models.
- **`utility/`**: Stores trained models, feature configuration files, and the best found hyperparameters.

## Data Pipeline and Training

The workflow is divided into several stages represented by the notebooks in `Jupiters/`:

1. **ETL and Preparation (`PaquetGenerator.ipynb`)**:
    - Extracts data from JSON files (ZIPs from different regions: EUW, KR, NA).
    - Cleans and transforms data into Parquet files (`draft_oracle_master_data.parquet`) optimized for fast reading with Polars.

2. **Feature Engineering and Embeddings (`GenerateEmmbedings.ipynb` and `GenerateProEmbeddings.ipynb`)**:
    - **Champion DNA**: Calculates specific metrics per champion, position, and region (Winrate, DPM, GPM, volatility, etc.).
    - **Player Signatures**: Includes scripts for generating professional player signatures using advanced vector representations.
    - **Playstyles**: Defines metrics such as `style_lane_dominance`, `style_roaming_tendency`, and `style_objective_control`.
    - **Synergy Matrix**: Analyzes the performance of key pairs (Mid-Jungle, Bot-Support, Top-Jungle) when playing together.

3. **Tournament Meta (`GenerateTournamentMeta.ipynb`)**:
    - Analyzes specific patch and current tournament trends to adjust predictions to the competitive meta.

4. **Model Training (`MachineLearning.ipynb` and `MachineLearning2.ipynb`)**:
    - Uses **XGBoost** to train the Oracle's "brain".
    - Implements advanced combat logic (Damage Profiles: Magic vs. Physical, Tankiness, Sustain, and Shred Efficiency).
    - Pivots data to a *Wide* format so the model sees all 10 champions simultaneously.

5. **Evaluation (`Testing.ipynb`)**:
    - Accuracy tests, ROC-AUC, and validation with unseen data.

## Technologies Used

- **Polars**: Ultra-fast data processing (replacing Pandas).
- **XGBoost**: Gradient Boosting algorithm for classification/prediction.
- **SQLite**: Persistent storage for esports data.
- **Jupyter Notebooks**: Interactive development environment.
- **Orjson**: High-speed JSON serialization.

---
*Developed for the Cloud9 x JetBrains Hackathon.*
