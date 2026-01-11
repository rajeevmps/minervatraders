const { createClient } = require('@supabase/supabase-js');
const { supabaseUrl, supabaseServiceKey } = require('./env');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const connectDB = async () => {
  try {
    // Simple query to test connection
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) throw error;
    console.log('Supabase Connected');
  } catch (error) {
    console.error(`Supabase Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { supabase, connectDB };
