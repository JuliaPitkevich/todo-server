const { body, param, query, validationResult } = require('express-validator');

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

// Валидация для GET /readFile с query параметрами
const validateGetTasks = [
    query('completed')
        .optional()
        .isBoolean()
        .withMessage('completed в query должен быть true или false')
        .toBoolean()
];

// Валидация для POST /changeFile
const validateCreateTask = [title()];

// Валидация для PUT /tasks/:id
const validateReplaceTask = [taskId(), title()];

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
    validateGetTask,
    validateDeleteTask,
    validateGetTasks,
    handleValidationErrors
};