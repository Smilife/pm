@echo off
setlocal
if exist "%~dp0tools\php-8.3.29\php.exe" (
  "%~dp0tools\php-8.3.29\php.exe" %*
  exit /b %errorlevel%
)
php %*