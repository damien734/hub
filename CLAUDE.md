# Gunnadoo Command Centre — notes for Claude

- Static site on GitHub Pages (damien734.github.io/hub), Firebase Auth + Firestore + AI Logic (Gemini).
- Before every commit that changes code, run `./bump-version.sh` so phones pick up the new
  core.js / app.js / firebase-config.js straight away (GitHub Pages caches files ~10 minutes).
- Changes to `firestore.rules` are NOT deployed by pushing: send the user the updated rules to
  paste into Firebase console > Firestore Database > Rules > Publish, and say so.
- Prices, contracts, NGR share % are admin-only (grain_pricing, chem_purchases, Firestore rules).
- Never commit data exports (they contain prices); the repo is public.
