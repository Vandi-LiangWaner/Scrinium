# The Literature Box - built by GPT

**Project note:** Scrinium (formerly The Literature Box) is a **vibe coding project**, built iteratively with AI coding assistance.

The Literature Box is a private, local-first desktop app for organizing literature notes as a tactile stack of index cards.

It is designed for reading and research without the complexity of a conventional reference manager or “second brain” system. Open the app, browse the stack, flip through cards, search, edit directly, and continue reading.

## Features

- Separate card collections for papers, authors, and journals
- Rich-text notes and key findings
- Fast full-text search across metadata and notes
- Search by tags and authors
- Reading-status dividers
- Drag-and-drop organization
- Image attachments
- Automatic saving and undo
- Import and export in JSON, CSV, and Markdown
- Fully local SQLite storage
- Automatic local backup
- No account, cloud service, or internet connection required

## Install

Download the appropriate installer from the repository’s [Releases](../../releases) page.

### Windows

1. Download the file whose name contains `Setup` and ends in `.exe`.
2. Double-click it and complete installation.
3. Open **The Literature Box** from the Start menu.

Windows may show a SmartScreen warning because this independently built app is not code-signed. If you trust this repository, select **More info → Run anyway**.

### macOS

1. Download the `.dmg` file.
2. Open it and drag **The Literature Box** into **Applications**.
3. Control-click the installed app and choose **Open** the first time.

macOS may show a warning because this independently built app is not notarized. If necessary, allow it under **System Settings → Privacy & Security**.

## Where your information is stored

Cards, notes, metadata, and attached images are stored locally in:

```text
Documents/The Literature Box/literature-box.sqlite
```

The app also updates an automatic backup after saving:

```text
Documents/The Literature Box/Backups/literature-box-latest.sqlite
```

Your research data is not uploaded to this repository or a cloud service.

## Move cards from the web version

1. In the web version, select **Export → JSON backup**.
2. Open the desktop app.
3. Select **Import** and choose the exported JSON file.

## Manual backups

Use **Export → JSON backup** inside the app whenever you want a portable backup. Store that JSON file somewhere safe. It can be imported into another installation later.

## Build from source

Developers need Node.js 22 or later.

```bash
npm install
npm run desktop:dev
```

Create an installer on the matching operating system:

```bash
npm run desktop:package:win
npm run desktop:package:mac
```

Build outputs are written to `release/`.

## Privacy

The Literature Box is intentionally local-first. It has no collaboration, analytics, advertising, social features, or proprietary cloud dependency. Your database stays on your computer unless you choose to copy or back it up elsewhere.
