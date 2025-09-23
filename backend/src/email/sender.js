import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { getDb } from '../db.js';

export function createTransport(userId = null) {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  
  // Try OAuth first if user provided
  if (userId && (provider === 'gmail' || provider === 'microsoft')) {
    const db = getDb();
    const token = db.prepare(`
      SELECT * FROM oauth_tokens 
      WHERE user_id = ? AND provider = ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, provider);
    
    if (token) {
      if (provider === 'gmail') {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({
          access_token: token.access_token,
          refresh_token: token.refresh_token
        });
        return nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            refreshToken: token.refresh_token,
            accessToken: token.access_token
          }
        });
      }
      
      if (provider === 'microsoft') {
        return nodemailer.createTransporter({
          host: 'smtp.office365.com',
          port: 587,
          secure: false,
          auth: {
            type: 'OAuth2',
            user: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            refreshToken: token.refresh_token,
            accessToken: token.access_token
          }
        });
      }
    }
  }
  
  // Fallback to SMTP
  if (provider === 'gmail') {
    return nodemailer.createTransporter({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }
  if (provider === 'microsoft') {
    return nodemailer.createTransporter({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }
  // Generic SMTP
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

export async function sendEmail({ from, to, subject, html, text, userId = null }) {
  const transporter = createTransport(userId);
  const info = await transporter.sendMail({ from, to, subject, html, text });
  return { messageId: info.messageId };
}




