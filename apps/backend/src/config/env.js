const dotenv = require('dotenv');
const path = require('path');

// Explicitly load .env from the backend root directory (src/config -> src -> root)
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    if (process.env.NODE_ENV !== 'production') {
        console.warn("Dotenv: Failed to load .env file (Expected in Production if using Cloud Env Vars)");
    }
} else {
    console.log("Dotenv: Loaded configuration from", envPath);
}
console.log("Current Directory:", process.cwd());
console.log("Environment Variables Check:");
console.log("SUPABASE_URL:", !!process.env.SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set (Length: " + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ")" : "NOT SET");
console.log("SUPABASE_JWT_SECRET:", process.env.SUPABASE_JWT_SECRET ? "Set" : "NOT SET");


module.exports = {
    port: process.env.PORT || 5000,

    jwtSecret: process.env.JWT_SECRET,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
};
