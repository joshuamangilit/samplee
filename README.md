# Smart QR Code Attendance System — Prototype

## Requirements
- VS Code
- A modern browser
- Internet connection (the QR libraries and Google Fonts are loaded from CDNs)
- Live Server extension for VS Code (recommended)

## Run the project
1. Extract the ZIP file.
2. Open the `Smart-QR-Attendance` folder in VS Code.
3. Install the **Live Server** extension if you do not have it.
4. Right-click `index.html` and select **Open with Live Server**.
5. The app opens on a localhost address.

## Demo workflow
1. Open **Generate QR**.
2. Enter subject, section, late cutoff and duration.
3. Click **Generate QR code**.
4. Open **Student Scanner** in the same browser and save a demo student ID and name.
5. Scan the QR code using a camera. For same-device testing, display the QR code on another screen and scan it with the device running the app, or use a second camera device pointed at the displayed code.
6. Open **Attendance Records** to see the saved record.

## Important prototype limitations
- Data is stored in browser LocalStorage. It is not shared between different devices or browsers.
- The QR scanner needs camera permission and a secure context (localhost or HTTPS).
- To use different student phones and a teacher computer with shared records, connect Firebase Authentication and Firestore and enforce validation with trusted backend logic / security rules.
- This prototype does not verify student identity; students type their own ID and name.
- The browser clock is used for the demo cutoff calculation. A production system should use trusted server timestamps.
- A QR code can be shared. A production system should consider short-lived tokens, server-side validation, and additional attendance controls.

## Project structure
- `index.html` — application layout
- `css/style.css` — responsive styling
- `js/app.js` — QR generation, scanning, validation and attendance records
