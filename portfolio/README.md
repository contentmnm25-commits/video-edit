# rachitgandhi.com — portfolio

Static site: `index.html`, `styles.css`, `main.js` and `assets/`. No build step, no dependencies.

## Run locally

```sh
cd portfolio
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

Any static host works. Point it at the `portfolio/` folder.

- **Netlify:** drag the `portfolio` folder onto app.netlify.com/drop, or connect this repo with base directory `portfolio` and no build command.
- **Vercel:** import the repo, set Root Directory to `portfolio`, framework preset "Other", no build command.
- **Cloudflare Pages:** connect the repo, build output directory `portfolio`, no build command.

Then attach the `rachitgandhi.com` domain. `index.html`, `robots.txt`, `sitemap.xml` and the JSON-LD all assume that domain, so update them if you use another one.

## Editing content

- **Work pieces:** the `WORK` array at the top of `main.js`. The first item becomes the large lead card. Each piece needs `assets/posters/<slug>.webp` and `assets/reels/<slug>.mp4`.
- **Availability line:** the hero line marked `data-availability` in `index.html`, and the one beside the Contact heading.
- **Experience, toolkit, contact:** plain HTML in `index.html`.
- **Deep links:** `https://rachitgandhi.com/#play=<slug>` opens a specific piece in the player. Useful for sending one piece to a recruiter.

When adding video, encode H.264 High / yuv420p with AAC audio and `-movflags +faststart`, so playback starts before the file finishes downloading:

```sh
ffmpeg -i in.mov -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 20 -preset slow \
  -vf "scale=1920:-2" -c:a aac -b:a 160k -movflags +faststart assets/reels/<slug>.mp4
ffmpeg -ss 2 -i assets/reels/<slug>.mp4 -frames:v 1 -c:v libwebp -quality 80 assets/posters/<slug>.webp
```

## Before launch — needs Rachit, not code

1. **Replace the 960×540 clips with 1080p masters.** Every clip in the exported build was 960×540, and they look soft in full-screen. Re-export with the command above. Keep each one under about 8 MB.
2. **Confirm you may show the YRF footage.** The Compositing Reel and the showreel are Yash Raj Films shots, so check your agreement with YFX. The site credits the footage to its owners, but that is not the same as permission.
3. **Re-cut the showreel.** It is 40 seconds (the old site said 1:08) and its title card says "Motion Graphics Showreel", which no longer matches the AI video + VFX positioning. Lead with the AI and product work, then the comp shots, in 60–90 seconds.
4. **Decide on the availability line.** "Open to full-time roles & freelance" is public, and the current employer can see it. Soften it (e.g. "Taking select projects") if that matters.
5. **Replace the CV.** The current PDF is a LinkedIn "Save to PDF" export: three pages, five job titles in the headline and raw `&amp;` entities in the summary. A one-page CV matching the site's title is stronger.
6. **Use a domain email.** `hello@rachitgandhi.com` reads more professional than Gmail once the domain is live. Replace all five occurrences of the Gmail address in `index.html`.
7. **Add one or two breakdowns** (plate → generated → final comp) for the AI pieces. That is the strongest proof of the "nothing ships raw" claim.
