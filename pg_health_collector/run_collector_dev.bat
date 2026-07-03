@echo off
setlocal

REM Always start from this BAT file directory (project root).
cd /d "%~dp0"

REM Update this if your venv folder has different name/location.
set "VENV_DIR=.venv"

if exist "%VENV_DIR%\Scripts\activate.bat" (
    call "%VENV_DIR%\Scripts\activate.bat"
) else (
    echo [WARN] Virtual environment not found at "%VENV_DIR%".
    echo [WARN] Running with system Python.
)

python -m app.main
set "EXIT_CODE=%ERRORLEVEL%"

endlocal & exit /b %EXIT_CODE%
