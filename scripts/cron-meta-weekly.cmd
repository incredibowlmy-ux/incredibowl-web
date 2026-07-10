@echo off
rem Meta CAPI weekly upload — registered in Task Scheduler as Incredibowl\MetaWeeklyCAPI (Mon 23:00)
cd /d c:\Users\User\.gemini\antigravity\scratch\incredibowl-web
if not exist tasks\logs mkdir tasks\logs
echo. >> tasks\logs\meta-cron.log
echo ===== %date% %time% ===== >> tasks\logs\meta-cron.log
node scripts\meta-capi-upload.mjs --cron >> tasks\logs\meta-cron.log 2>&1
