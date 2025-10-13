// .NET CV Parser Integration
const axios = require('axios');
const FormData = require('form-data');
const { normaliseDotnet } = require('../adapters/dotnetParserAdapter.js');
const { fallbackPhone } = require('../utils/phoneFallback.js');

class DotNetCvParser {
  constructor() {
    this.apiUrl = 'https://positive-bravery-production.up.railway.app';
    this.timeout = 30000; // 30 second timeout
  }

  async parseFile(buffer, mimetype, filename) {
    try {
      console.log(`[DotNetCvParser] Starting parse for ${filename} (${mimetype})`);
      
      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: mimetype }), filename);
      
      const response = await fetch(`${this.apiUrl}/api/documentparser/parse`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'CV parsing failed');
      }

          console.log(`[DotNetCvParser] Successfully parsed ${filename}`);
      console.log(`[DotNetCvParser] Raw .NET response:`, JSON.stringify(data, null, 2));
      console.log(`[DotNetCvParser] Data:`, JSON.stringify(data.data, null, 2));
      
      // Use the adapter to normalize the response
      const normalized = normaliseDotnet(data);
      
      // Apply phone fallback if needed
      if (!normalized.phone && data.data?.summary) {
        const fallback = fallbackPhone(data.data.summary);
        if (fallback) {
          console.log(`[DotNetCvParser] Using phone fallback: ${fallback}`);
          normalized.phone = fallback;
        }
      }
      
      return this.transformResponse(normalized, filename, mimetype);
    } catch (error) {
      console.error(`[DotNetCvParser] Error parsing ${filename}:`, error.message);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('CV parsing service is unavailable');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('CV parsing request timed out');
      } else if (error.response?.status === 413) {
        throw new Error('File too large for CV parsing service');
      } else if (error.response?.status === 415) {
        throw new Error('Unsupported file type for CV parsing service');
      }
      
      throw error;
    }
  }

  transformResponse(normalizedData, filename, mimetype) {
    // The data is already normalized by the adapter
    const { name, firstName, lastName, email, phone, jobTitle, employer } = normalizedData;
    
    const fullName = name || `${firstName} ${lastName}`.trim();

    // Calculate confidence based on data completeness
    let confidence = 0.5; // Base confidence
    if (firstName && lastName) confidence += 0.2;
    if (email) confidence += 0.2;
    if (phone) confidence += 0.1;
    if (jobTitle) confidence += 0.2;
    if (employer) confidence += 0.1;
    confidence = Math.min(confidence, 1.0);

    return {
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      currentTitle: jobTitle || '',
      currentEmployer: employer || '',
      skills: {}, // Will be populated by the main parser
      experience: [], // Will be populated by the main parser
      notes: `Parsed from ${filename}`,
      confidence,
      source: 'dotnet-api',
      parseConfidence: confidence,
      textLength: fullName.length,
      duration: 0, // Will be set by the calling code
      metadata: {
        originalFileName: filename,
        documentType: mimetype,
        parsedAt: new Date().toISOString(),
        adapterUsed: true
      },
      allResults: [],
      errors: []
    };
  }

  detectSkill(text, skillType) {
    const skillPatterns = {
      communications: /communications?|comms?|media|press|pr|public relations|marketing|social media|content|writing|editorial|journalism|brand|advertising/i,
      campaigns: /campaigns?|advocacy|engagement|grassroots|activism|outreach|community|organizing|mobilization|political|election/i,
      policy: /policy|policies|briefing|consultation|legislative|regulatory|government|public policy|research|analysis|strategy|planning/i,
      publicAffairs: /public affairs|government affairs|parliamentary|stakeholder relations|lobbying|government relations|political|advocacy|corporate affairs/i
    };

    return skillPatterns[skillType].test(text);
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/documentparser/health`, {
        timeout: 5000
      });
      return response.data.Status === 'Healthy';
    } catch (error) {
      console.error('[DotNetCvParser] Health check failed:', error.message);
      return false;
    }
  }

  async getSupportedFormats() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/documentparser/supported-formats`, {
        timeout: 5000
      });
      return response.data.SupportedFormats;
    } catch (error) {
      console.error('[DotNetCvParser] Failed to get supported formats:', error.message);
      return [];
    }
  }
}

module.exports = { DotNetCvParser };
