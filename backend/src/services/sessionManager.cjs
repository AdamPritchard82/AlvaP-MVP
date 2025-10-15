/**
 * Session Manager Service
 * 
 * Handles user session tracking and anti-sharing enforcement
 * for AlvaP Seat billing system.
 */

const knex = require('knex');
const { config } = require('../config/config.cjs');
const { nanoid } = require('nanoid');

// Create Knex configuration for PostgreSQL
const knexConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgresql://localhost:5432/alvap',
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations'
  }
};

const db = knex(knexConfig);

class SessionManager {
  constructor() {
    this.maxSessionsPerUser = 2;
  }

  /**
   * Create a new session for a user
   */
  async createSession(userId, orgId, deviceHash = null, ipCountry = null) {
    const sessionId = nanoid();
    const now = new Date();

    // Check current active sessions for this user
    const activeSessions = await this.getActiveSessions(userId, orgId);
    
    // If user has reached max sessions, remove oldest
    if (activeSessions.length >= this.maxSessionsPerUser) {
      const oldestSession = activeSessions[0]; // Sessions are ordered by created_at
      await this.terminateSession(oldestSession.id);
    }

    // Create new session
    await db('auth_sessions').insert({
      id: sessionId,
      user_id: userId,
      org_id: orgId,
      device_hash: deviceHash,
      ip_country: ipCountry,
      created_at: now,
      last_seen_at: now,
      is_active: true
    });

    return {
      sessionId,
      userId,
      orgId,
      createdAt: now
    };
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId, orgId) {
    return await db('auth_sessions')
      .where('user_id', userId)
      .where('org_id', orgId)
      .where('is_active', true)
      .orderBy('created_at', 'asc')
      .select('*');
  }

  /**
   * Update session last seen timestamp
   */
  async updateSessionActivity(sessionId) {
    await db('auth_sessions')
      .where('id', sessionId)
      .where('is_active', true)
      .update({
        last_seen_at: new Date()
      });
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId) {
    await db('auth_sessions')
      .where('id', sessionId)
      .update({
        is_active: false
      });
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllUserSessions(userId, orgId) {
    await db('auth_sessions')
      .where('user_id', userId)
      .where('org_id', orgId)
      .update({
        is_active: false
      });
  }

  /**
   * Clean up old inactive sessions (run periodically)
   */
  async cleanupOldSessions() {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    await db('auth_sessions')
      .where('last_seen_at', '<', cutoffDate)
      .update({
        is_active: false
      });

    console.log(`[SESSION] Cleaned up old sessions older than ${cutoffDate.toISOString()}`);
  }

  /**
   * Get session statistics for an organization
   */
  async getSessionStats(orgId) {
    const stats = await db('auth_sessions')
      .join('users', 'auth_sessions.user_id', 'users.id')
      .where('auth_sessions.org_id', orgId)
      .where('auth_sessions.is_active', true)
      .select(
        'users.id as user_id',
        'users.name as user_name',
        'users.email as user_email',
        db.raw('COUNT(auth_sessions.id) as active_sessions'),
        db.raw('MAX(auth_sessions.last_seen_at) as last_activity')
      )
      .groupBy('users.id', 'users.name', 'users.email');

    return stats;
  }

  /**
   * Check if user can create new session
   */
  async canCreateSession(userId, orgId) {
    const activeSessions = await this.getActiveSessions(userId, orgId);
    return activeSessions.length < this.maxSessionsPerUser;
  }

  /**
   * Get device hash from request (simple implementation)
   */
  getDeviceHash(req) {
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    return require('crypto')
      .createHash('md5')
      .update(userAgent + ip)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get IP country (stub implementation)
   */
  getIpCountry(req) {
    // In production, you'd use a service like MaxMind GeoIP
    return 'GB'; // Default to UK for now
  }

  /**
   * Middleware to enforce session limits
   */
  enforceSessionLimit() {
    return async (req, res, next) => {
      try {
        if (!req.user || !req.user.userId) {
          return next();
        }

        const userId = req.user.userId;
        const orgId = req.user.orgId || 'default';
        const deviceHash = this.getDeviceHash(req);
        const ipCountry = this.getIpCountry(req);

        // Check if user can create new session
        const canCreate = await this.canCreateSession(userId, orgId);
        
        if (!canCreate) {
          // Terminate oldest session
          const activeSessions = await this.getActiveSessions(userId, orgId);
          if (activeSessions.length > 0) {
            await this.terminateSession(activeSessions[0].id);
            console.log(`[SESSION] Terminated oldest session for user ${userId} due to limit`);
          }
        }

        // Create or update session
        const existingSession = await db('auth_sessions')
          .where('user_id', userId)
          .where('org_id', orgId)
          .where('device_hash', deviceHash)
          .where('is_active', true)
          .first();

        if (existingSession) {
          await this.updateSessionActivity(existingSession.id);
          req.sessionId = existingSession.id;
        } else {
          const newSession = await this.createSession(userId, orgId, deviceHash, ipCountry);
          req.sessionId = newSession.sessionId;
        }

        next();
      } catch (error) {
        console.error('Session enforcement error:', error);
        next(); // Don't block request on session errors
      }
    };
  }
}

module.exports = new SessionManager();
