# 💠 OS-Web-Linux-Híbrido (v2.5.0-hybrid)
### *Experimental Hybrid Filesystem with Integrity Validation & Snapshot-based Recovery*

[![OS: Web-Hybrid](https://img.shields.io/badge/OS-Web--Hybrid-7C4DFF?style=for-the-badge&logo=linux)](https://github.com/pepitozoe79-lgtm/OS-Web-Linux-H-brido)
[![Integrity: SHA-256](https://img.shields.io/badge/Integrity-SHA--256-green?style=for-the-badge&logo=security)](https://github.com/pepitozoe79-lgtm/OS-Web-Linux-H-brido)
[![Resilience: Self--Healing](https://img.shields.io/badge/Resilience-Self--Healing-orange?style=for-the-badge&logo=recovery)](https://github.com/pepitozoe79-lgtm/OS-Web-Linux-H-brido)

**OS-Web-Linux-Híbrido** is a technical exploration of virtualized storage, cryptographic auditing, and host-bridge synchronization within the browser environment. It prioritizes data integrity and system resilience through a hybrid VFS model.

---

### 🏛️ Arquitectura Técnica y Modelos de Verdad

Para garantizar la coherencia del sistema, el proyecto se rige por los siguientes contratos técnicos:

#### **1. Modelo de Verdad (Source of Truth)**
*   **Autoridad Primaria:** `IndexedDB` (Persistent Storage) es la fuente de verdad absoluta para el estado del VFS interno.
*   **Autoridad Delegada:** Los *File Handles* del Host (vía File System Access API) son dueños de su propio contenido; el VFS actúa como un visor/editor sincronizado sin persistir duplicados en IndexedDB.
*   **Snapshots:** Son capturas de estado estáticas para recuperación histórica, no representan el estado vivo del sistema.

#### **2. Modelo de Concurrencia y Confiabilidad**
*   **Single-Tab Policy:** El sistema asume una operación en pestaña única. No se implementa *locking* distribuido entre múltiples instancias del navegador, lo que podría derivar en condiciones de carrera.
*   **Escrituras Secuenciales:** Las operaciones de E/S se encolan para asegurar la consistencia en el driver de IndexedDB, evitando colisiones de transacciones.
*   **Atomicidad de Snapshot:** El sistema implementa un bloqueo lógico durante la generación de backups para asegurar una "fotografía" coherente del estado.

#### **3. El Contrato de `fsck` (Integrity Audit)**
*   **Garantía:** Verifica la integridad criptográfica (SHA-256) y la coherencia estructural (Parent-Child).
*   **Alcance de Reparación:** Se limita al **Aislamiento** (Cuarentena en `/lost+found`) y **Re-vinculación** (Rescate de huérfanos). No implementa paridad de datos para reconstruir bits dañados.

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

## 🔬 Rendimiento y Validación Empírica
Para garantizar que **OS-Web-Linux-Híbrido** no es solo una simulación visual, el núcleo de persistencia se somete a pruebas de estrés de integridad.

> **Benchmark Ejecutado el: 28/04/2026**
> **Entorno:** Chrome 140 (Desktop) | NVMe SSD | 16GB RAM

| Métrica | Resultado | Nota Técnica |
| :--- | :--- | :--- |
| **Escritura (500 Blobs x 1KB)** | ~410 ms | Transacciones atómicas vía IndexedDB. |
| **Lectura (500 Blobs x 1KB)** | ~120 ms | Optimizado por indexación de claves primarias. |
| **Integridad de Datos** | 100% | Validación por `Blob.size` tras recuperación. |

---

#### **💾 Durabilidad y Recuperación (Snapshot System)**
El sistema implementa un subsistema de recuperación ante desastres (*Disaster Recovery*) basado en snapshots de estado estable.

* **Estrategia de Snapshot:** Serialización de la jerarquía de nodos de IndexedDB en un archivo JSON portable.
* **Garantía de Versión:** Cada backup incluye metadatos de versión para asegurar la compatibilidad de los esquemas de datos entre actualizaciones del kernel.
* **Limitaciones de Diseño (Transparencia):** 
    * No incluye deduplicación de datos.
    * La restauración actual es de tipo *Overwrite* (sobrescritura total de nodos con el mismo ID).
    * No implementa *Journaling* de transacciones en vivo (requiere estado en reposo para el backup).

---

#### **🔐 La Verdad Criptográfica (SHA-256)**
A diferencia de otros sistemas web, cada archivo en **OS-Web-Linux-Híbrido** posee una firma digital única.

* **Validación en Tiempo Real:** El comando `fsck` audita bit por bit la integridad de cada nodo, detectando corrupciones silenciosas.
* **Seguridad en Restauración:** Durante un `restore`, el sistema valida que el hash del backup coincida exactamente con los datos reconstruidos antes de persistirlos.
* **Consistencia Estructural:** Auditoría de nodos huérfanos y jerarquías rotas.

---

#### **🛠️ Capacidad de Auto-Curación (Self-Healing)**
El sistema no solo detecta fallos, sino que tiene la capacidad de autorepararse de forma activa.

* **Validación Crítica en Lectura:** Cada vez que una aplicación solicita un archivo, el Kernel valida su firma digital. Si hay un *Hash Mismatch*, la lectura se bloquea para evitar la propagación de datos corruptos.
* **Reparación Automática (`fsck --repair`):** 
    * **Aislamiento:** Los archivos corruptos son movidos automáticamente a una carpeta de cuarentena (`/lost+found`).
    * **Re-vinculación:** Los nodos huérfanos sin padre son re-conectados a la raíz del sistema.
* **Escenario de Prueba (Failure Injection):** 
    1. Se altera manualmente 1 byte de un archivo vía DevTools.
    2. El usuario intenta abrir el archivo; el Kernel lanza una excepción de integridad inmediata.
    3. Se ejecuta `fsck --repair`. El sistema identifica, aísla y limpia la inconsistencia.

---

## 🛠️ Getting Started

## 🚀 Quick Start / One-Click Install

If you are on an **Ubuntu Server**, you can install the entire OS with a single command:

```bash
curl -sSL https://raw.githubusercontent.com/pepitozoe79-lgtm/OS-Web-Linux-H-brido/main/install.sh | sudo bash
```

*Alternatively, if you have already cloned the repository:*

```bash
chmod +x install.sh
sudo ./install.sh
```

---

## 🛠️ Manual Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/pepitozoe79-lgtm/OS-Web-Linux-H-brido.git
   ```
2. Install dependencies & build:
   ```bash
   npm install
   npm run build
   ```
3. For Ubuntu/Nginx deployment details, see **[INSTALL_UBUNTU.md](./INSTALL_UBUNTU.md)**.

### PWA (Standalone Mode)
For the most immersive experience, click the **"Install"** icon in your browser's address bar. This removes the browser UI and runs OS-Web-Linux-Híbrido as a standalone application.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for the Open Source Community.**
