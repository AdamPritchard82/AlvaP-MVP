const { Resend } = require('resend');
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'resend';
    this.apiKey = process.env.EMAIL_API_KEY;
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@alvap.com';
    this.baseUrl = process.env.FRONTEND_URL || 'https://alvap-mvp-production.up.railway.app';
    
    this.initializeProvider();
  }

  initializeProvider() {
    switch (this.provider.toLowerCase()) {
      case 'resend':
        if (!this.apiKey) {
          console.warn('⚠️ EMAIL_API_KEY not set for Resend');
          return;
        }
        this.resend = new Resend(this.apiKey);
        break;
        
      case 'mailgun':
        if (!this.apiKey) {
          console.warn('⚠️ EMAIL_API_KEY not set for Mailgun');
          return;
        }
        this.mailgun = nodemailer.createTransporter({
          service: 'mailgun',
          auth: {
            user: 'api',
            pass: this.apiKey
          }
        });
        break;
        
      case 'sendgrid':
        if (!this.apiKey) {
          console.warn('⚠️ EMAIL_API_KEY not set for SendGrid');
          return;
        }
        this.sendgrid = nodemailer.createTransporter({
          service: 'sendgrid',
          auth: {
            user: 'apikey',
            pass: this.apiKey
          }
        });
        break;
        
      default:
        console.warn(`⚠️ Unknown email provider: ${this.provider}`);
    }
  }

  async sendWelcomeEmail(candidate) {
    if (!this.apiKey) {
      console.log('📧 Email service not configured, skipping welcome email');
      return { success: false, reason: 'Email service not configured' };
    }

    const unsubscribeToken = candidate.unsubscribe_token || this.generateUnsubscribeToken();
    const unsubscribeUrl = `${this.baseUrl}/unsubscribe?token=${unsubscribeToken}`;
    
    const emailData = {
      to: candidate.email,
      from: this.fromEmail,
      subject: `Welcome to AlvaP, ${candidate.firstName}!`,
      html: this.generateWelcomeEmailHTML(candidate, unsubscribeUrl),
      text: this.generateWelcomeEmailText(candidate, unsubscribeUrl)
    };

    try {
      let result;
      
      switch (this.provider.toLowerCase()) {
        case 'resend':
          result = await this.resend.emails.send(emailData);
          break;
          
        case 'mailgun':
        case 'sendgrid':
          result = await this.sendViaNodemailer(emailData);
          break;
          
        default:
          throw new Error(`Unsupported email provider: ${this.provider}`);
      }

      console.log(`📧 Welcome email sent to ${candidate.email}:`, result);
      return { success: true, result };
      
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendViaNodemailer(emailData) {
    const transporter = this.mailgun || this.sendgrid;
    return await transporter.sendMail(emailData);
  }

  generateWelcomeEmailHTML(candidate, unsubscribeUrl) {
    const skills = Object.entries(candidate.skills || {})
      .filter(([_, hasSkill]) => hasSkill)
      .map(([skill, _]) => skill.charAt(0).toUpperCase() + skill.slice(1))
      .join(', ');

    const salaryRange = candidate.salaryMin && candidate.salaryMax 
      ? `£${candidate.salaryMin.toLocaleString()} - £${candidate.salaryMax.toLocaleString()}`
      : candidate.salaryMin 
        ? `£${candidate.salaryMin.toLocaleString()}+`
        : candidate.salaryMax
          ? `Up to £${candidate.salaryMax.toLocaleString()}`
          : 'Not specified';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to AlvaP</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .skill-tag { background: #E0E7FF; color: #3730A3; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin: 2px; display: inline-block; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
          .unsubscribe { color: #6b7280; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to AlvaP!</h1>
          <p>Your profile has been added to our talent network</p>
        </div>
        
        <div class="content">
          <h2>Hello ${candidate.firstName}!</h2>
          
          <p>Thank you for joining the AlvaP talent network. We've successfully added your profile to our database with the following information:</p>
          
          <h3>Your Profile Summary</h3>
          <ul>
            <li><strong>Name:</strong> ${candidate.firstName} ${candidate.lastName}</li>
            <li><strong>Email:</strong> ${candidate.email}</li>
            <li><strong>Phone:</strong> ${candidate.phone || 'Not provided'}</li>
            <li><strong>Current Role:</strong> ${candidate.currentTitle || 'Not specified'}</li>
            <li><strong>Current Employer:</strong> ${candidate.currentEmployer || 'Not specified'}</li>
            <li><strong>Salary Range:</strong> ${salaryRange}</li>
          </ul>
          
          ${skills ? `
          <h3>Your Skills</h3>
          <p>We've identified the following skills in your profile:</p>
          <div>
            ${skills.split(', ').map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
          </div>
          ` : ''}
          
          <h3>What Happens Next?</h3>
          <p>Our team will review your profile and may contact you about relevant opportunities that match your skills and experience. We'll keep you updated on any developments.</p>
          
          <p>If you have any questions or need to update your profile, please don't hesitate to reach out to us.</p>
          
          <p>Best regards,<br>The AlvaP Team</p>
        </div>
        
        <div class="footer">
          <p>This email was sent to ${candidate.email} because your profile was added to the AlvaP talent network.</p>
          <p><a href="${unsubscribeUrl}" class="unsubscribe">Unsubscribe from future emails</a></p>
        </div>
      </body>
      </html>
    `;
  }

  generateWelcomeEmailText(candidate, unsubscribeUrl) {
    const skills = Object.entries(candidate.skills || {})
      .filter(([_, hasSkill]) => hasSkill)
      .map(([skill, _]) => skill.charAt(0).toUpperCase() + skill.slice(1))
      .join(', ');

    const salaryRange = candidate.salaryMin && candidate.salaryMax 
      ? `£${candidate.salaryMin.toLocaleString()} - £${candidate.salaryMax.toLocaleString()}`
      : candidate.salaryMin 
        ? `£${candidate.salaryMin.toLocaleString()}+`
        : candidate.salaryMax
          ? `Up to £${candidate.salaryMax.toLocaleString()}`
          : 'Not specified';

    return `
Welcome to AlvaP!

Hello ${candidate.firstName}!

Thank you for joining the AlvaP talent network. We've successfully added your profile to our database with the following information:

YOUR PROFILE SUMMARY
- Name: ${candidate.firstName} ${candidate.lastName}
- Email: ${candidate.email}
- Phone: ${candidate.phone || 'Not provided'}
- Current Role: ${candidate.currentTitle || 'Not specified'}
- Current Employer: ${candidate.currentEmployer || 'Not specified'}
- Salary Range: ${salaryRange}

${skills ? `YOUR SKILLS\nWe've identified the following skills in your profile: ${skills}\n` : ''}

WHAT HAPPENS NEXT?
Our team will review your profile and may contact you about relevant opportunities that match your skills and experience. We'll keep you updated on any developments.

If you have any questions or need to update your profile, please don't hesitate to reach out to us.

Best regards,
The AlvaP Team

---
This email was sent to ${candidate.email} because your profile was added to the AlvaP talent network.
Unsubscribe: ${unsubscribeUrl}
    `;
  }

  generateUnsubscribeToken() {
    return require('nanoid').nanoid(32);
  }

  async handleBounceWebhook(webhookData) {
    // Handle bounce/out-of-office webhooks
    // This would be called by webhook endpoints
    console.log('📧 Bounce webhook received:', webhookData);
    
    // Update candidate status based on bounce type
    const { email, event, reason } = webhookData;
    
    if (event === 'bounce' || event === 'complaint') {
      // Mark email as invalid
      return { action: 'mark_email_invalid', email, reason };
    } else if (event === 'out_of_office') {
      // Mark as OOO (could be temporary)
      return { action: 'mark_ooo', email, reason };
    }
    
    return { action: 'no_action', email, reason };
  }

  getServiceInfo() {
    return {
      provider: this.provider,
      configured: !!this.apiKey,
      fromEmail: this.fromEmail,
      baseUrl: this.baseUrl
    };
  }
}

module.exports = EmailService;
