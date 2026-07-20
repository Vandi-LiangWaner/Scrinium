# The Literature Box — Desktop

This edition runs as a private desktop application on Windows and macOS.

## Where your data lives

The app creates a normal SQLite file in your Documents folder:

`Documents/The Literature Box/literature-box.sqlite`

It also updates this automatic backup after every save:

`Documents/The Literature Box/Backups/literature-box-latest.sqlite`

Cards, rich text, metadata, and attached images are stored in that database. The app does not need an account, internet connection, or cloud service.

## Moving existing browser cards

1. In the web app, choose **Export → JSON backup**.
2. Open the desktop app.
3. Choose **Import** and select the JSON file.

## For developers

Install Node.js 22, then run:

```sh
npm install
npm run desktop:dev
```

Create installers on the matching operating system:

```sh
npm run desktop:package:win
npm run desktop:package:mac
```

Installers are written to `release/`. The included GitHub Actions workflow can build both platforms automatically after the project is uploaded to GitHub.
