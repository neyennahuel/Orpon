# Orpon Descartables

Sistema web de gestion comercial para productos descartables, listas de precios, importacion de Excel, stock manual y APIs REST preparadas para una futura web de ventas.

## Stack

- Next.js App Router
- React
- API REST con route handlers
- PostgreSQL
- Prisma ORM
- Excel: `xlsx`
- PDF: `jspdf` y `jspdf-autotable`
- PWA: `manifest.json` y service worker simple

## Requisitos

- Node.js 20 o superior
- PostgreSQL
- npm

## Configuracion

1. Crear la base en PostgreSQL:

```sql
CREATE DATABASE orpon_descartables;
```

2. Crear `.env` desde el ejemplo:

```bash
cp .env.example .env
```

3. Ajustar `DATABASE_URL`:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/orpon_descartables?schema=public"
```

4. Instalar dependencias:

```bash
npm install
```

5. Ejecutar migraciones y generar Prisma Client:

```bash
npm run prisma:migrate
npm run prisma:generate
```

6. Levantar en desarrollo:

```bash
npm run dev
```

Abrir `http://localhost:3000`.

## Modulos

- Base: importa Excel normalizado y permite descargar plantilla.
- Costos: analiza Excel flexible de proveedores, previsualiza cambios y confirma actualizaciones.
- Porcentajes: guarda porcentajes globales para mayorista, minorista y dos promocionales.
- Lista: consulta precios calculados, filtra y exporta Excel/PDF seleccionando columnas.
- Stock: registra entradas, salidas y ajustes con historial.
- Productos: alta/actualizacion basica por codigo.

## Excel base

Columnas obligatorias:

- `codigo_producto`
- `descripcion`
- `categoria`

La carga base ignora cualquier otra columna del Excel. Esto permite pegar datos completos desde archivos de proveedores sin que el sistema los tome en cuenta en este modulo.

La carga base no actualiza costos. Los productos nuevos se crean con costo `0` y proveedor `Sin proveedor`; los precios se actualizan desde el modulo de costos.

## APIs REST

Productos:

- `GET /api/products`
- `POST /api/products`
- `GET /api/products/:id`
- `PUT /api/products/:id`
- `GET /api/products/code/:codigo`
- `GET /api/categories`
- `GET /api/providers`

Precios:

- `GET /api/prices`
- `GET /api/prices/:productId`
- `GET /api/public/products-with-prices`

Stock:

- `GET /api/stock`
- `GET /api/stock/:productId`
- `GET /api/stock/movements`
- `POST /api/stock/movements`
- `GET /api/public/products-stock`

Importaciones:

- `GET /api/imports/template`
- `POST /api/imports/base`
- `POST /api/imports/cost-preview`
- `POST /api/imports/cost-confirm`
- `GET /api/cost-history`

Los endpoints publicos no exponen precio de costo.

## PWA y logo

La app incluye manifest y service worker. No se coloco un logo inventado en la interfaz; `public/icon.svg` es solo un icono tecnico temporal para PWA. Cuando este el logo definitivo, colocarlo en `public/` y actualizar la cabecera y los iconos del manifest.

## Produccion

```bash
npm run build
npm run start
```

Verificar que `DATABASE_URL` apunte a PostgreSQL de produccion antes de correr migraciones.

## GitHub Pages

GitHub Pages solo puede servir archivos estaticos. La URL `https://neyennahuel.github.io/Orpon/` puede mostrar la interfaz exportada, pero no puede ejecutar las APIs REST ni conectarse a PostgreSQL. Para usar el sistema completo hace falta desplegarlo en un hosting Node.js con base PostgreSQL, por ejemplo Vercel + Neon/Supabase/Railway.
