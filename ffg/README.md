# FFG Offshore Risk Solution — Client Calculator

Static page at [https://thornbird97.com/ffg/](https://thornbird97.com/ffg/).

`index.html`, `styles.css` and `app.js` are the calculator. `config.js` holds the lead endpoint. Logos are `logo-ffg.png`, `logo-cfo.png` and `logo-thornbird.png`.

## Consultation form

Submissions are appended to a Google Sheet by an Apps Script web app.

The sheet already has these headers in row 1, in this order:

`Timestamp, Name, Company, Role, Email, Phone, Structure, Premium, Risks, Message, Consent, Page`

1. Open the sheet.
2. **Extensions → Apps Script**.
3. Replace the script with `ffg/apps-script/Code.gs` and save.
4. **Deploy → New deployment → Web app**.
5. Execute as **Me**. Who has access: **Anyone**.
6. Copy the web app URL (it ends in `/exec`).
7. Paste it into `ffg/config.js` as `LEAD_ENDPOINT`, in place of `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE`, and publish the site.

While that placeholder is still in `config.js`, the form does not call out. It shows “Enquiries are temporarily unavailable.”

The browser sends JSON with `fetch`, `mode: "no-cors"` and `Content-Type: text/plain`, which is what Apps Script accepts from another site. Rows are appended to the first sheet. A filled honeypot is ignored and no row is written.

After any later change to `Code.gs`, deploy a new version. An existing deployment keeps serving the old script until you do.
