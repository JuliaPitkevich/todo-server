require('dotenv').config();
const swaggerJsdoc = require("swagger-jsdoc");

const PORT = process.env.PORT || 5000;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Tasks API",
      version: "1.0.0",
      description: "API для управления задачами с авторизацией",
      contact: {
        name: "API Support",
        email: "support@example.com",
      },
    },
    servers: [
      {
        url: process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`,
        description: process.env.RENDER_EXTERNAL_URL ? "Production server" : "Development server",
      },
      {
        url: `http://localhost:${PORT}`,
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Введите токен в формате: Bearer <token>",
        },
      },
      schemas: {
        // Схемы для задач
        Task: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "6a763758d2103f83b6232a81",
              description: "MongoDB ObjectId (строка)",
            },
            userId: {
              type: "string",
              format: "uuid",
              example: "123e4567-e89b-12d3-a456-426614174000",
              description: "ID пользователя, которому принадлежит задача",
            },
            title: {
              type: "string",
              example: "Buy milk",
              description: "Название задачи",
              minLength: 1,
            },
            description: {
              type: "string",
              example: "Organic milk from the store",
              description: "Описание задачи (опционально)",
            },
            completed: {
              type: "boolean",
              example: false,
              description: "Статус выполнения задачи",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-07-25T06:17:12.883Z",
              description: "Дата создания задачи",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-07-25T06:17:12.883Z",
              description: "Дата последнего обновления задачи",
            },
          },
        },
        TodosDataResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Task",
              },
            },
          },
        },
        TasksResponse: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Task",
              },
            },
          },
        },
        TaskResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Task created!",
            },
            task: {
              $ref: "#/components/schemas/Task",
            },
          },
        },
        DeleteResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Task deleted",
            },
            id: {
              type: "string",
              format: "uuid",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
              example: "Task not found",
            },
          },
        },
        ValidationErrorResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Ошибка валидации.",
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    example: "field",
                  },
                  value: {
                    type: "string",
                    example: "",
                  },
                  message: {
                    type: "string",
                    example: "title обязателен",
                  },
                  field: {
                    type: "string",
                    example: "title",
                  },
                  location: {
                    type: "string",
                    example: "body",
                  },
                },
              },
            },
          },
        },
        // Схемы для пользователей
        RegisterRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: {
              type: "string",
              example: "John Doe",
              description: "Имя пользователя",
            },
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
              description: "Email пользователя",
            },
            password: {
              type: "string",
              format: "password",
              example: "password123",
              description: "Пароль (минимум 6 символов)",
              minLength: 6,
            },
          },
        },
        RegisterResponse: {
          type: "object",
          properties: {
            access_token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              description: "JWT токен для авторизации",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            password: {
              type: "string",
              format: "password",
              example: "password123",
            },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            access_token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              description: "JWT токен для авторизации",
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ["./index.js"],
};

module.exports = swaggerJsdoc(options);
