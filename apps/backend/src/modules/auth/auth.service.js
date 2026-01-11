const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../../config/env');
const { supabase } = require('../../config/db');
const bcrypt = require('bcryptjs');

exports.register = async (userData) => {
    const { email, password, fullName } = userData; // Password is used for local auth if implemented, but primarily Google Auth is requested.

    // Check existing
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();
    if (existingUser) {
        throw { statusCode: 400, message: 'User already exists' };
    }

    // Hash password (if using password auth)
    // Note: Supabase handles auth usually, but here we are using custom table for users as per schema.
    const salt = await bcrypt.genSalt(10);
    // Note: 'password_hash' column was not in the schema provided by the user in Step 295. 
    // The user provided schema only has: email, full_name, avatar_url, provider, provider_id, role.
    // Assuming we are sticking to Google Auth mostly, or need to add password_hash to schema if local auth is strict requirement.
    // Use Case seems to be Google Auth primarily.
    // We will insert what we can.

    // Attempting to match schema provided:
    // id, email, full_name, avatar_url, provider, provider_id, role

    const { data: user, error } = await supabase.from('users').insert([
        {
            email,
            full_name: fullName,
            provider: 'email', // Defaulting for manual register
            role: 'user'
        }
    ]).select().single();

    if (error) throw error;
    return user;
};

exports.login = async (credentials) => {
    // This function assumes local auth (email/password). 
    // Since the schema doesn't have password_hash, this might be redundant or require schema update.
    // We'll keep it as a placeholder or throw error 'Not implemented for this schema'.
    throw { statusCode: 501, message: 'Local login not fully supported in current schema (Google Auth preferred)' };
};

exports.generateToken = (user) => {
    return jwt.sign({ id: user.id, role: user.role, email: user.email }, jwtSecret, {
        expiresIn: '7d',
    });
};

