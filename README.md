# Tabby 🐱

Tabby is a sleek, cross-platform, multi-environment notes application built with web technologies and designed for speed, focus, and extensibility. Whether you're jotting down quick thoughts, writing essays in Markdown, or managing your personal knowledge base, Tabby works seamlessly both in the browser and on the desktop.

![Tabby Screenshot](https://via.placeholder.com/800x450.png?text=Tabby+Notes+App) *(Add your own screenshot here)*

## Features ✨

*   **Markdown Support:** Write in plain text and toggle beautifully rendered Markdown preview instantly (`Ctrl + E`).
*   **Cross-Platform Desktop App:** Built with Electron, Tabby can run locally on Mac, Windows, and Linux.
*   **Focus Mode:** Enter distraction-free writing mode, hiding sidebars and UI fluff to keep your mind on the words.
*   **Cloud Syncing:** 
    *   **Firebase Integration:** Authenticate securely and sync your notes instantly across sessions using Firestore.
    *   **Google Drive Sync:** Back up and restore your entire workspace directly to your Google Drive account.
*   **Offline First:** Create notes locally without logging in. They are saved directly to your machine or browser storage.
*   **Tagging & Colors:** Organize your notes quickly by color-coding tags.
*   **Powerful Search & Replace:** Quickly find and replace text across your note (`Ctrl + F`, `Ctrl + H`).
*   **Undo/Redo History:** Robust local history buffer to recover from mistakes (`Ctrl + Z`, `Ctrl + Y`).
*   **Customizable Settings:** Adjust application themes (Light, Midnight, Sepia), font families (Sans, Serif, Mono), and font sizes to fit your environment.
*   **Import / Export:** Easily import `.txt` and `.md` files and export your notes back to your local filesystem.

## Keyboard Shortcuts ⌨️

Work at the speed of thought with these global hotkeys:

| Action | Shortcut |
| :--- | :--- |
| **New Note** | `Ctrl + T` |
| **Toggle Markdown / Text**| `Ctrl + E` |
| **Find** | `Ctrl + F` |
| **Replace** | `Ctrl + H` |
| **Import Note** | `Ctrl + O` |
| **Export Note** | `Ctrl + Alt + S` |
| **Delete Active Note** | `Ctrl + Del` |
| **Undo** | `Ctrl + Z` |
| **Redo** | `Ctrl + Y` or `Ctrl + Shift + Z` |
| **Toggle Focus Mode** | `Esc` (when editor is focused) |

## Tech Stack 🛠️

Tabby is built entirely on modern, performant web tools:

*   **Frontend:** React 19, TypeScript, Vite
*   **Styling:** Tailwind CSS v4, Lucide React (Icons)
*   **Backend & Sync:** Firebase (Firestore, Auth), Google Drive API
*   **Desktop Container:** Electron, Electron Builder
*   **Markdown parsing:** `react-markdown`, `remark-gfm`

## Development Setup 🚀

To get started with local development, clone the repository and install dependencies.

### Prerequisites

*   Node.js (v18+)
*   npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/prateek271/tabby.git
   cd tabby
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```


### Running the App

**Web Configuration (Vite dev server):**
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

**Desktop Configuration (Electron):**
```bash
npm run electron:dev
```
This spins up the Vite development server AND launches the Electron window concurrently.

### Building for Production

**Web Build:**
Produces static files in `dist/`.
```bash
npm run build
```

**Desktop Packages:**
Builds native desktop installers (Mac `.dmg`, Linux `AppImage`, Windows `.exe`) in the `dist-electron/` folder. The generated installers will automatically include the application version in their filenames (e.g., `Tabby-2.2.0-mac-x64.dmg`).

To build for specific platforms, use the following commands:
```bash
npm run electron:build:mac    # Build for macOS (.dmg, .zip)
npm run electron:build:win    # Build for Windows (.exe)
npm run electron:build:linux  # Build for Linux (.AppImage)
npm run electron:build:all    # Build for all platforms
```

Or you can use the default command to build for your current host system:
```bash
npm run electron:build
```

## Folder Structure 📂

*   `/src`: Contains the core React application, components, utility functions, and Firebase configurations.
*   `/electron`: Contains the Electron main process code (`main.cjs`), IPC event handlers, and desktop authentication flows.
*   `/scripts`: Utilities for preparing app icons and build steps.

## Contributing 🤝

Contributions, issues, and feature requests are welcome!
Feel free to check out the [issues page](https://github.com/prateek271/tabby/issues).

## License 📝

This project is licensed under the MIT License - see the LICENSE file for details.
