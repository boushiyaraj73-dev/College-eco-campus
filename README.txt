QR EcoCampus V2 — Multi-page student project
==============================================

FILES
-----
index.html       Dashboard
report.html      Report an Issue form
qr-codes.html    Location QR code generator
issues.html      Issue tracking, filters, status updates, CSV export
locations.html   Campus location directory and report summary
style.css        Shared layout and styling
script.js        Shared app logic and browser storage

HOW TO RUN WITH NOTEPAD
-----------------------
1. Extract QR_EcoCampus_V2.zip into a folder.
2. Open the extracted folder.
3. Right-click any .html file and choose Open with > Notepad to view/edit code.
4. Double-click index.html to start the site in your browser.
5. Use the left sidebar to move between the five pages.

IMPORTANT
---------
- Keep all HTML files, style.css, and script.js in the same folder.
- Save HTML files as type "All Files", not as .txt files.
- Internet is needed for the QRCode.js library and Google Fonts.
- Reports are saved in localStorage in the current browser only. They are not synced to other devices.
- When opened as a local file, a QR code contains a location identifier, not a public URL.
- To make QR codes open the report page on another phone, deploy the site to an HTTPS web host.
- This is a student demo, not a secure production system. There is no real admin login or server database.
- Version 2 uses separate localStorage keys from Version 1 to avoid unexpectedly changing the old demo's data.


UPDATE: OFFICE + TOILET QR REPORTING
------------------------------------
Two locations are now included: College Office (OF-01) and College Toilet / Restroom (TL-01). Each QR generated from the hosted website opens report.html directly, preselects its location, and brings the form into view. Office Issues and Toilet Issues are also available as issue categories.

IMPORTANT FOR PHONE SCANNING
1. Open the project from a public HTTPS hosting URL (not file:// and not localhost).
2. Open QR Codes on that hosted website.
3. Select College Office or College Toilet / Restroom and download the QR PNG.
4. Print and place the matching QR. When scanned, it opens the report form with that location selected.

This project currently stores reports in browser localStorage. That means reports submitted on different phones are NOT automatically visible to one another or to the admin computer. Shared real-world reporting requires a backend/database.
