require('dotenv').config();
const Sentry = require("./instrument.js");
const bcrypt = require("bcryptjs");
const { log } = require("console");
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const jwt = require("jsonwebtoken");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const {
  validateCreateTask,
  validateReplaceTask,
  validatePatchTask,
  validateGetTask,
  validateDeleteTask,
  validateGetTasks,
  handleValidationErrors,
} = require("./validators");
const { randomUUID } = require("crypto");

const app = express();
app.use(Sentry.Handlers.requestHandler());
app.use(express.json());
console.log("мой путь", __dirname);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
console.log("Swagger docs available at http://localhost:5000/api-docs");

const DB = path.join(__dirname, "db.json");
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET;

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
app.post("/registration", async (req, res) => {
  const { email, password } = req.body;

  const data = await fs.readFile(DB, "utf-8");
  const db = JSON.parse(data);

  const user = {
    id: randomUUID(),
    email,
    password: await bcrypt.hash(password, 10),
  };

  db.users.push(user);
  await fs.writeFile(DB, JSON.stringify(db, null, 2), { flag: "w" });
  res.status(201).json({ id: user.id, email: user.email });
});

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
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const data = await fs.readFile(DB, "utf-8");
  const db = JSON.parse(data);

  const user = db.users.find((item) => item.email === email);
  const pass = await bcrypt.compare(password, user.password);

  if (!user || !pass)
    return res.status(401).json({ error: "Wrong email or password" });
  res.json({ token: signToken(user) });
});

/**
 * @swagger
 * /createFile:
 *   get:
 *     summary: Создать файл базы данных
 *     description: Создает новый файл db.json с пустыми массивами tasks и users
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Файл успешно создан
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: File created!
 *       400:
 *         description: Файл уже существует
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка создания файла
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/createFile", async (req, res) => {
  console.log("Method GET/createFile");
  try {
    await fs.writeFile(DB, JSON.stringify({ tasks: [], users: [] }, null, 2), {
      flag: "wx",
    });
    res.send("File created!");
  } catch (error) {
    if (error.code === "EEXIST") {
      res.status(400).json({ error: "File already exists" });
    } else {
      res.status(500).json({ error: "Failed to create file" });
    }
  }
});

/**
 * @swagger
 * /deleteFile:
 *   delete:
 *     summary: Удалить файл базы данных
 *     description: Полностью удаляет файл db.json
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Файл удален
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: File deleted!
 *       404:
 *         description: Файл не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Ошибка удаления файла
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.delete("/deleteFile", async (req, res) => {
  console.log("Method Delete");
  try {
    await fs.unlink(DB);
    res.send("File deleted!");
  } catch (error) {
    if (error.code === "ENOENT") {
      res.status(404).json({ error: "File not found" });
    } else {
      res.status(500).json({ error: "Failed to delete file" });
    }
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
app.get(
  "/readFile",
  auth,
  validateGetTasks,
  handleValidationErrors,
  async (req, res) => {
    console.log("Method GET/readFile");
    try {
      const data = await fs.readFile(DB, "utf-8");
      const allTasks = JSON.parse(data);
      let tasks = allTasks.tasks.filter((task) => task.userId === req.user.id);

      if (req.query.completed !== undefined) {
        const filterValue = req.query.completed === "true";
        tasks = tasks.filter((task) => task.completed === filterValue);
      }

      res.json(tasks);
    } catch (error) {
      if (error.code === "ENOENT") {
        res.json([]);
      } else {
        res.status(500).json({ error: "Failed to read file" });
      }
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
app.post(
  "/changeFile",
  auth,
  validateCreateTask,
  handleValidationErrors,
  async (req, res) => {
    console.log("Method POST", req.body);
    try {
      const { title } = req.body;
      const row = await fs.readFile(DB, "utf-8");
      const db = JSON.parse(row);
      const newTask = {
        id: crypto.randomUUID(),
        userId: req.user.id,
        title: title.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      db.tasks.push(newTask);

      await fs.writeFile(DB, JSON.stringify(db, null, 2), { flag: "w" });
      res.status(201).json({
        message: "Task created!",
        task: newTask,
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        return res
          .status(404)
          .json({ error: "Database file not found. Run /createFile first" });
      }
      res.status(500).json({ error: "Failed to create task" });
    }
  },
);

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
app.get(
  "/tasks/:id",
  auth,
  validateGetTask,
  handleValidationErrors,
  async (req, res) => {
    console.log("Method GET /tasks/:id", req.params.id);
    try {
      const { id } = req.params;
      const data = await fs.readFile(DB, "utf-8");
      const allTasks = JSON.parse(data);
      const task = allTasks.tasks.find((task) => task.id === id);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (task.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(task);
    } catch (error) {
      if (error.code === "ENOENT") {
        return res.status(404).json({ error: "Database file not found" });
      }
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
app.put(
  "/tasks/:id",
  auth,
  validateReplaceTask,
  handleValidationErrors,
  async (req, res) => {
    console.log("Method PUT", req.params.id);
    try {
      const { id } = req.params;
      const { title } = req.body;

      const data = await fs.readFile(DB, "utf-8");
      const allTasks = JSON.parse(data);
      const taskIndex = allTasks.tasks.findIndex((task) => task.id === id);

      if (taskIndex === -1) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (allTasks.tasks[taskIndex].userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      allTasks.tasks[taskIndex].title = title;
      await fs.writeFile(DB, JSON.stringify(allTasks, null, 2));

      res.json(allTasks.tasks[taskIndex]);
    } catch (error) {
      if (error.code === "ENOENT") {
        return res.status(404).json({ error: "Database file not found" });
      }
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
app.patch(
  "/tasks/:id",
  auth,
  validatePatchTask,
  handleValidationErrors,
  async (req, res) => {
    console.log("Method PATCH", req.params.id);
    try {
      const { id } = req.params;
      const data = await fs.readFile(DB, "utf-8");
      const allTasks = JSON.parse(data);

      const taskIndex = allTasks.tasks.findIndex((task) => task.id === id);
      if (taskIndex === -1) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (allTasks.tasks[taskIndex].userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      allTasks.tasks[taskIndex].completed =
        !allTasks.tasks[taskIndex].completed;
      await fs.writeFile(DB, JSON.stringify(allTasks, null, 2));

      res.json(allTasks.tasks[taskIndex]);
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
app.delete(
  "/tasks/:id",
  auth,
  validateDeleteTask,
  handleValidationErrors,
  async (req, res) => {
    console.log("Method DELETE", req.params.id);
    try {
      const { id } = req.params;

      const data = await fs.readFile(DB, "utf-8");
      const allTasks = JSON.parse(data);

      const taskToDelete = allTasks.tasks.find((task) => task.id === id);
      if (!taskToDelete) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (taskToDelete.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      allTasks.tasks = allTasks.tasks.filter((task) => task.id !== id);

      await fs.writeFile(DB, JSON.stringify(allTasks, null, 2));
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
