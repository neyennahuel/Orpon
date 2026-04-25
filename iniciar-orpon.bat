@echo off
setlocal

title Orpon Descartables
cd /d "%~dp0"

set "ORPON_DB_NAME=orpon_descartables"
set "ORPON_DB_USER=postgres"
set "ORPON_DB_PASSWORD=Lolita00+"
set "ORPON_DB_PASSWORD_URL=Lolita00%%2B"
set "ORPON_DB_HOST=localhost"
set "ORPON_DB_PORT=5432"
set "DATABASE_URL=postgresql://%ORPON_DB_USER%:%ORPON_DB_PASSWORD_URL%@%ORPON_DB_HOST%:%ORPON_DB_PORT%/%ORPON_DB_NAME%?schema=public"

echo.
echo ==========================================
echo   Orpon Descartables - servidor local
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en PATH.
  echo Instalar Node.js LTS desde https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm no esta instalado o no esta en PATH.
  pause
  exit /b 1
)

if not exist ".env" (
  echo No existe .env. Creo uno desde .env.example.
  copy ".env.example" ".env" >nul
)

echo DATABASE_URL="%DATABASE_URL%" > ".env"

echo Instalando dependencias...
if exist "package-lock.json" (
  call npm ci
) else (
  call npm install
)
if errorlevel 1 (
  echo ERROR: fallo la instalacion de dependencias.
  pause
  exit /b 1
)

echo.
echo Generando Prisma Client...
call npx prisma generate
if errorlevel 1 (
  echo ERROR: fallo prisma generate.
  pause
  exit /b 1
)

echo.
echo Verificando base PostgreSQL orpon_descartables...
set "PGPASSWORD=%ORPON_DB_PASSWORD%"
set "PSQL_EXE="
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set "PSQL_EXE=C:\Program Files\PostgreSQL\17\bin\psql.exe"
if not defined PSQL_EXE if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set "PSQL_EXE=C:\Program Files\PostgreSQL\16\bin\psql.exe"
if not defined PSQL_EXE if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set "PSQL_EXE=C:\Program Files\PostgreSQL\15\bin\psql.exe"
if not defined PSQL_EXE set "PSQL_EXE=psql"

"%PSQL_EXE%" -U %ORPON_DB_USER% -h %ORPON_DB_HOST% -p %ORPON_DB_PORT% -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '%ORPON_DB_NAME%';" | findstr /C:"1" >nul
if errorlevel 1 (
  echo Creando base %ORPON_DB_NAME%...
  "%PSQL_EXE%" -U %ORPON_DB_USER% -h %ORPON_DB_HOST% -p %ORPON_DB_PORT% -d postgres -c "CREATE DATABASE %ORPON_DB_NAME%;"
  if errorlevel 1 (
    echo ERROR: no se pudo crear la base %ORPON_DB_NAME%.
    pause
    exit /b 1
  )
) else (
  echo Base %ORPON_DB_NAME% encontrada.
)

echo.
echo Aplicando migraciones de PostgreSQL...
call npx prisma migrate deploy
if errorlevel 1 (
  echo ERROR: fallo la migracion. Revisar DATABASE_URL, PostgreSQL y permisos.
  pause
  exit /b 1
)

echo.
echo Compilando aplicacion...
call npm run build
if errorlevel 1 (
  echo ERROR: fallo el build.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   Aplicacion lista
echo   Local:  http://localhost:3005
echo   Dominio: https://orpon.swhittall.com.ar
echo ==========================================
echo.
echo Para usar el dominio, apuntar DNS/proxy del servidor a este equipo en el puerto 3005.
echo No cerrar esta ventana mientras se use el sistema.
echo.

set PORT=3005
set HOSTNAME=0.0.0.0
call npm run start:3005

pause
