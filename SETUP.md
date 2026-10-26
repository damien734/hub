# Gunnadoo Command Centre — Setup Guide

About 45–60 minutes, done once on a computer. You need two free accounts:

- **GitHub**, which stores the code and hosts the website for free (GitHub Pages).
- **Firebase** (Google), which handles logins and stores the data (machines, service records, people, links).

> Menu names below are how these sites looked when this was written. If a button has moved, look for something with a similar name, or ask Claude.

---

## Part 1 — Firebase (logins + database)

1. Go to **console.firebase.google.com** and sign in with a Google account. A farm Gmail is a good idea, so it isn't tied to one person's personal account.
2. **Create a project**, named something like `gunnadoo-hub`. You can turn Google Analytics off.
3. **Turn on logins:** Build → **Authentication** → Get started → Sign-in method → **Email/Password** → Enable → Save.
4. **Create the database:** Build → **Firestore Database** → Create database.
   - Location: pick the Sydney region (`australia-southeast1`) if it's offered. You can't change this later.
   - Start in **production mode**.
5. **Paste in the security rules.** These control who can see what.
   - Open `firestore.rules` from this folder in Notepad (Windows) or TextEdit (Mac).
   - At the top, replace `damo@example.com` and `carissa@example.com` with your two real emails, **all lower case**.
   - Copy everything, then in Firebase go to Firestore Database → **Rules**, delete what's there, paste, and press **Publish**.
6. **Register the website with Firebase:** Project settings (gear icon) → General → Your apps → click the **`</>`** (Web) icon → give it a nickname → Register. Skip "Firebase Hosting".
   - It shows a block of code with `firebaseConfig = { apiKey: ..., ... }`. Keep that page open.
7. Open `firebase-config.js` and:
   - Paste each value (apiKey, authDomain, etc.) between the quote marks.
   - Replace the two example emails with the **same two emails** you put in the rules.
   - Save.

> The `firebaseConfig` values aren't passwords. Firebase designs them to sit in a public website. What protects your data is the login plus the rules from step 5.

## Part 2 — GitHub (hosting the website)

1. Go to **github.com** and sign up. Your username becomes part of the web address, e.g. `gunnadoograin.github.io`.
2. Click **+** (top right) → **New repository**.
   - Name: `hub`
   - Visibility: **Public**. Free GitHub Pages hosting needs a public repository unless you pay for GitHub Pro. Please verify this on GitHub's pricing page, because it may have changed. The code has no farm data or passwords in it; all data lives in Firebase behind the login.
   - Click Create repository.
3. On the new repository page, click **uploading an existing file**, drag in **everything in this folder** (including the `icons` folder and the `.nojekyll` file), then click **Commit changes**.
   - Mac hides files starting with a dot. If `.nojekyll` won't show, press Cmd+Shift+. in Finder. It's optional anyway.
4. Repository **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → **Save**.
5. Wait 1–3 minutes and refresh. It shows your address, like `https://YOURNAME.github.io/hub/`.

## Part 3 — Connect the two

1. Back in Firebase: Authentication → **Settings** → **Authorized domains** → Add domain → type `YOURNAME.github.io` (no `https://`, no `/hub`).
2. Open your site address. Tap **First time here?**, enter your email (one of the two owner emails) and a password.
3. Confirm your email from the link they send (check junk), go back, and press **I've confirmed it**. You're in as Admin.
4. Carissa does the same with her email.

## Part 4 — Add staff and kids

1. Open **Admin → People & logins**.
2. Add each person's name and email, and choose an access level:
   - **Staff:** can see machinery and add/edit machines and service records, plus any links you tick for staff.
   - **Family:** view only, plus any links you tick for family.
   - **Admin:** everything, including adding/removing people.
3. Tell each person: *open the link → First time here? → set your password → confirm the email.*
4. To remove someone, press **Remove**. They lose access straight away. (Their login itself still exists in Firebase → Authentication → Users; delete it there if you want it fully gone.)

> **Kids under 13:** Firebase doesn't check ages, but some email providers (Gmail, Outlook) have their own age rules for kids' accounts. Use whatever email setup you're already comfortable with for the kids.

## Part 5 — Put it on phones and iPads like an app

- **iPhone/iPad (Safari):** open the link → Share button → **Add to Home Screen**.
- **Android (Chrome):** open the link → ⋮ menu → **Add to Home screen** / **Install app**.
- **Computer:** bookmark it. In Chrome/Edge you can also use the install icon in the address bar.

## Machinery manuals

The machinery section stores **links** to manuals, not the files themselves. Storing files in Firebase now needs a billing card on the account, and keeping manuals in OneDrive or Google Drive is free and simpler:

1. Put the PDF in OneDrive/Google Drive.
2. Share → "Anyone with the link can view" → copy the link.
3. In the app: Machine → Edit → add a line like `Workshop manual | https://...`.

## Making changes later

Ask Claude for a change. Claude gives you updated files, and you upload them to the GitHub repository (Add file → Upload files → Commit). The site updates within a few minutes. If GitHub is connected to Claude, Claude can push changes to the repository directly instead.

## Known limits of this first version

- **Paddock maps** is a placeholder.
- **Grain Tracker** and **Chemical Costs** are linked tiles that still live in Claude, so they only open for people signed in to Claude with access. The next step is to move them into this site with their data in Firebase. Then they get the same logins, and staff can have a no-pricing view.
- **Not yet tested against a live Firebase project.** Report anything that doesn't work as expected.
