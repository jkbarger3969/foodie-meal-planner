const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const { app, shell, BrowserWindow } = require('electron');
const crypto = require('crypto');

/**
 * Google Calendar Integration for Foodie Meal Planner (PKCE Flow with Loopback)
 * 
 * Uses "Desktop app" OAuth client with PKCE for secure authentication.
 * For desktop apps, Google automatically allows http://127.0.0.1 and http://localhost redirects.
 */

// Production Client ID - Must be a "Desktop app" type in Google Cloud Console
const CLIENT_ID = '539306512404-f6cphplmmlqf1ldakkgvuobq6gbrpq84.apps.googleusercontent.com';

let oauth2Client = null;
let calendar = null;
let currentCodeVerifier = null;
let callbackServer = null;
let callbackPort = null;
let authResolve = null;
let authReject = null;

function getTokenPath() {
  return path.join(app.getPath('userData'), 'google-token.json');
}

function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

function initializeGoogleCalendar() {
  try {
    if (oauth2Client) return { ok: true };

    console.log('[google-calendar] Initializing OAuth client...');

    // For desktop apps, we set redirect_uri dynamically after finding an available port
    oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      null, // No client secret for desktop apps with PKCE
      'http://127.0.0.1' // Placeholder, will be set with actual port
    );

    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      console.log('[google-calendar] Loading existing token...');
      try {
        const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        oauth2Client.setCredentials(token);
      } catch (e) {
        console.error('[google-calendar] Failed to parse token:', e);
      }
    }

    calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    return { ok: true };
  } catch (error) {
    console.error('[google-calendar] Init error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Find an available port for the callback server
 */
function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

/**
 * Start local HTTP server to capture OAuth callback
 */
async function startCallbackServer() {
  return new Promise(async (resolve, reject) => {
    try {
      // Close existing server if any
      if (callbackServer) {
        callbackServer.close();
        callbackServer = null;
      }

      // Find an available port
      callbackPort = await findAvailablePort();
      console.log(`[google-calendar] Using port ${callbackPort} for OAuth callback`);

      callbackServer = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/callback' || parsedUrl.pathname === '/') {
          const code = parsedUrl.query.code;
          const error = parsedUrl.query.error;

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <!DOCTYPE html>
              <html>
                <head><title>Authorization Failed</title></head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #fff;">
                  <h1 style="color: #ff6b6b;">Authorization Failed</h1>
                  <p>Error: ${error}</p>
                  <p>Please close this window and try again in the app.</p>
                </body>
              </html>
            `);
            
            if (authReject) {
              authReject(new Error(error));
              authReject = null;
              authResolve = null;
            }
            
            setTimeout(() => closeCallbackServer(), 1000);
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <!DOCTYPE html>
              <html>
                <head><title>Authorization Successful</title></head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #fff;">
                  <h1 style="color: #4ecdc4;">Authorization Successful!</h1>
                  <p>Google Calendar has been connected to Foodie Meal Planner.</p>
                  <p>You can close this window and return to the app.</p>
                </body>
              </html>
            `);

            try {
              const result = await exchangeCodeForToken(code);
              if (authResolve) {
                authResolve(result);
                authResolve = null;
                authReject = null;
              }
            } catch (err) {
              console.error('[google-calendar] Token exchange failed:', err);
              if (authReject) {
                authReject(err);
                authReject = null;
                authResolve = null;
              }
            }

            setTimeout(() => closeCallbackServer(), 2000);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body>Missing authorization code</body></html>');
          }
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      callbackServer.on('error', (err) => {
        console.error('[google-calendar] Callback server error:', err);
        reject(err);
      });

      callbackServer.listen(callbackPort, '127.0.0.1', () => {
        console.log(`[google-calendar] Callback server listening on http://127.0.0.1:${callbackPort}`);
        resolve(callbackPort);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function closeCallbackServer() {
  if (callbackServer) {
    callbackServer.close(() => {
      console.log('[google-calendar] Callback server closed');
    });
    callbackServer = null;
  }
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForToken(code) {
  try {
    if (!currentCodeVerifier) {
      console.warn('[google-calendar] No PKCE verifier found');
      return { ok: false, error: 'PKCE verifier missing - please restart authorization' };
    }

    initializeGoogleCalendar();

    // Update the redirect URI to match what we used
    const redirectUri = `http://127.0.0.1:${callbackPort}/callback`;
    
    const { tokens } = await oauth2Client.getToken({
      code,
      codeVerifier: currentCodeVerifier,
      redirect_uri: redirectUri
    });

    oauth2Client.setCredentials(tokens);
    currentCodeVerifier = null;

    const tokenPath = getTokenPath();
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

    console.log('[google-calendar] Token saved successfully');
    return { ok: true, tokens };
  } catch (error) {
    console.error('[google-calendar] Token exchange error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Get Auth URL with PKCE Challenge
 */
function getAuthUrl(port) {
  initializeGoogleCalendar();

  const verifier = base64URLEncode(crypto.randomBytes(32));
  currentCodeVerifier = verifier;

  const challenge = base64URLEncode(sha256(verifier));

  const SCOPES = ['https://www.googleapis.com/auth/calendar'];
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  // For desktop apps, Google allows any port on 127.0.0.1 or localhost
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'consent',
    redirect_uri: redirectUri
  });

  return authUrl;
}

/**
 * Start OAuth flow - opens browser and waits for callback
 */
async function startAuthFlow() {
  try {
    // Start the callback server first
    const port = await startCallbackServer();
    
    // Generate auth URL with the correct port
    const authUrl = getAuthUrl(port);
    
    console.log('[google-calendar] Opening browser for authorization...');
    console.log('[google-calendar] Auth URL:', authUrl);
    
    // Return a promise that resolves when auth completes
    return new Promise((resolve, reject) => {
      authResolve = resolve;
      authReject = reject;
      
      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        if (authReject) {
          authReject(new Error('Authorization timed out after 5 minutes'));
          authReject = null;
          authResolve = null;
          closeCallbackServer();
        }
      }, 5 * 60 * 1000);

      // Open the browser
      shell.openExternal(authUrl).catch(err => {
        console.error('[google-calendar] Failed to open browser:', err);
        clearTimeout(timeout);
        closeCallbackServer();
        reject(err);
      });
    });
  } catch (error) {
    console.error('[google-calendar] Failed to start auth flow:', error);
    closeCallbackServer();
    throw error;
  }
}

/**
 * Manual code submission (fallback)
 */
async function getTokenFromCode(code) {
  return exchangeCodeForToken(code);
}

function isAuthenticated() {
  if (!oauth2Client) {
    initializeGoogleCalendar();
  }
  if (!oauth2Client) return false;
  
  const credentials = oauth2Client.credentials;
  if (!credentials || !credentials.access_token) return false;

  if (credentials.expiry_date && credentials.expiry_date <= Date.now() + 60000) {
    return !!credentials.refresh_token;
  }
  return true;
}

async function listCalendars() {
  try {
    if (!isAuthenticated()) return { ok: false, error: 'Not authenticated' };
    const res = await calendar.calendarList.list();
    return {
      ok: true,
      calendars: res.data.items.map(cal => ({
        id: cal.id,
        name: cal.summary,
        primary: cal.primary || false,
        accessRole: cal.accessRole
      }))
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function findDuplicateEvents({ calendarId, title, startDateTime, endDateTime }) {
  try {
    if (!isAuthenticated()) return { ok: false, error: 'Not authenticated' };
    const response = await calendar.events.list({
      calendarId,
      timeMin: startDateTime,
      timeMax: endDateTime,
      q: title,
      singleEvents: true,
    });
    return { ok: true, events: response.data.items || [] };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function upsertGoogleEvent(params) {
  try {
    if (!isAuthenticated()) return { ok: false, error: 'Not authenticated' };

    const event = {
      summary: params.title,
      description: params.description || '',
      start: { dateTime: params.startDateTime, timeZone: 'America/New_York' },
      end: { dateTime: params.endDateTime, timeZone: 'America/New_York' },
    };

    let res;
    if (params.eventId) {
      res = await calendar.events.update({
        calendarId: params.calendarId,
        eventId: params.eventId,
        requestBody: event
      });
    } else {
      res = await calendar.events.insert({
        calendarId: params.calendarId,
        requestBody: event
      });
    }

    return { ok: true, eventId: res.data.id };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function deleteGoogleEvent({ calendarId, eventId }) {
  try {
    if (!isAuthenticated()) return { ok: false, error: 'Not authenticated' };
    await calendar.events.delete({ calendarId, eventId });
    return { ok: true };
  } catch (error) {
    if (error.code === 404 || error.code === 410) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
}

function revokeToken() {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    if (oauth2Client) {
      oauth2Client.revokeCredentials();
      oauth2Client = null;
    }
    calendar = null;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = {
  initializeGoogleCalendar,
  getAuthUrl,
  getTokenFromCode,
  startAuthFlow,
  isAuthenticated,
  listCalendars,
  findDuplicateEvents,
  upsertGoogleEvent,
  deleteGoogleEvent,
  revokeToken,
};
