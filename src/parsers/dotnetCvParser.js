// .NET CV Parser Integration
const axios = require('axios');
const FormData = require('form-data');

class DotNetCvParser {
  constructor() {
    this.apiUrl = 'https://positive-bravery-production.up.railway.app';
    this.timeout = 30000; // 30 second timeout
  }

  async parseFile(buffer, mimetype, filename) {
    try {
      console.log(`[DotNetCvParser] Starting parse for ${filename} (${mimetype})`);
      
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: filename,
        contentType: mimetype
      });
      
      const response = await axios.post(`${this.apiUrl}/api/documentparser/parse`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: this.timeout,
        maxContentLength: 10 * 1024 * 1024, // 10MB
        maxBodyLength: 10 * 1024 * 1024, // 10MB
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'CV parsing failed');
      }

      console.log(`[DotNetCvParser] Successfully parsed ${filename}`);
      console.log(`[DotNetCvParser] Raw .NET response:`, JSON.stringify(response.data, null, 2));
      console.log(`[DotNetCvParser] Data:`, JSON.stringify(response.data.data, null, 2));
      
      // Transform .NET response to your existing format
      return this.transformResponse(response.data.data, filename, mimetype);
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

  transformResponse(dotNetData, filename, mimetype) {
    const { personalInfo, workExperience, education, skills, languages, certifications, summary } = dotNetData;
    
    // Extract names
    const firstName = personalInfo.firstName || '';
    const lastName = personalInfo.lastName || '';
    const fullName = personalInfo.name || `${firstName} ${lastName}`.trim();
    
    // Detect skills using keyword matching
    const allText = [
      fullName,
      personalInfo.linkedIn || '',
      ...workExperience.map(exp => `${exp.jobTitle} ${exp.company} ${exp.description || ''}`),
      ...education.map(edu => `${edu.degree} ${edu.field} ${edu.institution}`),
      ...skills,
      summary || ''
    ].join(' ').toLowerCase();

    const detectedSkills = {
      communications: this.detectSkill(allText, 'communications'),
      campaigns: this.detectSkill(allText, 'campaigns'),
      policy: this.detectSkill(allText, 'policy'),
      publicAffairs: this.detectSkill(allText, 'publicAffairs')
    };

    // Transform work experience
    const experience = workExperience.map(exp => {
      console.log(`[DotNetCvParser] Processing work experience:`, JSON.stringify(exp, null, 2));
      return {
        employer: exp.company || '',
        title: exp.jobTitle || '',
        startDate: exp.startDate || '',
        endDate: exp.endDate || '',
        description: exp.description || ''
      };
    });
    
    console.log(`[DotNetCvParser] Transformed experience:`, JSON.stringify(experience, null, 2));

    // Generate notes from summary or first few work experiences
    let notes = summary || '';
    if (!notes && workExperience.length > 0) {
      const recentJobs = workExperience.slice(0, 2);
      notes = recentJobs
        .map(exp => `${exp.jobTitle} at ${exp.company}`)
        .join(', ');
    }
    notes = notes.substring(0, 200) + (notes.length > 200 ? '...' : '');

    // Calculate confidence based on data completeness
    let confidence = 0.5; // Base confidence
    if (firstName && lastName) confidence += 0.2;
    if (personalInfo.email) confidence += 0.2;
    if (personalInfo.phone) confidence += 0.1;
    if (workExperience.length > 0) confidence += 0.2;
    if (skills.length > 0) confidence += 0.1;
    confidence = Math.min(confidence, 1.0);

    return {
      firstName,
      lastName,
      email: personalInfo.email || '',
      phone: personalInfo.phone || '',
      currentTitle: workExperience.length > 0 ? workExperience[0].jobTitle || '' : '',
      currentEmployer: workExperience.length > 0 ? workExperience[0].company || '' : '',
      skills: detectedSkills,
      experience,
      notes,
      confidence,
      source: 'dotnet-api',
      parseConfidence: confidence,
      textLength: allText.length,
      duration: 0, // Will be set by the calling code
      metadata: {
        originalFileName: filename,
        documentType: mimetype,
        parsedAt: dotNetData.parsedAt,
        skills: skills,
        languages: languages,
        certifications: certifications,
        education: education.map(edu => ({
          degree: edu.degree,
          field: edu.field,
          institution: edu.institution,
          startDate: edu.startDate,
          endDate: edu.endDate
        }))
      },
      allResults: [], // Not applicable for single service
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
