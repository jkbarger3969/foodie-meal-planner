const { execFile } = require('child_process');

function runAppleScript(script) {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/osascript', ['-e', script], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error((stderr || stdout || err.message || '').trim() || 'AppleScript failed'));
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });
}

/**
 * Upsert (create/update) a Calendar event for a given slot on a date.
 * We store and use the event's uid for future updates/deletes.
 *
 * Note: Apple Calendar may prompt the user for automation permission the first time.
 */
async function upsertEvent({ calendarName, uid, title, description, startIso, endIso }) {
  const esc = (s) => String(s || '').replace(/\\/g,'\\\\').replace(/"/g,'\\"');

  // AppleScript: find calendar by name; if uid exists update; else create
  const script = `
  set calName to "${esc(calendarName)}"
  set evUid to "${esc(uid)}"
  set evTitle to "${esc(title)}"
  set evDesc to "${esc(description)}"
  set startDate to date "${esc(startIso)}"
  set endDate to date "${esc(endIso)}"

  tell application "Calendar"
    set theCal to first calendar whose name is calName

    if evUid is not "" then
      set matches to (every event of theCal whose uid is evUid)
      if (count of matches) > 0 then
        set ev to item 1 of matches
        set summary of ev to evTitle
        set description of ev to evDesc
        set start date of ev to startDate
        set end date of ev to endDate
        return uid of ev
      end if
    end if

    set evNew to make new event at theCal with properties {summary:evTitle, description:evDesc, start date:startDate, end date:endDate}
    return uid of evNew
  end tell
  `;
  return await runAppleScript(script);
}

async function deleteEvent({ calendarName, uid }) {
  if (!uid) return;
  const esc = (s) => String(s || '').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  const script = `
  set calName to "${esc(calendarName)}"
  set evUid to "${esc(uid)}"
  tell application "Calendar"
    set theCal to first calendar whose name is calName
    set matches to (every event of theCal whose uid is evUid)
    if (count of matches) > 0 then
      delete item 1 of matches
    end if
  end tell
  `;
  await runAppleScript(script);
}

module.exports = { upsertEvent, deleteEvent };
