@echo off
set STORAGE_MODE=database
set STORAGE_DRIVER=mysql
if "%DB_HOST%"=="" set DB_HOST=127.0.0.1
if "%DB_PORT%"=="" set DB_PORT=3306
if "%DB_DATABASE%"=="" set DB_DATABASE=pm
if "%DB_USERNAME%"=="" set DB_USERNAME=root
call "%~dp0php.cmd" -S 127.0.0.1:8000 -t "%~dp0backend\public" "%~dp0backend\public\index.php"