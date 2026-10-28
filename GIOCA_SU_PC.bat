@echo off
rem S98 sul PC: avvia un piccolo server locale e apre il gioco nel browser.
rem Lascia aperta questa finestra nera mentre giochi; chiudila per spegnere il server.
start "" http://127.0.0.1:8765/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0.claude\serve.ps1"
