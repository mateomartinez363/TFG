# TFG Mateo - El Naranjo

MVP de e-commerce con Flask, PostgreSQL y RAG para una tienda de alimentacion natural.

## Requisitos

- Python 3.11 o superior
- Docker y Docker Compose
- Una API key de OpenAI solo si se quiere probar la parte RAG (`/api/query`)

## Estructura basica

- `app/`: aplicacion Flask
- `migrations/`: migraciones de base de datos con Flask-Migrate
- `scripts/seed_data.py`: carga datos de ejemplo
- `scripts/build_semantic_chunks.py`: genera los fragmentos semanticos
- `scripts/generate_embeddings.py`: genera embeddings con OpenAI

## 1. Clonar y entrar al proyecto

```bash
git clone https://github.com/mateomartinez363/TFG.git
cd TFG
```

## 2. Crear entorno virtual e instalar dependencias

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .
```

## 3. Configurar variables de entorno

Crear el archivo `.env` a partir del ejemplo:

```bash
cp .env.example .env
```

Configuracion minima recomendada:

```env
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=change-me
POSTGRES_DB=elnaranjo
POSTGRES_USER=elnaranjo
POSTGRES_PASSWORD=elnaranjo
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
DATABASE_URL=postgresql+psycopg://elnaranjo:elnaranjo@localhost:5433/elnaranjo
OPENAI_API_KEY=replace-me
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
RESPONSE_MODEL=gpt-4.1-mini
```

Notas:

- La aplicacion puede arrancar sin una API key real.
- La ruta `/api/query` y la generacion de embeddings requieren una `OPENAI_API_KEY` valida.
- La `OPENAI_API_KEY` no esta incluida en este repositorio. Para la evaluacion, se facilita por correo y debe copiarse manualmente en el archivo `.env`.

## 4. Levantar PostgreSQL con Docker

```bash
docker compose up -d
```

La base se expone en `localhost:5433`.

## 5. Ejecutar migraciones

```bash
flask --app run.py db upgrade
```

## 6. Arrancar la aplicacion

```bash
python run.py
```

La aplicacion queda disponible en:

- Web: `http://127.0.0.1:5000/`
- Healthcheck: `http://127.0.0.1:5000/api/health`

## 7. Cargar datos de ejemplo

Si se quiere poblar la base con catalogo, clientes, pedidos y stock:

```bash
python scripts/seed_data.py
```

## 8. Preparar la parte RAG

Primero generar los fragmentos semanticos:

```bash
python scripts/build_semantic_chunks.py
```

Despues generar embeddings:

```bash
python scripts/generate_embeddings.py
```

Si ya existian embeddings y se quieren recalcular:

```bash
python scripts/generate_embeddings.py --force
```

## 9. Probar la API RAG

Antes de este paso, hay que sustituir `OPENAI_API_KEY=replace-me` en `.env` por la API key recibida por correo.

Ejemplo de consulta:

```bash
curl -X POST http://127.0.0.1:5000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"Que productos veganos y sin gluten hay para desayunar?","top_k":5}'
```

## Flujo minimo para evaluacion

Si solo se quiere arrancar el proyecto y comprobar que funciona:

1. `cp .env.example .env`
2. `docker compose up -d`
3. `flask --app run.py db upgrade`
4. `python run.py`
5. Abrir `http://127.0.0.1:5000/`

Si ademas se quiere probar con datos:

1. `python scripts/seed_data.py`
2. Recargar la pagina o consultar la base

Si ademas se quiere probar RAG:

1. Copiar en `.env` la `OPENAI_API_KEY` recibida por correo
2. `python scripts/build_semantic_chunks.py`
3. `python scripts/generate_embeddings.py`
4. Probar `POST /api/query`

## Apagar servicios

Para detener PostgreSQL:

```bash
docker compose down
```
