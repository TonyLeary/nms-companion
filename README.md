# NMS Companion (MVP)

No Man's Sky companion app focused on quick search for:

- **How-to** guides
- **Where-to-find** answers

The app is responsive for desktop, tablet, and mobile and can be installed as a basic web app.

## MVP Features

- Single search box with mode toggle (`How-to` / `Where-to-find`)
- Live compiled community search (no outbound source links)
- Expand/collapse in-app details on each result card
- In-app summarized references, including Reddit-derived notes
- In-app video storyboard guides (no external video service required)
- Ongoing follow-up conversation directly inside each expanded result
- Local favorites saved in browser storage

## Run Locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Build for Production

```bash
npm run build
npm run start
```

## Notes

- Search compiles live community data at request time.
- External links are intentionally removed from the UI.
- Favorites are currently stored locally per browser/device.
