const userRepository = require('./user.repository');

/**
 * Returns the public profile projection — password_hash is never included,
 * because the repository's default projection excludes it.
 */
exports.getUserById = (userId) => userRepository.findById(userId);
