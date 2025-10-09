// Weekly Digest Service - Automated Status Reports
const cron = require('node-cron');
const { format, subDays, startOfWeek, endOfWeek } = require('date-fns');

class WeeklyDigestService {
  constructor(emailService, db) {
    this.emailService = emailService;
    this.db = db;
    this.enabled = process.env.ENABLE_WEEKLY_DIGEST === 'true';
    this.lastSent = null;
    this.isRunning = false;
    
    if (this.enabled) {
      this.setupScheduler();
      console.log('📊 Weekly Digest Service enabled - scheduled for Mondays 08:00 UTC');
    } else {
      console.log('📊 Weekly Digest Service disabled - set ENABLE_WEEKLY_DIGEST=true to enable');
    }
  }

  setupScheduler() {
    // Every Monday at 08:00 UTC
    cron.schedule('0 8 * * 1', async () => {
      if (this.isRunning) {
        console.log('📊 Weekly digest already running, skipping...');
        return;
      }
      
      try {
        console.log('📊 Starting weekly digest generation...');
        await this.sendWeeklyDigest();
      } catch (error) {
        console.error('📊 Weekly digest error:', error.message);
      }
    }, {
      timezone: 'UTC'
    });
  }

  async generateDigestSummary() {
    const endDate = new Date();
    const startDate = subDays(endDate, 7);
    
    console.log(`📊 Collecting metrics for ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    try {
      // Get new candidates count and top skills
      const candidatesData = await this.getCandidatesMetrics(startDate, endDate);
      
      // Get new jobs count and average salary
      const jobsData = await this.getJobsMetrics(startDate, endDate);
      
      // Get matches generated
      const matchesData = await this.getMatchesMetrics(startDate, endDate);
      
      // Get pipeline movements (mock for now - would need pipeline tracking)
      const pipelineData = await this.getPipelineMetrics(startDate, endDate);
      
      // Get email metrics
      const emailData = await this.getEmailMetrics(startDate, endDate);

      return {
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        candidates: candidatesData,
        jobs: jobsData,
        matches: matchesData,
        pipeline: pipelineData,
        email: emailData,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('📊 Error generating digest summary:', error);
      throw error;
    }
  }

  async getCandidatesMetrics(startDate, endDate) {
    try {
      let candidates = [];
      
      if (this.db) {
        // Database query
        const result = await this.db.query(`
          SELECT id, skills, created_at
          FROM candidates 
          WHERE created_at >= $1 AND created_at <= $2
          ORDER BY created_at DESC
        `, [startDate.toISOString(), endDate.toISOString()]);
        
        candidates = result.rows.map(row => ({
          id: row.id,
          skills: row.skills ? JSON.parse(row.skills) : {},
          createdAt: row.created_at
        }));
      } else {
        // Fallback to in-memory data (would need to be passed in)
        candidates = [];
      }

      // Count skills
      const skillCounts = {
        communications: 0,
        campaigns: 0,
        policy: 0,
        publicAffairs: 0
      };

      candidates.forEach(candidate => {
        Object.keys(skillCounts).forEach(skill => {
          if (candidate.skills[skill] === true) {
            skillCounts[skill]++;
          }
        });
      });

      // Get top 3 skills
      const topSkills = Object.entries(skillCounts)
        .filter(([_, count]) => count > 0)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([skill, count]) => ({
          name: this.formatSkillName(skill),
          count
        }));

      return {
        count: candidates.length,
        topSkills
      };
    } catch (error) {
      console.error('📊 Error getting candidates metrics:', error);
      return { count: 0, topSkills: [] };
    }
  }

  async getJobsMetrics(startDate, endDate) {
    try {
      let jobs = [];
      
      if (this.db) {
        const result = await this.db.query(`
          SELECT id, salary_min, salary_max, created_at
          FROM jobs 
          WHERE created_at >= $1 AND created_at <= $2
          ORDER BY created_at DESC
        `, [startDate.toISOString(), endDate.toISOString()]);
        
        jobs = result.rows.map(row => ({
          id: row.id,
          salaryMin: row.salary_min,
          salaryMax: row.salary_max,
          createdAt: row.created_at
        }));
      } else {
        jobs = [];
      }

      // Calculate average salary band
      const salaryBands = jobs.map(job => {
        const min = job.salaryMin || 0;
        return Math.floor(min / 10000) * 10000;
      });

      const avgBand = salaryBands.length > 0 
        ? Math.round(salaryBands.reduce((a, b) => a + b, 0) / salaryBands.length)
        : 0;

      return {
        count: jobs.length,
        avgSalaryBand: avgBand
      };
    } catch (error) {
      console.error('📊 Error getting jobs metrics:', error);
      return { count: 0, avgSalaryBand: 0 };
    }
  }

  async getMatchesMetrics(startDate, endDate) {
    try {
      // This would need to be implemented based on your matching system
      // For now, return mock data
      return {
        count: 0,
        roles: 0
      };
    } catch (error) {
      console.error('📊 Error getting matches metrics:', error);
      return { count: 0, roles: 0 };
    }
  }

  async getPipelineMetrics(startDate, endDate) {
    try {
      // This would need to be implemented based on your pipeline system
      // For now, return mock data
      return {
        interviews: 0,
        offers: 0,
        placements: 0
      };
    } catch (error) {
      console.error('📊 Error getting pipeline metrics:', error);
      return { interviews: 0, offers: 0, placements: 0 };
    }
  }

  async getEmailMetrics(startDate, endDate) {
    try {
      // This would need to be implemented based on your email tracking
      // For now, return mock data
      return {
        sent: 0,
        bounced: 0,
        unsubscribed: 0
      };
    } catch (error) {
      console.error('📊 Error getting email metrics:', error);
      return { sent: 0, bounced: 0, unsubscribed: 0 };
    }
  }

  formatSkillName(skill) {
    const skillNames = {
      communications: 'Communications',
      campaigns: 'Campaigns',
      policy: 'Policy',
      publicAffairs: 'Public Affairs'
    };
    return skillNames[skill] || skill;
  }

  renderDigestHTML(data) {
    const { dateRange, candidates, jobs, matches, pipeline, email } = data;
    
    const formatSalaryBand = (band) => {
      if (band === 0) return 'N/A';
      return `£${(band / 1000).toFixed(0)}k`;
    };

    const topSkillsText = candidates.topSkills.length > 0
      ? ` (+${candidates.topSkills.map(s => `${s.count} ${s.name}`).join(', ')})`
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AlvaP Weekly Summary</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
        .content { padding: 32px 24px; }
        .metric { display: flex; align-items: center; margin-bottom: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6; }
        .metric-icon { font-size: 24px; margin-right: 16px; }
        .metric-content h3 { margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #1f2937; }
        .metric-content p { margin: 0; font-size: 14px; color: #6b7280; }
        .footer { background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { margin: 0; font-size: 12px; color: #6b7280; }
        .cta { background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px; font-weight: 500; }
        @media (max-width: 600px) {
            .container { margin: 0; }
            .content { padding: 24px 16px; }
            .header { padding: 24px 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 AlvaP Weekly Summary</h1>
            <p>${dateRange.start} to ${dateRange.end}</p>
        </div>
        
        <div class="content">
            <div class="metric">
                <div class="metric-icon">👥</div>
                <div class="metric-content">
                    <h3>New Candidates: ${candidates.count}${topSkillsText}</h3>
                    <p>Added to the talent pool this week</p>
                </div>
            </div>
            
            <div class="metric">
                <div class="metric-icon">💼</div>
                <div class="metric-content">
                    <h3>New Jobs: ${jobs.count}</h3>
                    <p>Average salary band: ${formatSalaryBand(jobs.avgSalaryBand)}</p>
                </div>
            </div>
            
            <div class="metric">
                <div class="metric-icon">🔗</div>
                <div class="metric-content">
                    <h3>Matches Generated: ${matches.count}</h3>
                    <p>Across ${matches.roles} active roles</p>
                </div>
            </div>
            
            <div class="metric">
                <div class="metric-icon">📈</div>
                <div class="metric-content">
                    <h3>Pipeline Activity</h3>
                    <p>Interviews: ${pipeline.interviews} | Offers: ${pipeline.offers} | Placements: ${pipeline.placements}</p>
                </div>
            </div>
            
            <div class="metric">
                <div class="metric-icon">📧</div>
                <div class="metric-content">
                    <h3>Email Activity</h3>
                    <p>Sent: ${email.sent} | Bounced: ${email.bounced} | Unsubscribed: ${email.unsubscribed}</p>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 32px;">
                <a href="${process.env.FRONTEND_URL || 'https://alvap-mvp-production.up.railway.app'}/analytics" class="cta">
                    View Full Analytics Dashboard
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p>Generated by AlvaP System • ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</p>
        </div>
    </div>
</body>
</html>`;
  }

  renderDigestText(data) {
    const { dateRange, candidates, jobs, matches, pipeline, email } = data;
    
    const formatSalaryBand = (band) => {
      if (band === 0) return 'N/A';
      return `£${(band / 1000).toFixed(0)}k`;
    };

    const topSkillsText = candidates.topSkills.length > 0
      ? ` (+${candidates.topSkills.map(s => `${s.count} ${s.name}`).join(', ')})`
      : '';

    return `
ALVAP WEEKLY SUMMARY
${dateRange.start} to ${dateRange.end}

👥 New Candidates: ${candidates.count}${topSkillsText}
💼 New Jobs: ${jobs.count} (Avg Band ${formatSalaryBand(jobs.avgSalaryBand)})
🔗 Matches Generated: ${matches.count} across ${matches.roles} roles
📈 Pipeline: ${pipeline.interviews} interviews, ${pipeline.offers} offers, ${pipeline.placements} placements
📧 Email: ${email.sent} sent, ${email.bounced} bounced, ${email.unsubscribed} unsubscribed

View full analytics: ${process.env.FRONTEND_URL || 'https://alvap-mvp-production.up.railway.app'}/analytics

Generated by AlvaP System • ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
`.trim();
  }

  async getDigestRecipients() {
    try {
      if (!this.db) {
        // Fallback for in-memory mode
        return [
          { email: process.env.ADMIN_EMAIL || 'admin@alvap.com', name: 'Admin' }
        ];
      }

      const result = await this.db.query(`
        SELECT email, name, role
        FROM users 
        WHERE email_ok = true 
        AND (role = 'admin' OR role = 'consultant')
        ORDER BY role DESC, name ASC
      `);

      return result.rows.map(row => ({
        email: row.email,
        name: row.name || 'User',
        role: row.role
      }));
    } catch (error) {
      console.error('📊 Error getting digest recipients:', error);
      // Fallback to admin email
      return [
        { email: process.env.ADMIN_EMAIL || 'admin@alvap.com', name: 'Admin' }
      ];
    }
  }

  async sendDigestEmail(recipients, subject, html, text) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.emailService.sendEmail({
          to: recipient.email,
          subject: subject,
          html: html,
          text: text,
          from: process.env.FROM_EMAIL || 'noreply@alvap.com'
        });
        
        results.push({ 
          email: recipient.email, 
          success: true, 
          messageId: result.messageId || 'unknown' 
        });
        
        console.log(`📊 Digest sent to ${recipient.email} (${recipient.role})`);
      } catch (error) {
        console.error(`📊 Failed to send digest to ${recipient.email}:`, error.message);
        results.push({ 
          email: recipient.email, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  async sendWeeklyDigest() {
    if (this.isRunning) {
      console.log('📊 Weekly digest already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('📊 Generating weekly digest...');
      
      // Generate digest data
      const digestData = await this.generateDigestSummary();
      
      // Get recipients
      const recipients = await this.getDigestRecipients();
      
      if (recipients.length === 0) {
        console.log('📊 No recipients found for weekly digest');
        return;
      }

      // Render email content
      const subject = `AlvaP Weekly Summary – ${digestData.dateRange.start} to ${digestData.dateRange.end}`;
      const html = this.renderDigestHTML(digestData);
      const text = this.renderDigestText(digestData);

      // Send emails
      console.log(`📊 Sending digest to ${recipients.length} recipients...`);
      const results = await this.sendDigestEmail(recipients, subject, html, text);
      
      // Log results
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      this.lastSent = new Date().toISOString();
      
      const duration = Date.now() - startTime;
      console.log(`📊 Weekly digest completed in ${duration}ms - Sent: ${successful}, Failed: ${failed}`);
      
      return {
        success: true,
        sent: successful,
        failed: failed,
        duration: duration,
        recipients: results
      };
      
    } catch (error) {
      console.error('📊 Weekly digest failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      lastSent: this.lastSent,
      isRunning: this.isRunning
    };
  }
}

module.exports = WeeklyDigestService;
