const express = require('express');
const admin = require('firebase-admin');
const TelegramBot = require('node-telegram-bot-api');

// Инициализация firebase-admin с использованием сервисного аккаунта из переменной окружения
const serviceAccount = JSON.parse(process.env.FIREBASE_SECRET);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Получаем ссылку на Firestore
const db = admin.firestore();

// Получение переменных окружения для нового бота и списка администраторов
const botToken = process.env.TELEGRAM_BOT_TOKEN_NEW;
const adminChatIds = process.env.ADMIN_CHAT_IDS
    ? process.env.ADMIN_CHAT_IDS.split(',').map(id => id.trim())
    : []; // Пример: "-1234567890,-9876543210"

// Инициализируем Telegram-бота в режиме polling
const bot = new TelegramBot(botToken, { polling: true });

// Чтобы бот отслеживал только новые записи, установим время запуска:
const startTime = admin.firestore.Timestamp.now();

// Подписываемся на изменения в коллекции "users_logins" для документов, созданных после запуска
db.collection('users_logins')
    .where('createdAt', '>=', startTime)
    .orderBy('createdAt')
    .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const login = data.login;
                console.log(`Новая запись обнаружена. Логин: ${login}`);

                // Отправляем уведомление каждому администратору из массива
                adminChatIds.forEach(destChatId => {
                    bot.sendMessage(destChatId, `Новый пользователь прошёл тест. Логин: ${login}`)
                        .then(() => {
                            console.log(`Уведомление отправлено на ${destChatId}: Логин ${login}`);
                        })
                        .catch(err => {
                            console.error(`Ошибка при отправке уведомления на ${destChatId}:`, err);
                        });
                });
            }
        });
    }, err => {
        console.error("Ошибка при подписке на изменения в Firestore:", err);
    });


// --- Добавляем минимальный Express HTTP-сервер для Heroku --- //

const app = express();
const PORT = process.env.PORT || 3000;

// Этот endpoint можно оставить, чтобы Heroku увидел, что процесс слушает HTTP запросы.
app.get('/', (req, res) => {
    res.send('Бот запущен и слушает Firebase уведомления');
});

app.listen(PORT, () => {
    console.log(`Express-сервер запущен, порт ${PORT}`);
});
