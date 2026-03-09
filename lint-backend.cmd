@echo off
for /R "%~dp0backend" %%f in (*.php) do call "%~dp0php.cmd" -l "%%f"