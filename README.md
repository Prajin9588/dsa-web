# DSA Revision Hub

A lightweight, browser-based DSA tracker built with plain HTML, CSS and JavaScript. It imports C/C++ problem filenames from the public GitHub repository `Codensity30/Strivers-A2Z-DSA-Sheet`, then lets you track recall status and save personal revision notes locally.

## Features

- Dashboard with total, Green, Yellow and Red counts
- Topic sidebar, topic progress and searchable/filterable problem table
- Green / Yellow / Red recall status
- Notes for intuition, approach, time complexity, space complexity, mistakes and personal reminders
- Revision dates and a due-for-revision queue
- Add your own problems
- Export a JSON backup
- Uses `localStorage`; no login or backend required
- Starter list is shown if GitHub cannot be reached; use **Sync repository** when online

## Run locally

1. Download and unzip the project folder.
2. Open `index.html` in a modern browser.
3. Allow internet access for the initial GitHub import. The app requests the repository's public Git tree through GitHub's API.

If your browser blocks requests when opening files directly, run a tiny local server from this folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Status and revision defaults

- **Green:** can explain the idea and implement independently. Default next review: 14 days.
- **Yellow:** understands the idea but needs a hint or revision. Default next review: 3 days.
- **Red:** needs to relearn the concept. Default next review: 1 day.

You can edit any due date in a problem's notes. The dashboard due queue includes dates that have arrived and all Yellow/Red problems.

## Data and limitations

- Progress and notes are stored in this browser profile only. They do not sync across devices or browsers.
- Use **Export** / **Back up data** to download a JSON backup periodically.
- The import reads C/C++ filenames in the repository and uses folder names as topics. Filenames are used as display names; the app does not attempt to parse problem titles from source code.
- If GitHub's API is rate-limited or unavailable, a clearly labeled starter set is displayed instead of the imported repository list.
- This is an unofficial personal study tool, not affiliated with Striver or the repository owner.
