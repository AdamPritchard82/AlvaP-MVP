const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.jwtExpiry = process.env.JWT_EXPIRY || '7d';
    
    // In production, ensure JWT_SECRET is set
    if (process.env.NODE_ENV === 'production' && this.jwtSecret === 'your-super-secret-jwt-key-change-in-production') {
      console.warn('⚠️ WARNING: Using default JWT_SECRET in production! Please set a secure JWT_SECRET environment variable.');
    }
  }

  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: this.jwtExpiry,
      issuer: 'alvap-api',
      audience: 'alvap-frontend'
    });
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'alvap-api',
        audience: 'alvap-frontend'
      });
      return { valid: true, user: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Middleware for protecting routes
  authenticateToken() {
    return (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Access token required',
          message: 'Please provide a valid authentication token'
        });
      }

      const result = this.verifyToken(token);
      if (!result.valid) {
        return res.status(403).json({ 
          success: false, 
          error: 'Invalid token',
          message: result.error
        });
      }

      req.user = result.user;
      next();
    };
  }

  // Middleware for role-based access
  requireRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        });
      }

      const userRole = req.user.role || 'user';
      const roleHierarchy = { 'user': 1, 'admin': 2, 'superadmin': 3 };
      
      if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
        return res.status(403).json({ 
          success: false, 
          error: 'Insufficient permissions',
          message: `This action requires ${requiredRole} role or higher`
        });
      }

      next();
    };
  }

  // Generate refresh token (for future use)
  generateRefreshToken(user) {
    const payload = {
      id: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: '30d',
      issuer: 'alvap-api',
      audience: 'alvap-frontend'
    });
  }

  getAuthInfo() {
    return {
      jwtExpiry: this.jwtExpiry,
      hasSecureSecret: this.jwtSecret !== 'your-super-secret-jwt-key-change-in-production',
      environment: process.env.NODE_ENV || 'development'
    };
  }
}

module.exports = AuthService;
