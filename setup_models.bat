
@echo off
echo ============================================================
echo   KSPTranscribe - Model Setup
echo ============================================================
echo.
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found.
    echo Install Python 3.11 from https://www.python.org/downloads/
    echo Make sure "Add to PATH" is checked during install.
    pause
    exit /b 1
)
echo Installing setup dependencies...
pip install -r requirements-setup.txt
echo.
python setup_models.py
pause