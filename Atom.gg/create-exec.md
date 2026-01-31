# Build Guide: Python ML Server + Tauri App

Follow these steps in order to create your final executable.

## 1. Setup Python Environment
Open your terminal in the `python-ml` folder (where `ml_server.py` is).

1.  **Activate your virtual environment**:
    ```powershell
    # Windows
    .\.venv\Scripts\Activate
    ```
2.  **Install requirements and PyInstaller**:
    ```powershell
    pip install -r requirements-venv.txt
    pip install pyinstaller
    ```

## 2. Build the ML Executable
Still in the `python-ml` folder:

1.  **Run PyInstaller** (using your updated `.spec` file):
    ```powershell
    pyinstaller ml_server.spec --clean --noconfirm
    ```
## 3. Build the Tauri App
Still in the `atom.gg` folder:
```powershell
npm run tauri build
```

