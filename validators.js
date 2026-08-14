const { body, param, query, validationResult } = require('express-validator');
const { getUsersCollection } = require('./db');

// Валидация ID в params
function taskId() {
    return param('id')
        .notEmpty()
        .withMessage('ID обязателен')
        .isString()
        .withMessage('ID должен быть строкой')
        .trim()
        .isLength({ min: 1 })
        .withMessage('ID не может быть пустым');
}

// Валидация title в body
function title({ optional = false } = {}) {
    const validator = body('title');

    if (optional) validator.optional();

    return validator
        .notEmpty()
        .withMessage('title обязателен')
        .isString()
        .withMessage('title должен быть строкой')
        .trim()
        .isLength({ min: 1 })
        .withMessage('title не может быть пустым');
}

function description() {
    return body('description')
        .optional()
        .isString()
        .withMessage('description должен быть строкой')
        .trim()
        .isLength({ max: 500 })
        .withMessage('description не может превышать 500 символов');
}

function emailUnique() {
    return body('email')
        .notEmpty()
        .withMessage('Email обязателен')
        .isEmail()
        .withMessage('Некорректный формат email')
        .normalizeEmail()
        .custom(async (email) => {
            const users = await getUsersCollection();
            const existingUser = await users.findOne({ email });
            if (existingUser) {
                throw new Error('Пользователь с таким email уже существует');
            }
            return true;
        });
}

function emailExists() {
    return body('email')
        .notEmpty()
        .withMessage('Email обязателен')
        .isEmail()
        .withMessage('Некорректный формат email')
        .normalizeEmail()
        .custom(async (email) => {
            const users = await getUsersCollection();
            const user = await users.findOne({ email });
            if (!user) {
                throw new Error('Пользователь с таким email не найден');
            }
            return true;
        });
}

function validateRegistration() {
    return [
        body('name')
            .notEmpty()
            .withMessage('Имя обязательно')
            .isString()
            .withMessage('Имя должно быть строкой')
            .trim()
            .isLength({ min: 1 })
            .withMessage('Имя не может быть пустым'),
        emailUnique(),
        body('password')
            .notEmpty()
            .withMessage('Пароль обязателен')
            .isLength({ min: 6 })
            .withMessage('Пароль должен содержать минимум 6 символов')
            .isString()
            .withMessage('Пароль должен быть строкой')
    ];
}

function validateLogin() {
    return [
        body('email')
            .notEmpty()
            .withMessage('Email обязателен')
            .isEmail()
            .withMessage('Некорректный формат email')
            .normalizeEmail(),
        body('password')
            .notEmpty()
            .withMessage('Пароль обязателен')
    ];
}


// Валидация для GET /readFile с query параметрами
const validateGetTasks = [
    query('completed')
        .optional()
        .isBoolean()
        .withMessage('completed в query должен быть true или false')
];

// Валидация для POST /changeFile
const validateCreateTask = [title(), description()];

// Валидация для PUT /tasks/:id
const validateReplaceTask = [taskId(), title(), description()];

// Валидация для PATCH /todos/:id (фронтенд-совместимый - title, description, completed)
const validatePatchTodo = [
    taskId(),

    body().custom((value, { req }) => {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new Error('Тело запроса не может быть пустым');
        }

        const allowedFields = ['title', 'description', 'completed'];
        const suppliedFields = Object.keys(req.body);

        if (suppliedFields.some((field) => !allowedFields.includes(field))) {
            throw new Error(`Разрешены только поля: ${allowedFields.join(', ')}.`);
        }

        return true;
    }),
    body('title')
        .optional()
        .isString()
        .withMessage('title должен быть строкой')
        .trim()
        .isLength({ min: 1 })
        .withMessage('title не может быть пустым'),
    body('description')
        .optional()
        .isString()
        .withMessage('description должен быть строкой')
        .trim()
        .isLength({ max: 500 })
        .withMessage('description не может превышать 500 символов'),
    body('completed')
        .optional()
        .isBoolean()
        .withMessage('completed должен быть true или false')
        .toBoolean()
];

// Валидация для PATCH /tasks/:id
const validatePatchTask = [
    taskId(),

    body().custom((value, { req }) => {
        if (!req.body || Object.keys(req.body).length === 0) {
            return true; // 👈 ПРОПУСКАЕМ, т.к. toggle не требует body
        }

        const allowedFields = ['completed'];
        const suppliedFields = Object.keys(req.body);

        if (suppliedFields.some((field) => !allowedFields.includes(field))) {
            throw new Error(`Разрешены только поля: ${allowedFields.join(', ')}.`);
        }

        return true;
    }),
    body('completed')
        .optional()
        .isBoolean()
        .withMessage('completed должен быть true или false')
        .toBoolean()
];

// Валидация для GET /tasks/:id
const validateGetTask = [taskId()];

// Валидация для DELETE /tasks/:id
const validateDeleteTask = [taskId()];

// Обработчик ошибок валидации
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Ошибка валидации.',
            errors: errors.array().map(({ type, value, msg, path, location }) => ({
                type,
                value,
                message: msg,
                field: path,
                location
            }))
        });
    }

    next();
}

module.exports = {
    taskId,
    validateCreateTask,
    validateReplaceTask,
    validatePatchTask,
    validatePatchTodo,
    validateGetTask,
    validateDeleteTask,
    validateGetTasks,
    validateRegistration,
    validateLogin,
    handleValidationErrors
};