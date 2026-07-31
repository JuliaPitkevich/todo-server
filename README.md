# Tasks API

REST API для управления задачами с JWT авторизацией.

## 📋 Описание

API позволяет пользователям:
- Регистрироваться и входить в систему
- Создавать, читать, обновлять и удалять задачи
- Каждый пользователь видит только свои задачи
- JWT токены для авторизации

## 🚀 Технологии

- Node.js
- Express.js
- JWT (jsonwebtoken)
- Bcrypt.js для хеширования паролей
- Express-validator для валидации
- Swagger для документации API
- Sentry для мониторинга ошибок

## 📦 Установка

```bash
# Клонировать репозиторий
git clone https://github.com/your-username/tasks-api.git
cd tasks-api

# Установить зависимости
npm install

# Запустить сервер
npm start