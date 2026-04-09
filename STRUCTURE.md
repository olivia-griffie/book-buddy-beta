# Book Buddy Beta — Project Structure

```
book-buddy-beta/
│
├── package.json                  # Electron + build config
├── electron-builder.yml          # (optional override for builder)
├── .gitignore
├── README.md
├── CHANGELOG.md
│
├── public/                       # Static assets for builds
│   ├── icon.icns                 # Mac app icon
│   ├── icon.ico                  # Windows app icon
│   └── icon.png                  # Base icon (512x512)
│
├── releases/                     # Output from electron-builder (gitignored)
│
├── tests/                        # Manual or automated tests
│
└── src/
    ├── main/                     # Electron main process (Node.js)
    │   ├── main.js               # App entry, BrowserWindow creation
    │   ├── preload.js            # Secure bridge (contextBridge)
    │   └── menu.js               # Native app menu
    │
    ├── renderer/                 # Frontend (HTML/CSS/JS)
    │   ├── index.html            # App shell / entry point
    │   ├── renderer.js           # Global renderer logic, routing
    │   │
    │   ├── styles/
    │   │   ├── global.css        # Reset, base styles
    │   │   └── variables.css     # CSS custom properties (colors, fonts, spacing)
    │   │
    │   ├── pages/
    │   │   ├── home/             # Project grid dashboard
    │   │   ├── create-project/   # New project form (fills project_spec)
    │   │   ├── plot-creation/    # Genre-based plot builder (fills plot_data)
    │   │   ├── chapters/         # Chapter manager + text editor
    │   │   ├── characters/       # Character creation cards
    │   │   ├── scenes/           # Scene list + chapter tagging
    │   │   ├── locations/        # World/location builder
    │   │   └── daily-prompts/    # Daily writing prompt generator
    │   │
    │   ├── components/
    │   │   ├── shared/
    │   │   │   ├── navbar.js
    │   │   │   ├── sidebar.js
    │   │   │   ├── modal.js
    │   │   │   ├── progress-bar.js
    │   │   │   └── project-card.js
    │   │   └── editor/
    │   │       ├── text-editor.js   # Chapter writing editor (font toggle, word count)
    │   │       └── editor.css
    │   │
    │   └── assets/
    │       ├── fonts/            # Serif + sans-serif font files
    │       └── images/           # UI icons, placeholder thumbnails
    │
    ├── data/
    │   ├── schemas/              # JSON shape definitions for saved data
    │   │   ├── project_spec.json
    │   │   ├── plot_data.json
    │   │   ├── character_data.json
    │   │   ├── scene_data.json
    │   │   └── location_data.json
    │   │
    │   ├── prompts/              # Writing prompt source data
    │   │   ├── genre_prompts.json
    │   │   └── specific_genre_prompts.json
    │   │
    │   └── defaults/
    │       └── plot_defaults.json  # Pre-filled plot text for each genre
    │
    └── utils/
        ├── file-manager.js       # Save/load project files via electron-store
        ├── prompt-generator.js   # Logic for daily prompt selection (sequential vs wild)
        ├── word-counter.js       # Live word count tracking
        └── subscription.js       # Tier/project limit checks (stubbed for beta)
```
