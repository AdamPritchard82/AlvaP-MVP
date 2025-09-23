import { Router } from 'express';
import { google } from 'googleapis';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

const router = Router();

// Gmail OAuth setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/oauth/gmail/callback'
);

// Microsoft OAuth setup
const microsoftConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:4000/api/oauth/microsoft/callback',
  scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read'
};

// Get OAuth URL for Gmail
router.get('/gmail/auth', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'];
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: req.user?.userId || 'anonymous'
  });
  res.json({ authUrl });
});

// Gmail OAuth callback
router.get('/gmail/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'No authorization code' });
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    const db = getDb();
    const now = new Date().toISOString();
    
    // Store tokens
    const id = nanoid();
    db.prepare(`
      INSERT OR REPLACE INTO oauth_tokens (id, user_id, provider, access_token, refresh_token, expires_at, created_at, updated_at)
      VALUES (@id, @user_id, 'gmail', @access_token, @refresh_token, @expires_at, @created_at, @updated_at)
    `).run({
      id,
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      created_at: now,
      updated_at: now
    });
    
    res.json({ success: true, message: 'Gmail connected successfully' });
  } catch (error) {
    console.error('Gmail OAuth error:', error);
    res.status(500).json({ error: 'OAuth failed' });
  }
});

// Get OAuth URL for Microsoft
router.get('/microsoft/auth', (req, res) => {
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${microsoftConfig.clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(microsoftConfig.redirectUri)}&` +
    `scope=${encodeURIComponent(microsoftConfig.scope)}&` +
    `state=${req.user?.userId || 'anonymous'}`;
  res.json({ authUrl });
});

// Microsoft OAuth callback
router.get('/microsoft/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'No authorization code' });
  
  try {
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: microsoftConfig.clientId,
        client_secret: microsoftConfig.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: microsoftConfig.redirectUri
      })
    });
    
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) throw new Error('No access token');
    
    const db = getDb();
    const now = new Date().toISOString();
    const expiresAt = tokens.expires_in ? 
      new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    
    const id = nanoid();
    db.prepare(`
      INSERT OR REPLACE INTO oauth_tokens (id, user_id, provider, access_token, refresh_token, expires_at, created_at, updated_at)
      VALUES (@id, @user_id, 'microsoft', @access_token, @refresh_token, @expires_at, @created_at, @updated_at)
    `).run({
      id,
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now
    });
    
    res.json({ success: true, message: 'Microsoft 365 connected successfully' });
  } catch (error) {
    console.error('Microsoft OAuth error:', error);
    res.status(500).json({ error: 'OAuth failed' });
  }
});

// Get user's connected providers
router.get('/providers', (req, res) => {
  const db = getDb();
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const providers = db.prepare(`
    SELECT provider, expires_at, created_at
    FROM oauth_tokens 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);
  
  res.json(providers);
});

export default router;








