const { sendResponse } = require('../utils/responseHelper');

/**
 * Validation Middleware
 * @param {object} schema - Zod schema object containing { body, query, params }
 */
const validate = (schema) => (req, res, next) => {
    try {
        if (schema.body) {
            req.body = schema.body.parse(req.body);
        }
        if (schema.query) {
            req.query = schema.query.parse(req.query);
        }
        if (schema.params) {
            req.params = schema.params.parse(req.params);
        }
        next();
    } catch (error) {
        // ZodError
        if (error.issues) {
            const formattedErrors = error.issues.map(err => ({
                field: err.path.join('.'),
                message: err.message
            }));

            return sendResponse(res, 400, false, 'Validation failed', null, {
                code: 'VALIDATION_ERROR',
                details: formattedErrors
            });
        }

        // Other errors
        return sendResponse(res, 500, false, 'Internal Validation Error', null, {
            code: 'INTERNAL_VALIDATION_ERROR',
            details: error.message
        });
    }
};

module.exports = validate;
