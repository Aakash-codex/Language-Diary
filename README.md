# Language Learning Diary

A static HTML/CSS/JavaScript Japanese diary designed for GitHub Pages.

## Features

- Diary entries saved in this browser using `localStorage` (no diary backend).
- Automatic Japanese word segmentation and furigana using Kuromoji.js.
- Click a furigana word to open a small vocabulary drawer.
- Open the full Japanese-English entry on Jotoba from the drawer.
- Light/dark theme, review/edit modes, note list, and basic rich-text formatting.

## Live
https://aakash-codex.github.io/Language-Diary/

## Run locally

Because the app loads tokenizer dictionary files over HTTPS, run it from a local web server rather than opening `index.html` with `file://`.

For example, in Terminal:

```bash
cd language-learning-diary-online
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Online services and limitations

- Kuromoji's browser build and its compressed dictionary files are loaded from jsDelivr (`kuromoji@0.1.2`). This requires an internet connection.
- Full dictionary definitions open on Jotoba. The project does not call Jisho's API because its browser CORS policy can block direct requests.
- The small dictionary embedded in `app.js` is only a fallback for a few words; it is not a full dictionary.
- Notes are stored only in the current browser profile. They do not sync between devices or browsers. Clearing site data can erase them, so export/backup is a future feature to add.
- This online-first version does not yet include a service worker or offline cache. Offline support can be added after the online version is stable.

## Important privacy note

Diary text is not sent to Kuromoji or Jotoba by this app. Kuromoji processes the text in the browser. When you click **Open full definition on Jotoba**, the selected word is included in the Jotoba URL.

See `ATTRIBUTION.txt` for third-party resource credits.
