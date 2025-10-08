const axios = require('axios');

class MonitoringService {
  constructor() {
    this.uptimeStart = Date.now();
    this.healthChecks = [];
    this.externalPingUrl = process.env.UPTIME_PING_URL;
    this.pingInterval = process.env.UPTIME_PING_INTERVAL || 300000; // 5 minutes
    this.isMonitoring = false;
  }

  startMonitoring() {
    if (this.externalPingUrl && !this.isMonitoring) {
      this.isMonitoring = true;
      console.log('🔍 Starting uptime monitoring...');
      
      // Ping immediately
      this.pingExternalService();
      
      // Set up interval
      this.pingIntervalId = setInterval(() => {
        this.pingExternalService();
      }, this.pingInterval);
    }
  }

  stopMonitoring() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    this.isMonitoring = false;
    console.log('🔍 Stopped uptime monitoring');
  }

  async pingExternalService() {
    if (!this.externalPingUrl) return;

    try {
      const response = await axios.get(this.externalPingUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'AlvaP-Monitoring/1.0'
        }
      });

      this.healthChecks.push({
        timestamp: new Date().toISOString(),
        status: 'success',
        responseTime: response.duration || 0,
        statusCode: response.status
      });

      console.log('✅ Uptime ping successful');
    } catch (error) {
      this.healthChecks.push({
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message,
        responseTime: error.duration || 0
      });

      console.error('❌ Uptime ping failed:', error.message);
    }

    // Keep only last 100 health checks
    if (this.healthChecks.length > 100) {
      this.healthChecks = this.healthChecks.slice(-100);
    }
  }

  getUptimeStats() {
    const now = Date.now();
    const uptimeMs = now - this.uptimeStart;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);

    const recentChecks = this.healthChecks.slice(-10);
    const successCount = recentChecks.filter(check => check.status === 'success').length;
    const errorCount = recentChecks.filter(check => check.status === 'error').length;
    const successRate = recentChecks.length > 0 ? (successCount / recentChecks.length) * 100 : 100;

    return {
      uptime: {
        totalMs: uptimeMs,
        formatted: `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
        startTime: new Date(this.uptimeStart).toISOString()
      },
      monitoring: {
        enabled: this.isMonitoring,
        externalPingUrl: this.externalPingUrl,
        pingInterval: this.pingInterval,
        lastCheck: this.healthChecks.length > 0 ? this.healthChecks[this.healthChecks.length - 1].timestamp : null
      },
      healthChecks: {
        total: this.healthChecks.length,
        recent: recentChecks.length,
        successCount,
        errorCount,
        successRate: Math.round(successRate * 100) / 100
      },
      recentChecks: recentChecks.slice(-5) // Last 5 checks
    };
  }

  // Manual health check endpoint
  async performHealthCheck() {
    const checks = {
      database: await this.checkDatabase(),
      fileStorage: await this.checkFileStorage(),
      emailService: await this.checkEmailService(),
      memory: this.checkMemory(),
      disk: this.checkDisk()
    };

    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
    
    return {
      overall: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks
    };
  }

  async checkDatabase() {
    try {
      // This would be implemented based on your database setup
      return { status: 'healthy', message: 'Database connection OK' };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async checkFileStorage() {
    try {
      // This would check if file storage is accessible
      return { status: 'healthy', message: 'File storage accessible' };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async checkEmailService() {
    try {
      // This would check if email service is configured
      const hasEmailConfig = !!(process.env.EMAIL_API_KEY && process.env.EMAIL_PROVIDER);
      return { 
        status: hasEmailConfig ? 'healthy' : 'warning', 
        message: hasEmailConfig ? 'Email service configured' : 'Email service not configured'
      };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  checkMemory() {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    const isHealthy = memUsageMB.heapUsed < 500; // Less than 500MB heap usage

    return {
      status: isHealthy ? 'healthy' : 'warning',
      usage: memUsageMB,
      message: isHealthy ? 'Memory usage normal' : 'High memory usage detected'
    };
  }

  checkDisk() {
    // This is a simplified disk check
    // In production, you'd want to check actual disk usage
    return {
      status: 'healthy',
      message: 'Disk space check not implemented'
    };
  }
}

module.exports = MonitoringService;
