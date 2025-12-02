# PDF Editor - No Download

A web-based PDF editor that allows users to open, edit, and save PDF files locally without the ability to download them.

## Features

- 📄 **Open Local PDFs**: Upload and view PDF files from your computer
- ✏️ **Edit PDFs**: Add text, draw, and highlight annotations
- 💾 **Save Changes**: Save edits to browser storage (localStorage/IndexedDB)
- 🚫 **No Download**: Prevents downloading the PDF file
- 🎨 **Modern UI**: Beautiful, responsive interface
- 📱 **Page Navigation**: Easy navigation between pages with thumbnails
- 🔍 **Zoom Control**: Adjust zoom level for better viewing

## Tools Available

1. **Select/Move**: Default tool for navigation
2. **Text**: Add text annotations to the PDF
3. **Draw**: Freehand drawing on the PDF
4. **Highlight**: Create highlight rectangles

## Getting Started

### Option 1: Simple HTTP Server

1. Install a simple HTTP server (if you don't have one):
   ```bash
   npm install -g http-server
   ```

2. Start the server:
   ```bash
   http-server -p 8080
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

### Option 2: Using npm scripts

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Or start with auto-open:
   ```bash
   npm run dev
   ```

## Usage

1. Click "Open PDF" to select a PDF file from your computer
2. Use the toolbar to select editing tools (Text, Draw, Highlight)
3. Click and drag on the PDF to add annotations
4. Click "Save Changes" to save your edits (saved to browser storage)
5. Your edits are automatically saved to localStorage

## Security Features

- Right-click context menu is disabled on PDF viewer
- Common download shortcuts (Ctrl+S, Ctrl+P) are blocked
- PDF data is stored locally in browser storage only
- No server-side storage or file downloads

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari

## Technical Details

- **PDF Rendering**: PDF.js
- **PDF Editing**: pdf-lib
- **Storage**: localStorage for annotations and state
- **No Backend**: Fully client-side application

## Notes

- PDFs are stored in browser localStorage, which has size limitations (~5-10MB depending on browser)
- For larger PDFs, consider using IndexedDB (can be implemented if needed)
- Edits are saved locally and persist across browser sessions
- The original PDF file is not modified on your computer

