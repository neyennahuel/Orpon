@echo off
setlocal

title Orpon Descartables
cd /d "%~dp0"

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
  echo.
  echo Revisar .env y configurar DATABASE_URL con el PostgreSQL del servidor.
  echo Despues ejecutar este BAT de nuevo.
  pause
  exit /b 1
)

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
