# Inkbug Beta

A desktop app for aspiring authors to store, organize, and write manuscripts with file organization and daily writing challenges.

## Tech Stack
- **Electron** — cross-platform desktop app framework
- **Vanilla HTML/CSS/JS** — lightweight renderer
- **electron-store** — local JSON-based data persistence

## Getting Started (Dev)

### Prerequisites
- Node.js v18+
- npm v9+

### Install & Run
```bash
git clone https://github.com/olivia-griffie/book-buddy-beta.git
cd book-buddy-beta
npm install
npm start
```

### Build for Distribution
```bash
# Mac (.dmg)
npm run build:mac

# Windows (.exe installer)
npm run build:win

# Both platforms
npm run build:all
```
Built files will appear in the `/releases` folder.

## Folder Structure
See STRUCTURE.md for detailed breakdown.

## Beta Tier
This build is "Inkbug Beta" — unlimited projects, all features unlocked for testing.
