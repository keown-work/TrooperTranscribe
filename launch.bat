@echo off
setlocal enabledelayedexpansion

echo.
echo  ============================================================
echo   KENTUCKY STATE POLICE  ^|  KSPTranscribe
echo   The Thin Gray Line  ^|  Established 1948
echo  ============================================================
echo.

:: Change to the directory containing this batch file
cd /d "%~dp0"

:: ── Python detection ────────────────────────────────────────
:: Use portable Python on the drive if present, else system Python
set "PORTABLE_PYTHON=%~dp0python\python.exe"
if exist "%PORTABLE_PYTHON%" (
    set "PYTHON=%PORTABLE_PYTHON%"
    echo Using portable Python: %PORTABLE_PYTHON%
) else (
    set "PYTHON=python"
    echo Using system Python.
)

:: Verify Python is available
"%PYTHON%" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Python not found.
    echo Install Python 3.11+ from https://www.python.org/downloads/
    echo Make sure "Add to PATH" is checked during installation.
    echo.
    pause
    exit /b 1
)

:: ── Model caching ────────────────────────────────────────────
set "USB_MODELS=%~dp0models"
set "CACHE_ROOT=%LOCALAPPDATA%\KSPTranscribe"
set "CACHE_MODELS=%CACHE_ROOT%\models"

if not exist "%CACHE_ROOT%" mkdir "%CACHE_ROOT%" 2>nul

:: First-run: copy models from USB to local cache
if not exist "%CACHE_MODELS%\whisper" (
    if exist "%USB_MODELS%\whisper" (
        echo First run on this machine. Copying models to local cache...
        echo This takes a few minutes but only happens once per machine.
        xcopy /E /I /Q "%USB_MODELS%" "%CACHE_MODELS%" >nul 2>&1
        if %errorlevel% equ 0 (
            echo Models cached to %CACHE_MODELS%
        ) else (
            echo WARNING: Could not copy models. Loading from USB drive.
            set "CACHE_MODELS=%USB_MODELS%"
        )
    ) else (
        :: Models not yet downloaded — point to USB models dir anyway
        set "CACHE_MODELS=%USB_MODELS%"
    )
)

:: Set environment variables for the app
set "KSP_MODELS_PATH=%CACHE_MODELS%"
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"

echo Models path: %KSP_MODELS_PATH%
echo.

:: ── Check dependencies ───────────────────────────────────────
"%PYTHON%" -c "import fastapi, faster_whisper, pyannote.audio" >nul 2>&1
if %errorlevel% neq 0 (
    echo Dependencies not installed. Installing now...
    "%PYTHON%" -m pip install -r requirements.txt --quiet
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies.
        pause
        exit /b 1
    )
    echo Dependencies installed.
    echo.
)

:: ── Launch ───────────────────────────────────────────────────
echo Starting KSPTranscribe on http://localhost:8765
echo.
echo Press Ctrl+C to stop the server.
echo.

:: Open browser after 2 second delay
start "" cmd /c "timeout /t 2 >nul 2>&1 && start http://localhost:8765"

:: Start the FastAPI server
"%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8765

echo.
echo Server stopped.
pause
