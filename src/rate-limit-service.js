const rateLimit = require('express-rate-limit');

class RateLimitService {
  constructor() {
    this.defaultLimits = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    };

    this.strictLimits = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // limit each IP to 10 requests per windowMs
      message: {
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded for this endpoint. Please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    };

    this.uploadLimits = {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // limit each IP to 20 uploads per hour
      message: {
        success: false,
        error: 'Upload rate limit exceeded',
        message: 'Too many file uploads. Please try again later.',
        retryAfter: '1 hour'
      },
      standardHeaders: true,
      legacyHeaders: false,
    };
  }

  // General rate limiting for most endpoints
  getGeneralLimiter() {
    return rateLimit({
      ...this.defaultLimits,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
      }
    });
  }

  // Strict rate limiting for sensitive endpoints
  getStrictLimiter() {
    return rateLimit(this.strictLimits);
  }

  // Rate limiting for file uploads
  getUploadLimiter() {
    return rateLimit(this.uploadLimits);
  }

  // Custom rate limiting for specific use cases
  getCustomLimiter(options = {}) {
    return rateLimit({
      ...this.defaultLimits,
      ...options
    });
  }

  // Rate limiting for authentication endpoints
  getAuthLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 login attempts per windowMs
      message: {
        success: false,
        error: 'Too many authentication attempts',
        message: 'Too many login attempts. Please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // Don't count successful requests
    });
  }

  // Rate limiting for API endpoints
  getApiLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200, // limit each IP to 200 API requests per windowMs
      message: {
        success: false,
        error: 'API rate limit exceeded',
        message: 'Too many API requests. Please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  getRateLimitInfo() {
    return {
      general: {
        windowMs: this.defaultLimits.windowMs,
        max: this.defaultLimits.max,
        description: 'General API endpoints'
      },
      strict: {
        windowMs: this.strictLimits.windowMs,
        max: this.strictLimits.max,
        description: 'Sensitive endpoints (auth, admin)'
      },
      upload: {
        windowMs: this.uploadLimits.windowMs,
        max: this.uploadLimits.max,
        description: 'File upload endpoints'
      },
      auth: {
        windowMs: 15 * 60 * 1000,
        max: 5,
        description: 'Authentication endpoints'
      }
    };
  }
}

module.exports = RateLimitService;
