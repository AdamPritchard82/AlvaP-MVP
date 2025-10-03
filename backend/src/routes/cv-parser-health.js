// CV Parser Health Check Route
const express = require('express');
const { DotNetCvParser } = require('../parsers/dotnetCvParser');

const router = express.Router();

// Health check endpoint for CV parsing services
router.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        local: {
          status: 'available',
          adapters: ['pdf-parse', 'mammoth', 'text', 'textract', 'tesseract-ocr']
        }
      }
    };

    // Check .NET parser if enabled
    if (process.env.ENABLE_DOTNET_PARSER === 'true') {
      try {
        const dotNetParser = new DotNetCvParser();
        const isHealthy = await dotNetParser.healthCheck();
        
        healthStatus.services.dotnet = {
          status: isHealthy ? 'available' : 'unavailable',
          url: process.env.DOTNET_CV_API_URL || 'not configured',
          supportedFormats: isHealthy ? await dotNetParser.getSupportedFormats() : []
        };
      } catch (error) {
        healthStatus.services.dotnet = {
          status: 'error',
          url: process.env.DOTNET_CV_API_URL || 'not configured',
          error: error.message
        };
      }
    }

    // Determine overall status
    const hasErrors = Object.values(healthStatus.services).some(service => 
      service.status === 'error' || service.status === 'unavailable'
    );
    
    if (hasErrors) {
      healthStatus.status = 'degraded';
    }

    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
