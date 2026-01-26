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

function getTokenPath() {
  const tokenPath = path.join(app.getPath('userData'), 'google-token.json');
  console.log('[google-calendar] Token path:', tokenPath);
  return tokenPath;
}

/**
 * Initialize Google Calendar API with stored credentials
 */
async function initializeGoogleCalendar(credentials) {
  try {
    console.log('[google-calendar] Initializing Google Calendar API...');

    // Create OAuth2 client
    const { client_id, client_secret } = credentials.installed || credentials.web;

    // Get redirect URI from credentials or default to OOB
    const redirect_uri = (credentials.installed && credentials.installed.redirect_uris && credentials.installed.redirect_uris[0]) ||
      (credentials.web && credentials.web.redirect_uris && credentials.web.redirect_uris[0]) ||
      'urn:ietf:wg:oauth:2.0:oob';

    oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uri
    );
    console.log('[google-calendar] OAuth2 client created');

    // Load previously saved token if it exists
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      console.log('[google-calendar] Loading existing token from:', tokenPath);
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      oauth2Client.setCredentials(token);
      console.log('[google-calendar] Token loaded successfully');
    } else {
      console.log('[google-calendar] No token found at:', tokenPath);
    }

    // Initialize calendar API
    calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    console.log('[google-calendar] Calendar API initialized');

    return { ok: true };
  } catch (error) {
    console.error('[google-calendar] Initialization error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Get OAuth2 authorization URL for user to grant permissions
 */
function getAuthUrl() {
  if (!oauth2Client) {
    return null;
  }

  const SCOPES = ['https://www.googleapis.com/auth/calendar'];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
async function getTokenFromCode(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save token for future use
    const tokenPath = getTokenPath();
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

    return { ok: true, tokens };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Check if we have valid credentials and token
 */
function isAuthenticated() {
  if (!oauth2Client) return false;

  const credentials = oauth2Client.credentials;
  if (!credentials || !credentials.access_token) return false;

  // Check if token is expired
  if (credentials.expiry_date && credentials.expiry_date <= Date.now()) {
    // Token expired, but we might have refresh token
    return credentials.refresh_token ? true : false;
  }

  return true;
}

/**
 * List user's calendars
 */
async function listCalendars() {
  try {
    if (!isAuthenticated()) {
      return { ok: false, error: 'Not authenticated' };
    }

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

/**
 * Check for duplicate events in the calendar
 */
async function findDuplicateEvents({ calendarId, title, startDateTime, endDateTime }) {
  try {
    if (!isAuthenticated()) {
      return { ok: false, error: 'Not authenticated' };
    }

    // Search for events with same title in the time range
    const response = await calendar.events.list({
      calendarId,
      timeMin: startDateTime,
      timeMax: endDateTime,
      q: title, // Search query
      singleEvents: true,
    });

    const matchingEvents = response.data.items || [];
    return { ok: true, events: matchingEvents };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Create or update a calendar event
 */
async function upsertGoogleEvent({ calendarId, eventId, title, description, startDateTime, endDateTime }) {
  try {
    if (!isAuthenticated()) {
      return { ok: false, error: 'Not authenticated' };
    }

    const event = {
      summary: title,
      description: description || '',
      start: {
        dateTime: startDateTime,
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/New_York',
      },
    };

    let result;

    if (eventId) {
      // Update existing event
      try {
        result = await calendar.events.update({
          calendarId,
          eventId,
          requestBody: event,
        });
        return { ok: true, eventId: result.data.id, action: 'updated' };
      } catch (updateError) {
        // Event might not exist, create new one
        if (updateError.code === 404) {
          console.log(`[upsertGoogleEvent] Event ${eventId} not found (404), creating new event`);
          result = await calendar.events.insert({
            calendarId,
            requestBody: event,
          });
          return { ok: true, eventId: result.data.id, action: 'created' };
        }
        throw updateError;
      }
    } else {
      // Before creating, check for duplicates
      const dupCheck = await findDuplicateEvents({
        calendarId,
        title,
        startDateTime,
        endDateTime
      });

      if (dupCheck.ok && dupCheck.events.length > 0) {
        console.log(`[upsertGoogleEvent] Found ${dupCheck.events.length} existing event(s) matching "${title}" at ${startDateTime}`);
        // Use the first matching event instead of creating duplicate
        const existingEvent = dupCheck.events[0];
        console.log(`[upsertGoogleEvent] Updating existing event ${existingEvent.id} instead of creating duplicate`);
        result = await calendar.events.update({
          calendarId,
          eventId: existingEvent.id,
          requestBody: event,
        });
        return { ok: true, eventId: result.data.id, action: 'updated' };
      }

      // Create new event
      result = await calendar.events.insert({
        calendarId,
        requestBody: event,
      });
      return { ok: true, eventId: result.data.id, action: 'created' };
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Delete a calendar event
 */
async function deleteGoogleEvent({ calendarId, eventId }) {
  try {
    if (!isAuthenticated()) {
      return { ok: false, error: 'Not authenticated' };
    }

    if (!eventId) {
      return { ok: true }; // Nothing to delete
    }

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return { ok: true };
  } catch (error) {
    // 404 means event already deleted, that's ok
    if (error.code === 404) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
}

/**
 * Save Google credentials (from setup)
 */
function saveCredentials(credentials) {
  try {
    const credentialsPath = getCredentialsPath();
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Load saved credentials
 */
function loadCredentials() {
  try {
    // Check environment variables first
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      console.log('[google-calendar] Using credentials from environment variables');
      const credentials = {
        installed: {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uris: [process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob']
        }
      };
      return { ok: true, credentials };
    }

    const credentialsPath = getCredentialsPath();
    if (fs.existsSync(credentialsPath)) {
      console.log('[google-calendar] Loading credentials from file:', credentialsPath);
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      return { ok: true, credentials };
    }
    return { ok: false, error: 'No credentials found. Please set GOOGLE_CLIENT_ID/SECRET in .env or upload credentials.json.' };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Revoke access and delete tokens
 */
async function revokeAccess() {
  try {
    if (oauth2Client && oauth2Client.credentials.access_token) {
      await oauth2Client.revokeCredentials();
    }

    // Delete token file
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }

    oauth2Client = null;
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
  isAuthenticated,
  listCalendars,
  upsertGoogleEvent,
  deleteGoogleEvent,
  findDuplicateEvents,
  saveCredentials,
  loadCredentials,
  revokeAccess
};
