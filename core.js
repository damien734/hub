// Shared login + database helpers for the app pages (grain.html, chemicals.html).
import { firebaseConfig, OWNER_EMAILS } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const fb = initializeApp(firebaseConfig);
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
          return resolve({ uid: user.uid, email: user.email, name: user.email.split("@")[0], role: "admin" });
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
