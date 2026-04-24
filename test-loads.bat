@echo off
echo Checking if CSS loads:
curl -s http://localhost:5174/assets/index-DalEiq_R.css > nul
if %errorlevel%==0 echo CSS loads OK
echo.
echo Checking JS:
curl -s http://localhost:5174/assets/index-C9lqVppP.js > nul
if %errorlevel%==0 echo JS loads OK