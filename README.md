# START 2026 · Gallery Observatory

An independent discovery guide and analytics dashboard for the public Meta VR
Start Developer Competition 2026 gallery, by mixed.world.

- **Website:** https://mixed-world.github.io/start-2026-gallery/
- **Detailed analytics:** https://mixed-world.github.io/start-2026-gallery/analytics.html
- **Source and corrections:** https://github.com/mixed-world/start-2026-gallery

## What it does

The front page provides guided discovery, search, conservative access labels,
random picks within your current filters, and a shortlist stored on your device.
Choose two or three saved projects to compare. Shareable shortlist URLs contain
only public project IDs, capped at 100 per link; they do not sync private saved
state. Analytics, exports, data coverage, and detailed methodology are one level
deeper at `analytics.html`.

No account or server is required. No visitor tracking scripts are included.
GitHub hosting, Google Fonts, linked services, and remotely loaded project
thumbnails have their own privacy practices.

## Run locally

```sh
python3 -m http.server 8765 --directory dist --bind 127.0.0.1
```

Open http://127.0.0.1:8765. Serve through HTTP rather than opening a file directly.
All assets use relative URLs so deployment below a GitHub Pages repository path
works without a build step. A current browser and Node.js 22+ are sufficient for
the development checks; Python 3 is used for collection and snapshot validation.

## Evidence and limitations

Access labels establish a listed link or narrative mention, **not** a tested
installation, public release, free trial, price, or compatibility. Meta short
share URLs are identified separately because their destinations are unresolved.
No APKs or external app code are downloaded or executed by the collector.

Confidence labels are **Observed**, **Developer-reported**, **Estimated**, and
**Unknown**. These describe the source of a claim, not the quality of a project.
Official selected tracks, division answers, and exact submission times are not
exposed by the public sources inspected. Category estimates and guided
collections use transparent keyword rules. Missing evidence remains unknown.
First public project activity is not a submission timestamp.

The default discovery order places matching **Featured** projects first, then
uses a stable hash-based shuffle seeded by snapshot date. FingerSling and
ClayBox Touch are editorial picks for Play & puzzle and Create & design,
respectively. Existing search and access filters still apply. Explicit
alphabetical and public-like sorts, saved/shared shortlist ordering, measured
analytics, and captured category estimates are preserved. Featured placement
is not a judging result or a personalized recommendation. “Surprise me” uses
a matching Featured pool for one in five draws when available, and the full
matching set for the other draws. All filtered projects remain eligible.
The initial snapshot captured 2,103 unique project IDs from 88 gallery pages,
against a displayed total of 2,105. All captured detail pages loaded. Dated
Devpost winner badges establish platform prize history, which can include
participation perks, not necessarily competitive or prior Meta wins.

Project names, descriptions, and images belong to their respective creators.
This project is independent of Meta and Devpost.

## Refresh the snapshot

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/collect.py
.venv/bin/python scripts/enrich_awards.py
.venv/bin/python scripts/finalize.py
node scripts/enrich-availability.cjs
```

Successful public HTTP responses are cached under `.cache/` (ignored by Git).
Move the cache directory aside before recollecting if you want fresh HTTP data.
Without that step, collection resumes and reparses cached pages. Requests use
five workers, timeouts, and backoff. No login or private submission APIs are used.
The snapshot is not automatically refreshed or scheduled.

Review `dist/data.json`, run the checks, then commit and push to `main`.
GitHub Actions publishes the checked `dist/` directory to GitHub Pages. Only
public source and the public snapshot belong in this repository; keep caches,
virtual environments, credentials, and private hosting metadata out of Git.

## Validate

```sh
node --check dist/availability.js
node --check dist/project-tools.js
node --check dist/discovery.js
node --check dist/app.js
node scripts/check_discovery.cjs
python3 scripts/check_snapshot.py
```

The checks protect public/unknown field semantics, access-label evidence,
source consistency, unique project IDs, and relative asset links. Browser QA
covers search, collections, saving and reload persistence, comparisons, shared
links, confidence explanations, analytics navigation, CSV export, and mobile
layout.

## Structure

- `dist/index.html`, `discovery.js`, `discovery.css`: simple discovery experience.
- `dist/analytics.html`, `app.js`, `styles.css`: detailed analytics and exports.
- `dist/availability.js`: shared access and collection rules, with no DOM dependency.
- `dist/project-tools.js`: shared project evidence and local shortlist behavior.
- `dist/data.json`: complete public snapshot, sources, coverage, and definitions.
- `scripts/`: collection, derivation, and validation.
- `.github/workflows/pages.yml`: checks and free static Pages deployment on push.

To suggest a correction, open an issue with the Devpost project URL, the affected
field, and a public supporting source. Changes are reviewed before publication.
