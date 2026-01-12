const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Load .env explicitly from backend root (scripts -> backend -> .env)
const envPath = path.resolve(__dirname, '../.env');
console.log(`Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Failed to load .env:", result.error);
    process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.SUPABASE_JWT_SECRET;

console.log("\n--- Configuration Check ---");
console.log(`SUPABASE_URL: ${url ? 'Set' : 'MISSING'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? serviceKey.substring(0, 10) + '...' : 'MISSING'}`);
console.log(`SUPABASE_JWT_SECRET: ${jwtSecret ? jwtSecret.substring(0, 10) + '...' : 'MISSING'}`);

if (!serviceKey || !serviceKey.startsWith('eyJ')) {
    console.warn("\n[WARNING] SUPABASE_SERVICE_ROLE_KEY does not start with 'eyJ'. This is likely INVALID for a Service Role JWT.");
}

async function testConnection() {
    console.log("\n--- Testing Connection ---");
    if (!url || !serviceKey) {
        console.error("Cannot test connection: Missing URL or Key.");
        return;
    }

    const supabase = createClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // Try a simple read
        console.log("Attempting to read 'users' table...");
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });

        if (error) {
            console.error("READ FAILED:", error.message);
            console.error("Details:", error);
        } else {
            console.log("READ SUCCESS: Connected to Supabase!");
        }

        // Try to update a non-existent subscription to test permissions
        console.log("\nAttempting to access 'user_subscriptions' table (Privilege Check)...");
        const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({ status: 'revoked' })
            .eq('id', '00000000-0000-0000-0000-000000000000'); // Dummy ID

        if (updateError) {
            console.error("WRITE FAILED:", updateError.message);
        } else {
            console.log("WRITE SUCCESS: Service Role has write permissions.");
        }

    } catch (err) {
        console.error("Unexpected Error:", err);
    }
}

testConnection();
