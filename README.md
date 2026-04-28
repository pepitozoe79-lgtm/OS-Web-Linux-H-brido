# 💠 OS-Web-Linux-Híbrido (v2.5.0-hybrid)

[![OS: Web-Hybrid](https://img.shields.io/badge/OS-Web--Hybrid-7C4DFF?style=for-the-badge&logo=linux)](https://github.com/pepitozoe79-lgtm/OS-Web-Linux-H-brido)
[![Storage: IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-blue?style=for-the-badge&logo=indexeddb)](https://github.com/pepitozoe79-lgtm/OS-Web-Linux-H-brido)
[![Framework: React](https://img.shields.io/badge/Framework-React-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)

**OS-Web-Linux-Híbrido** is a high-performance, browser-based Linux desktop environment that bridges the gap between the web sandbox and local hardware. Featuring a robust Virtual File System (VFS), real-time Git integration, and a unique "Host-Mount" system via the File System Access API.

---

## 🚀 Key Features

### 📂 Virtual File System (VFS) 2.0
Unlike traditional web-based operating systems, OS-Web-Linux-Híbrido utilizes a persistent **IndexedDB-backed VFS**. 
- **Binary Support:** Full support for Blobs, allowing you to store images, music, and videos within your browser.
- **Asynchronous Execution:** High-performance file operations that don't block the UI thread.
- **Persistence:** Your files, settings, and terminal history remain intact across browser sessions.

### 🔗 The "Hybrid" Bridge (Host Mounting)
Use the `mount` command in the Terminal to select a local folder from your physical computer.
- **Direct Access:** Edit files on your real disk using the built-in TextEditor.
- **Bi-directional Sync:** Changes saved in the web OS are instantly reflected on your physical drive.

### 🐙 Git Integration
Full Git support via `isomorphic-git`.
- **In-Browser Repositories:** Run `git clone`, `git status`, and `git log` directly in the Terminal.
- **Integrated Workflow:** Clone repositories into your VFS or your mounted host folders.

### 🎨 Multi-Distro Identity System
Instant theme switching between popular Linux distributions:
- **Ubuntu 🟠**: The classic desktop experience.
- **Arch Linux 💠**: Sleek, minimal, and power-user oriented.
- **Kali Linux 🐉**: Security-focused aesthetic with neon accents.
- **Fedora 💙**: Professional and polished design.
- **Debian 🍥**: Stable and community-driven look.

---

## 💻 Technical Stack

- **Core:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + CSS Variables (Dynamic Distro Theming)
- **Database:** IndexedDB (Native persistence)
- **Git Engine:** `isomorphic-git` + custom VFS bridge
- **Hardware Bridge:** File System Access API

---

## 🛠️ Getting Started

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/pepitozoe79-lgtm/OS-Web-Linux-H-brido.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### PWA (Standalone Mode)
For the most immersive experience, click the **"Install"** icon in your browser's address bar. This removes the browser UI and runs OS-Web-Linux-Híbrido as a standalone application.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for the Open Source Community.**
