@echo off
call "%~dp0php.cmd" -S 127.0.0.1:8000 -t "%~dp0backend\public" "%~dp0backend\public\index.php"