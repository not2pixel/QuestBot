'use strict';

/**
 * SessionManager
 * Stores Discord user tokens in memory only.
 * Tokens are NEVER written to disk, database, or logs.
 * Sessions are cleared when the process exits.
 */
class SessionManager {
  constructor() {
    /** @type {Map<string, { token: string, addedAt: number, username?: string }>} */
    this._sessions = new Map();
  }

  /**
   * Register or update a session for a Discord user ID.
   * @param {string} userId
   * @param {string} token
   * @param {string} [username]
   */
  set(userId, token, username) {
    this._sessions.set(userId, {
      token,
      username: username ?? null,
      addedAt: Date.now(),
    });
  }

  /**
   * Retrieve the session for a user.
   * @param {string} userId
   */
  get(userId) {
    return this._sessions.get(userId) ?? null;
  }

  /**
   * Check whether a session exists for the user.
   * @param {string} userId
   */
  has(userId) {
    return this._sessions.has(userId);
  }

  /**
   * Remove a session (logout).
   * @param {string} userId
   */
  remove(userId) {
    return this._sessions.delete(userId);
  }

  /**
   * Total active sessions count.
   */
  get size() {
    return this._sessions.size;
  }
}

// Singleton instance shared across the process
const sessions = new SessionManager();

module.exports = { sessions };
