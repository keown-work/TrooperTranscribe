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

:: Set PYTHONPATH so python can always find the 'app' folder
set "PYTHONPATH=%~dp0"

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
    pause
    exit /b 1
)

:: ── Model caching ────────────────────────────────────────────
set "USB_MODELS=%~dp0models"
set "CACHE_ROOT=%LOCALAPPDATA%\TrooperTranscribe"
set "CACHE_MODELS=%CACHE_ROOT%\models"

if not exist "%CACHE_ROOT%" mkdir "%CACHE_ROOT%" 2>nul

:: Check if cache is empty. If so, copy from USB.
if not exist "%CACHE_MODELS%" (
    if exist "%USB_MODELS%" (
        echo Dispatch, show this unit 10-8. We're going to be 10-6 for a few
        echo minutes... copying models to the local cache. This is a one-time
        echo deployment. Hang tight for me.
        echo.
        xcopy /E /I /y /Q "%USB_MODELS%" "%CACHE_MODELS%" >nul 2>&1
        if %errorlevel% equ 0 (
            echo Dispatch, we'll be 98 from setup, everything is 10-2.
        ) else (
            echo WARNING: Could not copy models. Loading from USB drive.
            set "CACHE_MODELS=%USB_MODELS%"
        )
    ) else (
        echo ERROR: Models directory not found on USB!
        pause
        exit /b 1
    )
)

:: Direct the app and HuggingFace to look at the local cache
set "KSP_MODELS_PATH=%CACHE_MODELS%"
set "HF_HOME=%CACHE_MODELS%"
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
echo Models path: %KSP_MODELS_PATH%
echo.

:: ── Dependency check ─────────────────────────────────────────
set "DEPS_OK=1"
"%PYTHON%" -c "import fastapi, faster_whisper, uvicorn, docx, reportlab" >nul 2>&1
if %errorlevel% neq 0 set "DEPS_OK=0"

if "%DEPS_OK%"=="0" (
    echo Dependencies missing. Installing to portable environment...
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

start "" cmd /c "timeout /t 3 >nul 2>&1 && start http://localhost:8765"
"%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8765

echo.
echo Server stopped.
pause