# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

block_cipher = None

xb_datas, xb_binaries, xb_hiddenimports = collect_all('xgboost')

datas = [
    ('draft_oracle.py', '.'),
    ('draft_oracle_brain_v12_final.json', '.'),
    ('draft_oracle_feature_store.parquet', '.'),
    ('draft_oracle_pro_signatures.parquet', '.'),
    ('draft_oracle_tournament_meta.parquet', '.'),
    ('draft_oracle_synergy_matrix.parquet', '.'),
    ('model_features_v12.json','.'),
    ('../src-tauri/src/esports_data.db', '.'),
]

datas += xb_datas

hiddenimports = [
    'polars',
    'polars.internals',
    'numpy',
    'pandas',
    'pyarrow',
    'pyarrow.parquet',
] + xb_hiddenimports

a = Analysis(
    ['ml_server.py'],
    pathex=[],
    binaries=xb_binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'IPython', 'jupyter', 'tkinter'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ml_server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)