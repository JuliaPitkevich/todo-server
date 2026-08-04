require('dotenv').config();
const Sentry = require("./instrument.js");
const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const cors = require('cors');
const { randomUUID } = require("crypto");
const { ObjectId } = require('mongodb');

const {
  connectToDatabase,
  getUsersCollection,
  getTasksCollection,
  closeDatabaseConnection
} = require('./db');

const {
  validateCreateTask,
  validateReplaceTask,
  validatePatchTask,
  validateGetTask,
  validateDeleteTask,
  validateGetTasks,
  validateRegistration,
  validateLogin,
  handleValidationErrors,
} = require("./validators");

const app = express();
app.use(Sentry.Handlers.requestHandler());
app.use(express.json());


app.use(cors());


app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
console.log("Swagger docs available at http://localhost:5000/api-docs");

const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET;


app.get('/', (req, res) => {
  res.json({
    message: 'Todo API is running!',
    server: process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`,
    endpoints: {
      docs: '/api-docs',
      registration: 'POST /registration',
      login: 'POST /login',
      tasks: 'GET /readFile',
      create: 'POST /changeFile',
      task: 'GET/PUT/PATCH/DELETE /tasks/:id'
    }
  });
});

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, SECRET, {
    expiresIn: "1h",
  });
}

function auth(req, res, next) {
  if (!req.headers.authorization)
    return res.status(401).json({ error: "Authorization header required" });

  const [scheme, token] = req.headers.authorization.split(" ");

  if (scheme !== "Bearer" || !token)
    return res
      .status(401)
      .json({ error: "Invalid authorization format. Use Bearer token" });

  try {
    req.user = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
    console.log("User authenticated:", req.user.id);
    next();
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    res
      .status(401)
      .json({ error: expired ? "Token is expired" : "Token is invalid" });
  }
}

connectToDatabase().catch(console.error);

/**
 * @swagger
 * /registration:
 *   post:
 *     summary: Регистрация нового пользователя
 *     description: Создает нового пользователя с хешированным паролем
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Пользователь успешно зарегистрирован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterResponse'
 *       400:
 *         description: Пользователь уже существует
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка регистрации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/registration', validateRegistration(), handleValidationErrors, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const users = await getUsersCollection();

    const user = {
      id: randomUUID(),
      name,
      email,
      password: await bcrypt.hash(password, 10),
    };

    const response = await users.insertOne(user)
    res.status(201).json({ id: response.insertedId, name, email });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: "Registration failed" });
  }
})

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Вход в систему
 *     description: Аутентификация пользователя и получение JWT токена
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Неверные учетные данные
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка входа
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post("/login", validateLogin(), handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    const users = await getUsersCollection();
    const user = await users.findOne({ email });

    const pass = await bcrypt.compare(password, user.password);

    if (!user || !pass)
      return res.status(401).json({ error: "Wrong email or password" });
    res.json({ token: signToken(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: "Login failed" });
  }
});


/**
 * @swagger
 * /readFile:
 *   get:
 *     summary: Получить все задачи пользователя
 *     description: Возвращает список всех задач текущего пользователя. Можно фильтровать по статусу выполнения.
 *     tags:
 *       - Tasks
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: completed
 *         schema:
 *           type: boolean
 *         description: Фильтр по статусу выполнения (true/false)
 *     responses:
 *       200:
 *         description: Список задач
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TasksResponse'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка чтения файла
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/tasks", auth, validateGetTasks, handleValidationErrors,
  async (req, res) => {
    try {
      const tasksCollection = await getTasksCollection();

      const filter = { userId: req.user.id };

      if (req.query.completed !== undefined) {
        filter.completed = req.query.completed === 'true';
      }

      const tasks = await tasksCollection.find(filter).toArray();

      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to read tasks" });
    }
  },
);

/**
 * @swagger
 * /changeFile:
 *   post:
 *     summary: Создать новую задачу
 *     description: Создает новую задачу для текущего пользователя
 *     tags:
 *       - Tasks
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Buy milk
 *     responses:
 *       201:
 *         description: Задача создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskResponse'
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка создания задачи
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post("/tasks", auth, validateCreateTask, handleValidationErrors,
  async (req, res) => {
    try {
      const { title } = req.body;
      const tasksCollection = await getTasksCollection();
      const newTask = {
        userId: req.user.id,
        title: title.trim(),
        completed: false
      };

      await tasksCollection.insertOne(newTask);
      res.status(201).json({
        message: "Task created!",
        task: newTask,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create task" });
    }
  },
);

function getObjectId(id, res) {
  try {
    return new ObjectId(id);
  } catch (error) {
    res.status(400).json({ error: "Invalid task ID format" });
    return null;
  }
}

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Получить задачу по ID
 *     description: Возвращает задачу по ID, если она принадлежит текущему пользователю
 *     tags:
 *       - Tasks
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID задачи
 *     responses:
 *       200:
 *         description: Задача найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Доступ запрещен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Задача не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка чтения задачи
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/tasks/:id", auth, validateGetTask, handleValidationErrors,
  async (req, res) => {
    try {
      const tasksCollection = await getTasksCollection();

      const objectId = getObjectId(req.params.id, res);
      if (!objectId) return;

      const task = await tasksCollection.findOne({
        _id: objectId,
        userId: req.user.id
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (task.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to read task" });
    }
  },
);

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Обновить задачу
 *     description: Полностью обновляет задачу (только title), если она принадлежит текущему пользователю
 *     tags:
 *       - Tasks
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID задачи
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Buy organic milk
 *     responses:
 *       200:
 *         description: Задача обновлена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Доступ запрещен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Задача не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка обновления задачи
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.put("/tasks/:id", auth, validateReplaceTask, handleValidationErrors,
  async (req, res) => {
    try {
      const { title } = req.body;
      const tasksCollection = await getTasksCollection();

      const objectId = getObjectId(req.params.id, res);
      if (!objectId) return;

      const result = await tasksCollection.findOneAndUpdate(
        {
          _id: objectId,
          userId: req.user.id
        },
        {
          $set: {
            title: title.trim()
          }
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        const taskExists = await tasksCollection.findOne({
          _id: objectId
        });

        if (!taskExists) {
          return res.status(404).json({ error: "Task not found" });
        }

        return res.status(403).json({ error: "Access denied" });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  },
);

/**
 * @swagger
 * /tasks/{id}:
 *   patch:
 *     summary: Переключить статус задачи
 *     description: Переключает статус completed задачи, если она принадлежит текущему пользователю
 *     tags:
 *       - Tasks
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID задачи
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               completed:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Статус задачи обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Доступ запрещен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Задача не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка обновления задачи
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.patch("/tasks/:id", auth, validatePatchTask, handleValidationErrors,
  async (req, res) => {
    try {
      const tasksCollection = await getTasksCollection();

      const objectId = getObjectId(req.params.id, res);
      if (!objectId) return;

      const result = await tasksCollection.findOneAndUpdate(
        {
          _id: objectId,
          userId: req.user.id
        },
        [{
          $set: {
            completed: { $not: "$completed" }
          }
        }],
        { returnDocument: 'after' }
      );

      if (!result) {
        const taskExists = await tasksCollection.findOne({
          _id: objectId
        });

        if (!taskExists) {
          return res.status(404).json({ error: "Task not found" });
        }

        return res.status(403).json({ error: "Access denied" });
      }

      res.json(result);
    } catch (error) {
      if (error.code === "ENOENT") {
        return res.status(404).json({ error: "Database file not found" });
      }
      res.status(500).json({ error: "Failed to toggle task" });
    }
  },
);

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Удалить задачу
 *     description: Удаляет задачу по ID, если она принадлежит текущему пользователю
 *     tags:
 *       - Tasks
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID задачи
 *     responses:
 *       200:
 *         description: Задача удалена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteResponse'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Доступ запрещен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Задача не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка удаления задачи
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.delete("/tasks/:id", auth, validateDeleteTask, handleValidationErrors,
  async (req, res) => {
    try {
      const tasksCollection = await getTasksCollection();

      const objectId = getObjectId(req.params.id, res);
      if (!objectId) return;

      const task = await tasksCollection.findOne({
        _id: objectId,
        userId: req.user.id
      });

      if (!task) {
        const taskExists = await tasksCollection.findOne({
          _id: objectId
        });

        if (!taskExists) {
          return res.status(404).json({ error: "Task not found" });
        }

        return res.status(403).json({ error: "Access denied" });
      }

      await tasksCollection.deleteOne({ _id: objectId });
      res.json({ message: "Task deleted", id });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  },
);

/**
 * @swagger
 * /test-sentry:
 *   get:
 *     summary: Тестовый маршрут для Sentry
 *     description: Генерирует ошибку для тестирования Sentry
 *     tags:
 *       - System
 *     responses:
 *       500:
 *         description: Тестовая ошибка Sentry
 */
app.use(Sentry.Handlers.errorHandler());

app.get("/test-sentry", (req, res) => {
  throw new Error("Test error for Sentry!");
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}!`));
