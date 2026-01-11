const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorMiddleware } = require('./middlewares/error.middleware');

const app = express();

app.use(cors());
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});
const cronService = require('./modules/cron/cron.service');

// Initialize Cron Jobs
cronService.initCronJobs();

// Routes
app.use('/api/v1', routes);

// Support short webhook URL for convenience
const webhookController = require('./modules/payment/webhook.controller');
app.post('/webhook', webhookController.handleWebhook);

app.use(errorMiddleware);

module.exports = app;
