# Train of Thoughts

An interactive train journey through a procedural, monochrome isometric city. Explore the motorman's cabin and three carriages — Future Thoughts, Present Thoughts and Past Thoughts — and discover each passenger's story.

![Train of Thoughts](preview.png)

## Run the complete project

Requirements: Node.js 20 or newer, npm, Python 3, and a browser with WebGL 2.

Install the locked dependencies and start a local web server from the repository root:

```sh
npm ci --prefix mecha
npm ci --prefix metro/standalone-tools
python -m http.server 4173 --bind 127.0.0.1
```

Open [http://127.0.0.1:4173/metro/](http://127.0.0.1:4173/metro/) for the complete application, including the sidebar, carriage controls, screenshot and recording controls, and standalone HTML download. The root `index.html` is the ready-to-run, sidebar-free artwork.

Click a carriage or the cabin to look inside, then click a character's face bubble to read their thought. Drag to orbit, scroll to zoom, and press Escape or right-click to return to the city view.

## Project structure

- `metro/`: scene, procedural city and train models, interactions, UI, recording, standalone builder, and checks.
- `habitat/`: shared character rigs, animation, motion data, source and optimized character assets, and preparation tools.
- `mecha/`: locked Three.js dependency used by the app and checks.
- `metro/standalone-tools/`: locked dependencies for rebuilding the single-file HTML artwork.
- `metro/exports/Train-of-Thoughts.html`: current downloadable standalone artwork. Generated video exports are not included.
- `index.html` and `embed.html`: ready-to-run standalone artwork and responsive iframe example.

## Build and verify

Rebuild the downloadable standalone HTML after changing the source:

```sh
node metro/build-standalone.mjs
```

Examples of project checks (run from the repository root):

```sh
node --experimental-loader ./habitat/assets/people/node-importmap.mjs metro/check-geometry.mjs
node --experimental-loader ./habitat/assets/people/node-importmap.mjs metro/check-static-transforms.mjs
node --experimental-loader ./habitat/assets/people/node-importmap.mjs metro/check-performance.mjs
```

The standalone artwork fills its iframe and can run without external asset requests. See `embed.html` for an example. The source application uses local npm dependencies and its own sidebar.

## Video recording

For local MP4 export, install FFmpeg, start `python metro/video-server.py` in a second terminal, and serve the application on port 4173 as shown above. The loopback-only encoder produces 2048 × 2048 H.264 MP4 at 60 fps after capture. No recorded videos are stored in the repository.

## Credits

The scene is rendered in real time with Three.js. Third-party code, character assets and motion attribution are listed in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and [habitat/assets/people/CREDITS.md](habitat/assets/people/CREDITS.md).
