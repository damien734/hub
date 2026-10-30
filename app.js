// Gunnadoo Command Centre — main app.
// Uses Firebase Auth (logins) + Cloud Firestore (data). No build step needed.
import { firebaseConfig, OWNER_EMAILS, OWNER_NAMES } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs,
  query, where, orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);

const ROLES = ["admin", "staff", "family"];
const ROLE_LABEL = { admin: "Admin", staff: "Staff", family: "Family" };
const app = document.getElementById("app");
let me = null; // { uid, email, name, role }

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
const lower = (s) => String(s || "").trim().toLowerCase();
const isAdmin = () => me?.role === "admin";
const canWork = () => me?.role === "admin" || me?.role === "staff";
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
}
function friendlyError(e) {
  const code = e?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "Email or password not right.";
  if (code.includes("email-already-in-use")) return "That email already has an account — use Sign in instead.";
  if (code.includes("weak-password")) return "Password needs at least 6 characters.";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a few minutes and try again.";
  if (code.includes("permission-denied")) return "You don't have permission to do that.";
  return e?.message || "Something went wrong.";
}
const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-AU",
  { day: "numeric", month: "short", year: "numeric" }) : "");

// ---------- auth flow ----------
document.getElementById("signOutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  me = null;
  document.getElementById("topbar").hidden = true;
  if (!user) return renderLogin();
  if (!user.emailVerified) return renderVerify(user);
  try {
    await user.getIdToken(true); // make sure the "verified" flag is fresh
    me = await loadOrCreateProfile(user);
  } catch (e) {
    console.error(e);
    return renderMessage("Couldn't load your account", friendlyError(e), true);
  }
  if (!me) return renderMessage("Not invited yet",
    "Your login works, but Damo or Carissa need to add your email on the Admin page before you can get in. Once they have, sign out and back in.", true);
  document.getElementById("topbar").hidden = false;
  document.getElementById("who").textContent = `${me.name || me.email} · ${ROLE_LABEL[me.role]}`;
  route();
});

async function loadOrCreateProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const email = lower(user.email);
  if (snap.exists()) {
    const p = snap.data();
    const nice = OWNER_NAMES?.[email];
    if (nice && p.name !== nice && p.name === email.split("@")[0]) {
      try { await updateDoc(ref, { name: nice }); p.name = nice; } catch (e) { console.error(e); }
    }
    return { uid: user.uid, ...p };
  }
  if (OWNER_EMAILS.map(lower).includes(email)) {
    const p = { email, name: OWNER_NAMES?.[email] || user.displayName || email.split("@")[0], role: "admin", joined: serverTimestamp() };
    await setDoc(ref, p);
    return { uid: user.uid, ...p };
  }
  const inv = await getDoc(doc(db, "invites", email));
  if (!inv.exists()) return null;
  const p = { email, name: inv.data().name || email.split("@")[0], role: inv.data().role, joined: serverTimestamp() };
  await setDoc(ref, p);
  return { uid: user.uid, ...p };
}

function renderLogin(mode = "signin") {
  const titles = { signin: "Sign in", signup: "First time? Set your password", reset: "Reset password" };
  app.innerHTML = `
  <div class="card auth-card">
    <div class="brand-mark">G</div>
    <h1 class="center">Gunnadoo Command Centre</h1>
    <p class="center muted">${titles[mode]}</p>
    <form id="authForm">
      <label for="em">Email</label>
      <input id="em" type="email" autocomplete="email" required>
      ${mode !== "reset" ? `<label for="pw">Password</label>
      <input id="pw" type="password" minlength="6" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" required>` : ""}
      <p class="err" id="authErr"></p>
      <button class="btn" style="width:100%">${mode === "signin" ? "Sign in" : mode === "signup" ? "Create my login" : "Email me a reset link"}</button>
    </form>
    <p class="center" style="margin-top:16px;font-size:.9rem">
      ${mode !== "signin" ? `<a href="#" data-mode="signin">Back to sign in</a>` :
        `<a href="#" data-mode="signup">First time here?</a> · <a href="#" data-mode="reset">Forgot password?</a>`}
    </p>
  </div>`;
  app.querySelectorAll("[data-mode]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); renderLogin(a.dataset.mode); }));
  document.getElementById("authForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = lower(document.getElementById("em").value);
    const pw = document.getElementById("pw")?.value;
    const err = document.getElementById("authErr");
    err.textContent = "";
    try {
      if (mode === "signin") await signInWithEmailAndPassword(auth, email, pw);
      else if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await sendEmailVerification(cred.user);
      } else {
        await sendPasswordResetEmail(auth, email);
        err.style.color = "var(--brand)";
        err.textContent = "If that email has a login, a reset link is on its way.";
      }
    } catch (ex) { err.textContent = friendlyError(ex); }
  };
}

function renderVerify(user) {
  app.innerHTML = `
  <div class="card auth-card center">
    <div class="brand-mark">G</div>
    <h1>Check your email</h1>
    <p class="muted">We sent a link to <b>${esc(user.email)}</b>. Tap it to confirm your email, then come back and press the button below. (Check junk mail too.)</p>
    <div class="row" style="justify-content:center;margin-top:14px">
      <button class="btn" id="vDone">I've confirmed it</button>
      <button class="btn ghost" id="vResend">Resend email</button>
    </div>
    <p class="err" id="vErr"></p>
    <p style="margin-top:14px"><a href="#" id="vOut">Use a different email</a></p>
  </div>`;
  document.getElementById("vDone").onclick = async () => {
    await user.reload();
    if (auth.currentUser.emailVerified) { await auth.currentUser.getIdToken(true); location.reload(); }
    else document.getElementById("vErr").textContent = "Not confirmed yet — tap the link in the email first.";
  };
  document.getElementById("vResend").onclick = async () => {
    try { await sendEmailVerification(user); toast("Email sent"); }
    catch (e) { document.getElementById("vErr").textContent = friendlyError(e); }
  };
  document.getElementById("vOut").onclick = (e) => { e.preventDefault(); signOut(auth); };
}

function renderMessage(title, text, withSignOut) {
  app.innerHTML = `<div class="card auth-card center"><div class="brand-mark">G</div><h1>${esc(title)}</h1>
    <p class="muted">${esc(text)}</p>${withSignOut ? `<button class="btn ghost" id="mOut">Sign out</button>` : ""}</div>`;
  if (withSignOut) document.getElementById("mOut").onclick = () => signOut(auth);
}

// ---------- router ----------
window.addEventListener("hashchange", () => me && route());
function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  const page = parts[0] || "";
  window.scrollTo(0, 0);
  if (page === "machines" && parts[1]) return renderMachine(parts[1]);
  if (page === "machines") return renderMachines();
  if (page === "maps") return renderMaps();
  if (page === "admin" && isAdmin()) return renderAdmin(parts[1] || "people");
  return renderHome();
}

// ---------- home ----------
async function renderHome() {
  app.innerHTML = `<h1>G'day ${esc(me.name)}</h1><p class="muted">Everything for running Gunnadoo Grain, in one spot.</p>
    <h2>Farm apps</h2><div class="tiles" id="tiles"></div>`;
  const builtIn = [
    { icon: "🌾", title: "Harvest Grain Tracker", desc: me.role === "admin" ? "Loads, contracts, payments and totals" : "Log loads into silos, bags and receival sites", href: "grain.html" },
    { icon: "🧪", title: me.role === "admin" ? "Chemical Costs & Labels" : "Chemical Labels", desc: me.role === "admin" ? "Chemical spend, invoices and label facts" : "Label facts, rates and withholding periods", href: "chemicals.html" },
    { icon: "🔧", title: "Machinery", desc: "Machines, service records, parts and manuals", href: "#/machines" },
    { icon: "🗺️", title: "Paddock maps", desc: "Paddock boundaries and crop types", href: "#/maps", soon: true },
  ];
  if (isAdmin()) builtIn.push({ icon: "⚙️", title: "Admin", desc: "People, logins and homepage links", href: "#/admin" });

  let links = [];
  try {
    const q = isAdmin() ? query(collection(db, "tiles"))
                        : query(collection(db, "tiles"), where("roles", "array-contains", me.role));
    links = (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.title).localeCompare(b.title));
  } catch (e) { console.error(e); }

  const linkTiles = links.map((t) => {
    const url = safeUrl(t.url);
    return `<a class="tile" href="${esc(url) || "#"}" target="_blank" rel="noopener">
      <span class="ico">${esc(t.icon || "🔗")}</span><h3>${esc(t.title)}</h3><p>${esc(t.desc || "")}</p>
      ${isAdmin() ? `<span><span class="badge">${(t.roles || []).map((r) => ROLE_LABEL[r]).join(" · ")}</span></span>` : ""}</a>`;
  }).join("");
  const builtTiles = builtIn.map((t) => `<a class="tile ${t.soon ? "soon" : ""}" href="${t.href}">
      <span class="ico">${t.icon}</span><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p>
      ${t.soon ? `<span><span class="badge">Coming soon</span></span>` : ""}</a>`).join("");
  document.getElementById("tiles").innerHTML = linkTiles + builtTiles;
}

// ---------- maps placeholder ----------
function renderMaps() {
  app.innerHTML = `<a class="back" href="#/">← Home</a><h1>Paddock maps</h1>
  <div class="card"><p>This is where your paddock map will go: boundaries drawn on satellite imagery, each paddock with its name, hectares and this season's crop.</p>
  <p class="muted">Not built yet. When you're ready, tell Claude which paddocks you have and whether you've got boundary files (for example KML/shapefiles from a yield monitor or precision-ag software) or want to draw them by hand.</p></div>`;
}

// ---------- machinery ----------
async function renderMachines() {
  app.innerHTML = `<a class="back" href="#/">← Home</a>
  <div class="item"><h1>Machinery</h1>${canWork() ? `<button class="btn" id="addM">+ Add machine</button>` : ""}</div>
  <p class="muted">Tap a machine for its service history, parts links and manuals.</p>
  <div class="list" id="mList"><p class="muted">Loading…</p></div>`;
  if (canWork()) document.getElementById("addM").onclick = () => machineDialog();
  const snap = await getDocs(query(collection(db, "machines"), orderBy("name")));
  const list = document.getElementById("mList");
  if (snap.empty) { list.innerHTML = `<div class="card muted">No machines yet. ${canWork() ? "Add your first one above." : ""}</div>`; return; }
  list.innerHTML = snap.docs.map((d) => {
    const m = d.data();
    const sub = [m.make, m.model, m.year].filter(Boolean).join(" · ");
    return `<a class="card item" href="#/machines/${d.id}" style="text-decoration:none;color:inherit">
      <div><h3>${esc(m.name)}</h3><span class="muted">${esc(sub)}</span></div>
      <span class="muted">${m.hours ? esc(m.hours) + " hrs" : ""}</span></a>`;
  }).join("");
}

function machineDialog(existing, id) {
  const m = existing || {};
  const linksText = (m.links || []).map((l) => `${l.label} | ${l.url}`).join("\n");
  const dlg = document.createElement("dialog");
  dlg.innerHTML = `<form method="dialog">
    <h2 style="margin-top:0">${id ? "Edit machine" : "Add machine"}</h2>
    <label>Name (what you call it)</label><input name="name" required value="${esc(m.name)}" placeholder="e.g. Volvo truck, Big tractor">
    <div class="grid2">
      <div><label>Make</label><input name="make" value="${esc(m.make)}"></div>
      <div><label>Model</label><input name="model" value="${esc(m.model)}"></div>
      <div><label>Year</label><input name="year" value="${esc(m.year)}"></div>
      <div><label>Serial / VIN</label><input name="serial" value="${esc(m.serial)}"></div>
      <div><label>Current hours / km</label><input name="hours" value="${esc(m.hours)}"></div>
      <div><label>Rego</label><input name="rego" value="${esc(m.rego)}"></div>
    </div>
    <label>Manuals & parts links — one per line as: Label | https://link</label>
    <textarea name="links" placeholder="Workshop manual | https://onedrive.live.com/...&#10;Air filter (dealer) | https://...">${esc(linksText)}</textarea>
    <label>Notes (oil types, filter part numbers, quirks)</label><textarea name="notes">${esc(m.notes)}</textarea>
    <p class="err" id="mErr"></p>
    <div class="row" style="justify-content:flex-end;margin-top:8px">
      <button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="save">Save</button>
    </div></form>`;
  document.body.appendChild(dlg); dlg.showModal();
  dlg.addEventListener("close", () => dlg.remove());
  dlg.querySelector("form").onsubmit = async (e) => {
    if (e.submitter?.value !== "save") return;
    e.preventDefault();
    const f = new FormData(e.target);
    const links = String(f.get("links") || "").split("\n").map((line) => {
      const [label, ...rest] = line.split("|");
      const url = safeUrl(rest.join("|"));
      return url ? { label: label.trim() || "Link", url } : null;
    }).filter(Boolean);
    const data = { name: f.get("name").trim(), make: f.get("make").trim(), model: f.get("model").trim(),
      year: f.get("year").trim(), serial: f.get("serial").trim(), hours: f.get("hours").trim(),
      rego: f.get("rego").trim(), notes: f.get("notes").trim(), links, updated: serverTimestamp() };
    try {
      if (id) await updateDoc(doc(db, "machines", id), data);
      else { const r = await addDoc(collection(db, "machines"), data); id = r.id; }
      dlg.close(); toast("Saved"); location.hash = `#/machines/${id}`; route();
    } catch (ex) { dlg.querySelector("#mErr").textContent = friendlyError(ex); }
  };
}

async function renderMachine(id) {
  const snap = await getDoc(doc(db, "machines", id));
  if (!snap.exists()) { app.innerHTML = `<a class="back" href="#/machines">← Machinery</a><p>Machine not found.</p>`; return; }
  const m = snap.data();
  const facts = [["Make", m.make], ["Model", m.model], ["Year", m.year], ["Serial / VIN", m.serial],
    ["Hours / km", m.hours], ["Rego", m.rego]].filter(([, v]) => v);
  app.innerHTML = `<a class="back" href="#/machines">← Machinery</a>
  <div class="item"><h1>${esc(m.name)}</h1>
    <div class="row">${canWork() ? `<button class="btn ghost small" id="editM">Edit</button>` : ""}
    ${isAdmin() ? `<button class="btn danger small" id="delM">Delete</button>` : ""}</div></div>
  <div class="card"><div class="grid2">${facts.map(([k, v]) => `<div><span class="muted" style="font-size:.8rem">${k}</span><div>${esc(v)}</div></div>`).join("") || `<p class="muted">No details yet.</p>`}</div>
  ${m.notes ? `<p style="white-space:pre-wrap;margin-bottom:0">${esc(m.notes)}</p>` : ""}</div>
  <h2>Manuals & parts</h2>
  <div class="card">${(m.links || []).length ? `<ul style="margin:0;padding-left:18px">${m.links.map((l) =>
    `<li><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join("")}</ul>` :
    `<p class="muted" style="margin:0">No links yet.${canWork() ? " Use Edit to add manual and parts links." : ""}</p>`}</div>
  <div class="item"><h2>Service history</h2>${canWork() ? `<button class="btn small" id="addS">+ Add service</button>` : ""}</div>
  <div class="card scroll-x" id="sList"><p class="muted">Loading…</p></div>`;
  if (canWork()) {
    document.getElementById("editM").onclick = () => machineDialog(m, id);
    document.getElementById("addS").onclick = () => serviceDialog(id);
  }
  if (isAdmin()) document.getElementById("delM").onclick = async () => {
    if (!confirm(`Delete ${m.name}? Its service records will stay in the database but won't show here.`)) return;
    await deleteDoc(doc(db, "machines", id)); toast("Deleted"); location.hash = "#/machines";
  };
  const ss = await getDocs(query(collection(db, "machines", id, "services"), orderBy("date", "desc")));
  const box = document.getElementById("sList");
  if (ss.empty) { box.innerHTML = `<p class="muted" style="margin:0">No service records yet.</p>`; return; }
  box.innerHTML = `<table class="table"><thead><tr><th>Date</th><th>Hrs/km</th><th>Work done</th><th>Parts used</th><th>By</th>${isAdmin() ? "<th></th>" : ""}</tr></thead><tbody>
    ${ss.docs.map((d) => { const s = d.data(); return `<tr><td>${esc(fmtDate(s.date))}</td><td>${esc(s.hours)}</td>
      <td style="white-space:pre-wrap">${esc(s.work)}</td><td style="white-space:pre-wrap">${esc(s.parts)}</td><td>${esc(s.by)}</td>
      ${isAdmin() ? `<td><button class="btn danger small" data-del="${d.id}">✕</button></td>` : ""}</tr>`; }).join("")}
  </tbody></table>`;
  box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Delete this service record?")) return;
    await deleteDoc(doc(db, "machines", id, "services", b.dataset.del)); toast("Deleted"); route();
  }));
}

function serviceDialog(machineId) {
  const dlg = document.createElement("dialog");
  const today = new Date().toLocaleDateString("en-CA");
  dlg.innerHTML = `<form method="dialog"><h2 style="margin-top:0">Add service record</h2>
    <div class="grid2"><div><label>Date</label><input type="date" name="date" required value="${today}"></div>
    <div><label>Hours / km at service</label><input name="hours"></div></div>
    <label>Work done</label><textarea name="work" required placeholder="e.g. Engine oil + filter, greased all points"></textarea>
    <label>Parts used (part numbers)</label><textarea name="parts"></textarea>
    <label>Done by</label><input name="by" value="${esc(me.name)}">
    <p class="err" id="sErr"></p>
    <div class="row" style="justify-content:flex-end;margin-top:8px">
      <button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="save">Save</button></div></form>`;
  document.body.appendChild(dlg); dlg.showModal();
  dlg.addEventListener("close", () => dlg.remove());
  dlg.querySelector("form").onsubmit = async (e) => {
    if (e.submitter?.value !== "save") return;
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await addDoc(collection(db, "machines", machineId, "services"), {
        date: f.get("date"), hours: f.get("hours").trim(), work: f.get("work").trim(),
        parts: f.get("parts").trim(), by: f.get("by").trim(), addedBy: me.uid, created: serverTimestamp() });
      if (f.get("hours").trim()) await updateDoc(doc(db, "machines", machineId), { hours: f.get("hours").trim() });
      dlg.close(); toast("Service saved"); route();
    } catch (ex) { dlg.querySelector("#sErr").textContent = friendlyError(ex); }
  };
}

// ---------- admin ----------
async function renderAdmin(tab) {
  app.innerHTML = `<a class="back" href="#/">← Home</a><h1>Admin</h1>
  <nav class="tabs"><a href="#/admin/people" class="${tab === "people" ? "on" : ""}">People & logins</a>
  <a href="#/admin/links" class="${tab === "links" ? "on" : ""}">Homepage links</a>
  <a href="#/admin/import" class="${tab === "import" ? "on" : ""}">Import data</a></nav><div id="adminBody"></div>`;
  if (tab === "import") return adminImport();
  return tab === "links" ? adminLinks() : adminPeople();
}

async function adminPeople() {
  const body = document.getElementById("adminBody");
  body.innerHTML = `<div class="card"><h3>Add a person</h3>
    <p class="muted" style="margin-top:0">Add their email here, then tell them to open the site, tap <b>First time here?</b> and set their own password.</p>
    <form id="invForm"><div class="grid2">
      <div><label>Name</label><input name="name" required></div>
      <div><label>Email</label><input name="email" type="email" required></div></div>
      <label>Access level</label><select name="role">
        <option value="staff">Staff — machinery (can add records) + links you allow</option>
        <option value="family">Family — view only + links you allow</option>
        <option value="admin">Admin — everything</option></select>
      <p class="err" id="invErr"></p><button class="btn">Add person</button></form></div>
    <h2>Everyone with access</h2><div class="card scroll-x" id="pList"><p class="muted">Loading…</p></div>`;
  document.getElementById("invForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = lower(f.get("email"));
    try {
      await setDoc(doc(db, "invites", email), { name: f.get("name").trim(), role: f.get("role"), invitedBy: me.email, at: serverTimestamp() });
      toast("Added — tell them to set their password"); adminPeople();
    } catch (ex) { document.getElementById("invErr").textContent = friendlyError(ex); }
  };
  const [inv, users] = await Promise.all([getDocs(collection(db, "invites")), getDocs(collection(db, "users"))]);
  const byEmail = {};
  inv.docs.forEach((d) => (byEmail[d.id] = { email: d.id, name: d.data().name, role: d.data().role, invited: true }));
  users.docs.forEach((d) => { const u = d.data(); byEmail[u.email] = { ...(byEmail[u.email] || {}), ...u, uid: d.id, joined: true }; });
  OWNER_EMAILS.map(lower).forEach((e) => (byEmail[e] = { ...(byEmail[e] || { email: e, name: e }), role: "admin", owner: true }));
  const rows = Object.values(byEmail).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || String(a.name).localeCompare(b.name));
  document.getElementById("pList").innerHTML = `<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Access</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.email)}</td>
    <td>${p.owner ? "Admin (owner)" : `<select data-role="${esc(p.email)}" style="width:auto;padding:4px 8px">
      ${ROLES.map((r) => `<option value="${r}" ${p.role === r ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select>`}</td>
    <td>${p.joined ? "Active" : `<span class="badge">Waiting to sign up</span>`}</td>
    <td>${p.owner ? "" : `<button class="btn danger small" data-rm="${esc(p.email)}">Remove</button>`}</td></tr>`).join("")}
  </tbody></table>`;
  const find = (email) => byEmail[email];
  document.querySelectorAll("[data-role]").forEach((s) => (s.onchange = async () => {
    const p = find(s.dataset.role);
    try {
      if (p.invited) await updateDoc(doc(db, "invites", p.email), { role: s.value });
      else await setDoc(doc(db, "invites", p.email), { name: p.name || "", role: s.value, at: serverTimestamp() });
      if (p.uid) await updateDoc(doc(db, "users", p.uid), { role: s.value });
      toast("Access updated");
    } catch (ex) { toast(friendlyError(ex)); }
  }));
  document.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => {
    const p = find(b.dataset.rm);
    if (!confirm(`Remove ${p.name || p.email}? They will lose access straight away.`)) return;
    try {
      await deleteDoc(doc(db, "invites", p.email));
      if (p.uid) await deleteDoc(doc(db, "users", p.uid));
      toast("Removed"); adminPeople();
    } catch (ex) { toast(friendlyError(ex)); }
  }));
}

async function adminLinks() {
  const body = document.getElementById("adminBody");
  body.innerHTML = `<div class="item"><p class="muted" style="margin:0">Links show as tiles on the homepage. Tick who can see each one.</p>
    <button class="btn" id="addL">+ Add link</button></div><div class="list" id="lList" style="margin-top:14px"></div>`;
  document.getElementById("addL").onclick = () => linkDialog();
  const snap = await getDocs(collection(db, "tiles"));
  const tiles = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const list = document.getElementById("lList");
  if (!tiles.length) {
    list.innerHTML = `<div class="card muted">No extra links yet. Grain Tracker, Chemicals and Machinery are built in, so add anything else here (weather, BOM radar, GrainCorp, bank, etc).</div>`;
    return;
  }
  list.innerHTML = tiles.map((t) => `<div class="card item"><div><h3>${esc(t.icon || "🔗")} ${esc(t.title)}</h3>
    <span class="muted" style="font-size:.85rem">${esc(t.url)}</span><br><span class="badge">${(t.roles || []).map((r) => ROLE_LABEL[r]).join(" · ") || "Nobody"}</span></div>
    <div class="row"><button class="btn ghost small" data-edit="${t.id}">Edit</button><button class="btn danger small" data-del="${t.id}">Delete</button></div></div>`).join("");
  list.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => linkDialog(tiles.find((t) => t.id === b.dataset.edit))));
  list.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Delete this link?")) return;
    await deleteDoc(doc(db, "tiles", b.dataset.del)); toast("Deleted"); adminLinks();
  }));
}

function linkDialog(t = {}) {
  const roles = t.roles || ["admin"];
  const dlg = document.createElement("dialog");
  dlg.innerHTML = `<form method="dialog"><h2 style="margin-top:0">${t.id ? "Edit link" : "Add link"}</h2>
    <div class="grid2"><div><label>Title</label><input name="title" required value="${esc(t.title)}"></div>
    <div><label>Icon (one emoji)</label><input name="icon" value="${esc(t.icon || "🔗")}" maxlength="4"></div></div>
    <label>Web address</label><input name="url" type="url" required value="${esc(t.url)}" placeholder="https://">
    <label>Short description</label><input name="desc" value="${esc(t.desc)}">
    <div class="grid2"><div><label>Order (1 = first)</label><input name="order" type="number" value="${esc(t.order ?? 10)}"></div></div>
    <label>Who can see it</label><div class="checks">${ROLES.map((r) => `<label><input type="checkbox" name="roles" value="${r}" ${roles.includes(r) ? "checked" : ""}>${ROLE_LABEL[r]}</label>`).join("")}</div>
    <p class="err" id="lErr"></p>
    <div class="row" style="justify-content:flex-end;margin-top:8px">
      <button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="save">Save</button></div></form>`;
  document.body.appendChild(dlg); dlg.showModal();
  dlg.addEventListener("close", () => dlg.remove());
  dlg.querySelector("form").onsubmit = async (e) => {
    if (e.submitter?.value !== "save") return;
    e.preventDefault();
    const f = new FormData(e.target);
    const url = safeUrl(f.get("url"));
    if (!url) { dlg.querySelector("#lErr").textContent = "Web address must start with https://"; return; }
    const data = { title: f.get("title").trim(), icon: f.get("icon").trim(), url, desc: f.get("desc").trim(),
      order: Number(f.get("order")) || 10, roles: f.getAll("roles") };
    if (!data.roles.includes("admin")) data.roles.push("admin");
    try {
      if (t.id) await setDoc(doc(db, "tiles", t.id), data); else await addDoc(collection(db, "tiles"), data);
      dlg.close(); toast("Saved"); adminLinks();
    } catch (ex) { dlg.querySelector("#lErr").textContent = friendlyError(ex); }
  };
}

// ---------- admin: import data file ----------
const IMPORTABLE = /^(grain_(deliveries|outloads|contracts|pricing|lists|settings)|chem_(products|purchases|labels)|machines)$/;
function adminImport() {
  const body = document.getElementById("adminBody");
  body.innerHTML = `<div class="card"><h3>Import a data file</h3>
    <p class="muted" style="margin-top:0">Use this to bring in a data file Claude gives you (for example your existing grain loads and chemical list). Records with the same ID are updated, not doubled up, so it's safe to run twice.</p>
    <p class="muted">Keep data files on your own computer. Never upload them to GitHub, because they can contain prices.</p>
    <input type="file" id="impFile" accept=".json,application/json">
    <div id="impInfo" style="margin-top:12px"></div></div>`;
  document.getElementById("impFile").onchange = async (e) => {
    const info = document.getElementById("impInfo");
    const f = e.target.files[0]; if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch { info.innerHTML = `<p class="err">That file isn't a valid data file.</p>`; return; }
    const cols = Object.keys(data).filter((k) => IMPORTABLE.test(k) && data[k] && typeof data[k] === "object");
    const skipped = Object.keys(data).filter((k) => !cols.includes(k));
    if (!cols.length) { info.innerHTML = `<p class="err">Nothing in that file this site knows how to import.</p>`; return; }
    info.innerHTML = `<p>This file has:</p><ul>${cols.map((c) => `<li>${esc(c)}: ${Object.keys(data[c]).length} records</li>`).join("")}</ul>
      ${skipped.length ? `<p class="muted">Ignored: ${skipped.map(esc).join(", ")}</p>` : ""}
      <button class="btn" id="impGo">Import now</button> <span class="muted" id="impMsg"></span>`;
    document.getElementById("impGo").onclick = async () => {
      const btn = document.getElementById("impGo"), msg = document.getElementById("impMsg");
      btn.disabled = true;
      const writes = [];
      cols.forEach((c) => Object.entries(data[c]).forEach(([id, d]) => writes.push([c, id, d])));
      try {
        for (let i = 0; i < writes.length; i += 400) {
          const batch = writeBatch(db);
          writes.slice(i, i + 400).forEach(([c, id, d]) => batch.set(doc(db, c, id), d));
          await batch.commit();
          msg.textContent = `Saved ${Math.min(i + 400, writes.length)} of ${writes.length}…`;
        }
        msg.textContent = `Done: ${writes.length} records imported.`;
        toast("Import finished");
      } catch (ex) {
        btn.disabled = false;
        msg.innerHTML = `<span class="err">${esc(friendlyError(ex))} Check the latest security rules are published in Firebase.</span>`;
      }
    };
  };
}
