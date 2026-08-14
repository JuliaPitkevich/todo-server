# Server — Todo API

## Stack
- Node.js + Express 5
- MongoDB Atlas (via `mongodb` driver, no Mongoose)
- JWT auth (`jsonwebtoken` + `bcryptjs`)
- Swagger UI (`swagger-jsdoc` + `swagger-ui-express`)
- Sentry for error tracking

## Commands
- `npm run dev` — dev server with nodemon (port 5000)
- `npm start` — production server

## Environment
Copy `.env.example` → `.env`. Required vars:
- `PORT` (default 5000)
- `JWT_SECRET`
- `MONGODB_URI` — standard connection string (not `mongodb+srv://`, SRV fails on some Windows DNS setups)
- `MONGODB_DB_NAME` (default `lection_db`)
- `SENTRY_DSN`

## Architecture
```
index.js       — Express app, all routes, auth middleware
db.js          — MongoDB connection, collection getters
validators.js  — express-validator rules + handleValidationErrors
swagger.js     — OpenAPI spec generation
instrument.js  — Sentry init
```

## Routes

### Frontend-compatible routes (todo-redux-rtk)
- `POST /auth/register` → `{ access_token }`
- `POST /auth/login` → `{ access_token }`
- `GET /auth/me` → `{ name, email }`
- `GET /todos` → `{ data: [...] }` (supports `?completed=true/false`)
- `POST /todos` → task object directly (body: `{ title, description }`)
- `GET/PATCH/DELETE /todos/:id`
- `PATCH /todos/:id/toggle`

### Legacy routes (original API)
- `POST /registration` → `{ id, name, email }`
- `POST /login` → `{ token }`
- `GET /tasks` → array of tasks (supports `?completed=true/false`)
- `POST /tasks` → `{ message, task }`
- `GET/PUT/PATCH/DELETE /tasks/:id`

## Key conventions
- `formatTask()` converts `_id` → `id` (string) for frontend routes
- Legacy routes keep their original response shapes
- `auth` middleware extracts user from JWT, sets `req.user.id` / `req.user.email`
- All auth errors use `message` key (not `error`) so frontend can read them
- Task ownership enforced via `userId` field matching `req.user.id`
- Validation errors return `{ message, errors: [...] }`
- `dotenv.config({ override: true })` — .env file overrides system env vars (needed because system MONGODB_URI can be stale)
- `completed` query param stays as string (`'true'`/`'false'`), no `.toBoolean()` — route handlers use `=== 'true'` comparison
- MongoClient has `serverSelectionTimeoutMS` and `connectTimeoutMS` set to 10s
