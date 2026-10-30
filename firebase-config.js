// =====================================================================
//  GUNNADOO COMMAND CENTRE — SETUP FILE (the only file you need to edit)
// =====================================================================

// 1) Paste the firebaseConfig values from:
//    Firebase console > Project settings > General > Your apps > Web app
export const firebaseConfig = {
  apiKey: "AIzaSyCaugz_d8yhZTHVDK66S7zTuBEXu6E6trg",
  authDomain: "gunnadoo-hub.firebaseapp.com",
  projectId: "gunnadoo-hub",
  storageBucket: "gunnadoo-hub.firebasestorage.app",
  messagingSenderId: "696460732539",
  appId: "1:696460732539:web:4d4d6a9490103cb9f39ade"
};

// 2) The two owner/admin emails, all lower case.
//    These MUST match the list at the top of firestore.rules.
export const OWNER_EMAILS = [
  "damschneider@hotmail.com",
  "c_micko17@hotmail.com"
];

// Display names for the two owners (shown in the apps instead of the email).
export const OWNER_NAMES = {
  "damschneider@hotmail.com": "Damo",
  "c_micko17@hotmail.com": "Carissa"
};

// 3) Docket / invoice scanning (Gemini via Firebase AI Logic).
//    Paste the reCAPTCHA Enterprise SITE key here (NOT a secret, safe to be public).
//    Leave empty ("") and the Scan buttons simply stay hidden.
export const RECAPTCHA_SITE_KEY = "6LcqAgguAAAAAFriiHqXtJuJ_qM7arEk_W--JO0K";
