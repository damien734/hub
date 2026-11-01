// Shared login + database helpers for the app pages (grain.html, chemicals.html).
import { firebaseConfig, OWNER_EMAILS, OWNER_NAMES, RECAPTCHA_SITE_KEY } from "./firebase-config.js?v=202611012221";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const fb = initializeApp(firebaseConfig);

// App Check must start before any other Firebase service (Firebase requires it for AI Logic).
let appCheckOn = false;
if (RECAPTCHA_SITE_KEY) {
  try {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } =
      await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js");
    initializeAppCheck(fb, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
    appCheckOn = true;
  } catch (e) { console.error("App Check failed to start", e); }
}
const auth = getAuth(fb);
const fs = getFirestore(fb);

// Resolves with { uid, email, name, role } for a signed-in, approved person.
// Anyone else is sent back to the Command Centre login page.
export function requireMember() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, async (user) => {
      stop();
      const back = () => { location.href = "./"; };
      if (!user || !user.emailVerified) return back();
      try {
        const snap = await getDoc(doc(fs, "users", user.uid));
        if (snap.exists()) return resolve({ uid: user.uid, ...snap.data() });
        if (OWNER_EMAILS.map((e) => e.toLowerCase()).includes(String(user.email).toLowerCase()))
          return resolve({ uid: user.uid, email: user.email, name: OWNER_NAMES?.[String(user.email).toLowerCase()] || user.email.split("@")[0], role: "admin" });
      } catch (e) { console.error(e); }
      back();
    });
  });
}

// Small database helper with the same shape the apps were written against.
// Every collection name gets a prefix (e.g. "grain_") so apps never collide.
export function makeDb(prefix) {
  const wrapDoc = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data() });
  const wrapQuery = (s) => ({ docs: s.docs.map((x) => ({ id: x.id, data: () => x.data() })), size: s.size, empty: s.empty });
  const docApi = (r) => ({
    id: r.id,
    set: (d) => setDoc(r, d),
    update: (d) => updateDoc(r, d),
    delete: () => deleteDoc(r),
    get: async () => wrapDoc(await getDoc(r)),
    onSnapshot: (cb, err) => onSnapshot(r, (s) => cb(wrapDoc(s)), err),
  });
  return {
    doc: (path) => {
      const parts = path.split("/");
      parts[0] = prefix + parts[0];
      return docApi(doc(fs, ...parts));
    },
    collection: (name) => {
      const cr = collection(fs, prefix + name);
      return {
        doc: (id) => docApi(id ? doc(cr, id) : doc(cr)),
        add: (d) => addDoc(cr, d),
        onSnapshot: (cb, err) => onSnapshot(cr, (s) => cb(wrapQuery(s)), err),
      };
    },
  };
}

// Save a generated file (CSV text or Excel bytes) to the person's device.
export const downloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },
};

// ---------- Photo scanning (dockets / invoices) via Gemini ----------
// Same shape the apps were written against: scanner.json(prompt, {images}) and scanner.limits().
const SCAN_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const blobToBase64 = (b) => new Promise((ok, bad) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1]);
  r.onerror = () => bad(r.error);
  r.readAsDataURL(b);
});
// Models tried in order. Names from Firebase's supported-models list (Gemini Developer API).
// gemini-3.5-flash is a stable model with a longer support window; the others are fallbacks
// used when a model is busy ("high demand") or unavailable.
const SCAN_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"];
const busyErr = (msg) => /\b(500|502|503|504|429)\b|high demand|overloaded|unavailable|try again later|exhausted|deadline/i.test(msg);
const goneErr = (msg) => /\b404\b|not found|is not supported|no longer available/i.test(msg);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getScanner() {
  if (!appCheckOn) return null;
  let ai, getGenerativeModel;
  try {
    const mod = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js");
    getGenerativeModel = mod.getGenerativeModel;
    ai = mod.getAI(fb, { backend: new mod.GoogleAIBackend() });
  } catch (e) { console.error("Scanner failed to load", e); return null; }
  const models = {};
  const modelFor = (name) => models[name] || (models[name] = getGenerativeModel(ai, {
    model: name, generationConfig: { responseMimeType: "application/json", temperature: 0 },
  }));
  const json = async (prompt, opts = {}) => {
    const parts = [prompt];
    const imgs = opts.images ? (Array.isArray(opts.images) ? opts.images : [opts.images]) : [];
    for (const img of imgs) {
      parts.push({ inlineData: { mimeType: img.type || "image/jpeg", data: await blobToBase64(img) } });
    }
    let res, lastMsg = "";
    outer: for (const name of SCAN_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try { res = await modelFor(name).generateContent(parts); break outer; }
        catch (e) {
          lastMsg = String(e?.message || e) + (e?.code ? " [" + e.code + "]" : "");
          console.warn("Gemini " + name + " attempt " + (attempt + 1) + " failed", e);
          if (/app.?check|\b403\b|permission/i.test(lastMsg) && !busyErr(lastMsg)) {
            const err = new Error(lastMsg); err.code = "not_granted"; throw err;
          }
          if (goneErr(lastMsg)) break;            // this model isn't available: try the next one
          if (!busyErr(lastMsg)) { const err = new Error(lastMsg); err.code = "error"; throw err; }
          if (attempt === 0) await wait(1500);    // busy: one quick retry, then the next model
        }
      }
    }
    if (!res) {
      const err = new Error("Google's AI is busy right now. Wait a minute and try again. (" + lastMsg.slice(0, 160) + ")");
      err.code = "busy"; throw err;
    }
    let text = "";
    try { text = res.response.text(); }
    catch (e) { const err = new Error("The scanner gave no answer (" + (e?.message || e) + ")"); err.code = "no_answer"; throw err; }
    text = String(text).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    try { return JSON.parse(text); }
    catch (e) {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
      const err = new Error("Reply wasn't readable: " + text.slice(0, 160)); err.code = "bad_reply"; throw err;
    }
  };
  return { json, limits: async () => ({ images: { mediaTypes: SCAN_TYPES, maxCount: 6 } }) };
}
