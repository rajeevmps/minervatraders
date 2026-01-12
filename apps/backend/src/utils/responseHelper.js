/**
 * Standardize API Response Helper
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {boolean} success - Success status
 * @param {string} message - Human readable message
 * @param {any} [data=null] - Payload data
 * @param {object} [error=null] - Error details { code, details }
 */
const sendResponse = (res, statusCode, success, message, data = null, error = null) => {
    const response = {
        success,
        message,
        timestamp: new Date().toISOString()
    };

    if (data !== null) {
        response.data = data;
    }

    if (error !== null) {
        response.error = error;
    }

    return res.status(statusCode).json(response);
};

module.exports = { sendResponse };
