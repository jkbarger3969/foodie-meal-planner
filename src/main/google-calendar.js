const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const crypto = require('crypto');

/**
 * Google Calendar Integration for Foodie Meal Planner (PKCE Flow)
 * 
 * Uses "Public Client" mode (PKCE) for secure desktop authentication.
 * No Client Secret is required or stored.
 */

// Production Client ID (Safe to embed for Native Apps)
const CLIENT_ID = '539306512404-f6cphplmmlqf1ldakkgvuobq6gbrpq84.apps.googleusercontent.com';
const REDIRECT_URI = 'http://localhost:12500'; // Loopback IP for desktop auth

let oauth2Client = null;
let calendar = null;
let currentCodeVerifier = null; // Stored temporarily during login flow

// Path for storing the session token (NOT keys)
function getTokenPath() {
  const tokenPath = path.join(app.getPath('userData'), 'google-token.json');
  return tokenPath;
}

/**
 * Generate PKCE Code Verifier
 */
function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

/**
 * Initialize Google Calendar API
 * Now simpler: Just needs the token, no "credentials file".
 */
function initializeGoogleCalendar() {
  try {
    if (oauth2Client) return { ok: true };

    console.log('[google-calendar] Initializing PKCE Client...');

    oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      null, // No Client Secret for PKCE
      REDIRECT_URI
    );

    // Load existing token
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      console.log('[google-calendar] Loading existing token...');
      try {
        const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        oauth2Client.setCredentials(token);
      } catch (e) {
        console.error('[google-calendar] Failed to parse token:', e);
      }
    } else {
      console.log('[google-calendar] No existing token found.');
    }

    calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    return { ok: true };
  } catch (error) {
    console.error('[google-calendar] Init error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Step 1: Get Auth URL with PKCE Challenge
 */
function getAuthUrl() {
  // Ensure initialized
  initializeGoogleCalendar();

  // 1. Generate Verifier
  const verifier = base64URLEncode(crypto.randomBytes(32));
  currentCodeVerifier = verifier;

  // 2. Generate Challenge
  const challenge = base64URLEncode(sha256(verifier));

  const SCOPES = ['https://www.googleapis.com/auth/calendar'];

  // 3. Create URL
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'consent'
  });
}

/**
 * Step 2: Exchange Code + Verifier for Token
 */
async function getTokenFromCode(code) {
  try {
    if (!currentCodeVerifier) {
      // Try to recover if verifier is lost (e.g. app restart during flow)
      // For now, fail safely
      console.warn('[google-calendar] No PKCE verifier found. Flow restarted?');
      // In a strict PKCE flow we should fail. But user might have pasted code manually after restart.
      // We can't proceed without verifier because Google will reject it.
      // However, if the code is from a non-PKCE flow (legacy), it might work? No, we used code_challenge in URL.
      // We will proceed and let Google reject it if invalid.
    }

    // Ensure client exists
    initializeGoogleCalendar();

    // Exchange using the verifier we generated earlier
    // Note: If currentCodeVerifier is null, this might fail unless googleapis handles it.
    const { tokens } = await oauth2Client.getToken({
      code,
      codeVerifier: currentCodeVerifier
    });

    oauth2Client.setCredentials(tokens);
    currentCodeVerifier = null; // Clear sensitive verifier

    // Save token
    const tokenPath = getTokenPath();
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

    return { ok: true, tokens };
  } catch (error) {
    console.error('Token Exchange Error:', error);
    return { ok: false, error: error.message };
  }
}

function isAuthenticated() {
  if (!oauth2Client) return false;
  const credentials = oauth2Client.credentials;
  if (!credentials || !credentials.access_token) return false;

  // Check expiration
  if (credentials.expiry_date && credentials.expiry_date <= Date.now() + 60000) {
    // If expired but has refresh token, we consider it "authenticated" 
    // because the library will auto-refresh on request
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
      end: { dateTime: params.endDateTime, timeZone: 'America/New_York' }
    };

    if (params.eventId) {
      try {
        const result = await calendar.events.update({
          calendarId: params.calendarId,
          eventId: params.eventId,
          requestBody: event
        });
        return { ok: true, eventId: result.data.id, action: 'updated' };
      } catch (err) {
        if (err.code === 404) {
          const result = await calendar.events.insert({ calendarId: params.calendarId, requestBody: event });
          return { ok: true, eventId: result.data.id, action: 'created' };
        }
        throw err;
      }
    } else {
      // Check dupes
      const dupCheck = await findDuplicateEvents({
        calendarId: params.calendarId,
        title: params.title,
        startDateTime: params.startDateTime,
        endDateTime: params.endDateTime
      });

      if (dupCheck.ok && dupCheck.events && dupCheck.events.length > 0) {
        const result = await calendar.events.update({
          calendarId: params.calendarId,
          eventId: dupCheck.events[0].id,
          requestBody: event
        });
        return { ok: true, eventId: result.data.id, action: 'updated' };
      }

      const result = await calendar.events.insert({ calendarId: params.calendarId, requestBody: event });
      return { ok: true, eventId: result.data.id, action: 'created' };
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function deleteGoogleEvent({ calendarId, eventId }) {
  if (!isAuthenticated()) return { ok: false, error: 'Not authenticated' };
  if (!eventId) return { ok: true };
  try {
    await calendar.events.delete({ calendarId, eventId });
    return { ok: true };
  } catch (e) {
    return e.code === 404 ? { ok: true } : { ok: false, error: e.message };
  }
}

async function revokeAccess() {
  try {
    if (oauth2Client) await oauth2Client.revokeCredentials();
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    oauth2Client = null;
    calendar = null;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Deprecated functions (safe no-ops)
function saveCredentials() { return { ok: true }; }
function loadCredentials() { return { ok: true }; }

module.exports = {
  initializeGoogleCalendar,
  getAuthUrl,
  getTokenFromCode,
  isAuthenticated,
  listCalendars,
  upsertGoogleEvent,
  deleteGoogleEvent,
  findDuplicateEvents,
  revokeAccess,
  saveCredentials,
  loadCredentials
};
