@echo off
echo Setting up Reports System...

REM Install dependencies
echo Installing dependencies...
call npm install bull

REM Create temp-reports directory
echo Creating temp-reports directory...
if not exist "temp-reports" mkdir temp-reports

REM Run migration
echo Running database migration...
call npm run migration:run

echo.
echo ✅ Reports system setup complete!
echo.
echo Next steps:
echo 1. Ensure Redis is running (required for Bull queue)
echo 2. Start your application: npm run start:dev
echo 3. Test the reports API endpoints
echo.
echo Documentation: See REPORTS_API_DOCUMENTATION.md
pause
