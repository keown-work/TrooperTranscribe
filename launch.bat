@echo off
:: Copyright (c) 2026 Casey Keown. All rights reserved. Proprietary and confidential.
setlocal enabledelayedexpansion
echo.
echo  ============================================================
echo   TROOPER TRANSCRIBE
echo   Reports at the Speed of Sound  ^|  Established 2026
echo  ============================================================
echo.

:: Change to the directory containing this batch file
cd /d "%~dp0"

:: ── Python detection ────────────────────────────────────────
set "PORTABLE_PYTHON=%~dp0python\python.exe"
if exist "%PORTABLE_PYTHON%" (
    set "PYTHON=%PORTABLE_PYTHON%"
    echo Using portable Python: %PORTABLE_PYTHON%
) else (
    set "PYTHON=python"
    echo Using system Python.
)

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
set "CACHE_ROOT=%LOCALAPPDATA%\TrooperTranscribe"
set "CACHE_MODELS=%CACHE_ROOT%\models"

if not exist "%CACHE_ROOT%" mkdir "%CACHE_ROOT%" 2>nul

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
        set "CACHE_MODELS=%USB_MODELS%"
    )
)

set "KSP_MODELS_PATH=%CACHE_MODELS%"
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
echo Models path: %KSP_MODELS_PATH%
echo.

:: ── Dependency check ─────────────────────────────────────────
:: Check each package individually to avoid pyannote import-time warnings
:: triggering a false failure on the combined import check.
set "DEPS_OK=1"

"%PYTHON%" -c "import fastapi" >nul 2>&1
if %errorlevel% neq 0 set "DEPS_OK=0"

"%PYTHON%" -c "import faster_whisper" >nul 2>&1
if %errorlevel% neq 0 set "DEPS_OK=0"

"%PYTHON%" -c "import uvicorn" >nul 2>&1
if %errorlevel% neq 0 set "DEPS_OK=0"

"%PYTHON%" -c "import docx" >nul 2>&1
if %errorlevel% neq 0 set "DEPS_OK=0"

"%PYTHON%" -c "import reportlab" >nul 2>&1
if %errorlevel% neq 0 set "DEPS_OK=0"

if "%DEPS_OK%"=="0" (
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
echo Starting Trooper Transcribe on http://localhost:8765
echo.
echo Press Ctrl+C to stop the server.
echo.

start "" cmd /c "timeout /t 2 >nul 2>&1 && start http://localhost:8765"
"%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8765

echo.
echo Server stopped.
pause