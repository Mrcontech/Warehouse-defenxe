@echo off
rem Run the EBSU data warehouse demo. Start MySQL in the XAMPP Control Panel first.
cd /d "%~dp0"
node scripts\start.mjs %*
pause
