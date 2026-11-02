/**
 * FFG Offshore Risk Solution — consultation enquiries.
 *
 * Deploy as a web app (execute as me, access Anyone). The page posts JSON
 * as text/plain. doPost appends one row to the first sheet.
 *
 * Row 1 is assumed to already contain:
 * Timestamp, Name, Company, Role, Email, Phone, Structure, Premium, Risks,
 * Message, Consent, Page
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);
    if (Object.prototype.toString.call(data) !== "[object Object]") {
      return json_({ ok: false });
    }

    var trap = String(data.honeypot || data.website || "").replace(/^\s+|\s+$/g, "");
    if (trap) return json_({ ok: true });

    locked = lock.tryLock(10000);
    if (!locked) return json_({ ok: false });

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    sheet.appendRow([
      clip_(data.timestamp, 80) || new Date().toISOString(),
      clip_(data.name, 300),
      clip_(data.company, 300),
      clip_(data.role, 300),
      clip_(data.email, 300),
      clip_(data.phone, 80),
      clip_(data.structure, 120),
      clip_(data.premium, 80),
      clip_(data.risks, 2000),
      clip_(data.message, 5000),
      clip_(data.consent, 40),
      clip_(data.page, 500)
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput("FFG lead endpoint is live.");
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function clip_(value, max) {
  var s = value == null ? "" : String(value);
  return s.length > max ? s.substring(0, max) : s;
}
