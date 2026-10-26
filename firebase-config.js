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
