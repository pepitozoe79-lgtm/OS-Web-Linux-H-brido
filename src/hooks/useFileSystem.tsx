import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { FileSystemNode, FileSystemState, FileAssociation } from '@/types';
import { vfsDriver, generateHash } from '@/lib/vfs-db';

const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const FILE_ASSOCIATIONS: FileAssociation[] = [
  { extension: '.txt', appId: 'texteditor', icon: 'FileText', mimeType: 'text/plain' },
  { extension: '.md', appId: 'markdownpreview', icon: 'FileCode', mimeType: 'text/markdown' },
  { extension: '.json', appId: 'jsonformatter', icon: 'Braces', mimeType: 'application/json' },
  { extension: '.js', appId: 'codeeditor', icon: 'Code2', mimeType: 'text/javascript' },
  { extension: '.ts', appId: 'codeeditor', icon: 'Code2', mimeType: 'text/typescript' },
  { extension: '.html', appId: 'codeeditor', icon: 'Code2', mimeType: 'text/html' },
  { extension: '.css', appId: 'codeeditor', icon: 'Code2', mimeType: 'text/css' },
  { extension: '.py', appId: 'codeeditor', icon: 'Code2', mimeType: 'text/x-python' },
  { extension: '.jpg', appId: 'imageviewer', icon: 'Image', mimeType: 'image/jpeg' },
  { extension: '.jpeg', appId: 'imageviewer', icon: 'Image', mimeType: 'image/jpeg' },
  { extension: '.png', appId: 'imageviewer', icon: 'Image', mimeType: 'image/png' },
  { extension: '.gif', appId: 'imageviewer', icon: 'Image', mimeType: 'image/gif' },
  { extension: '.mp3', appId: 'musicplayer', icon: 'Music', mimeType: 'audio/mpeg' },
  { extension: '.wav', appId: 'musicplayer', icon: 'Music', mimeType: 'audio/wav' },
  { extension: '.mp4', appId: 'videoplayer', icon: 'PlayCircle', mimeType: 'video/mp4' },
  { extension: '.pdf', appId: 'documentviewer', icon: 'File', mimeType: 'application/pdf' },
  { extension: '.zip', appId: 'archivemanager', icon: 'Package', mimeType: 'application/zip' },
  { extension: '.csv', appId: 'spreadsheet', icon: 'Table2', mimeType: 'text/csv' },
];

export const getFileAssociation = (filename: string): FileAssociation | undefined => {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return undefined;
  const ext = filename.slice(dotIndex).toLowerCase();
  return FILE_ASSOCIATIONS.find((a) => a.extension === ext);
};

interface FileSystemContextType {
  fs: FileSystemState;
  isLoading: boolean;
  getChildren: (parentId: string) => FileSystemNode[];
  getNodeById: (id: string) => FileSystemNode | undefined;
  getNodePath: (id: string) => string;
  createFile: (parentId: string, name: string, content?: string | Blob) => string;
  createFolder: (parentId: string, name: string) => string;
  deleteNode: (id: string) => void;
  moveToTrash: (id: string) => void;
  renameNode: (id: string, newName: string) => void;
  moveNode: (id: string, newParentId: string) => void;
  readFile: (id: string) => Promise<string | Blob | undefined>;
  writeFile: (id: string, content: string | Blob) => Promise<void>;
  emptyTrash: () => void;
  getTrashItems: () => FileSystemNode[];
  findNodeByPath: (path: string) => FileSystemNode | undefined;
  mountHostDirectory: (parentId: string) => Promise<string | null>;
  scanHostDirectory: (parentId: string, handle: FileSystemDirectoryHandle) => Promise<void>;
}

const FileSystemContext = createContext<FileSystemContextType | null>(null);

const createDefaultFS = (): FileSystemState => {
  const rootId = generateId();
  const homeId = generateId();
  const userId = generateId();
  const desktopId = generateId();
  const documentsId = generateId();
  const downloadsId = generateId();
  const musicId = generateId();
  const picturesId = generateId();
  const videosId = generateId();
  const configId = generateId();
  const trashId = generateId();
  const trashFilesId = generateId();
  const trashInfoId = generateId();
  const lostFoundId = generateId();

  const nodes: Record<string, FileSystemNode> = {
    [rootId]: { id: rootId, name: '/', type: 'folder', parentId: null, createdAt: Date.now(), modifiedAt: Date.now() },
    [homeId]: { id: homeId, name: 'home', type: 'folder', parentId: rootId, createdAt: Date.now(), modifiedAt: Date.now() },
    [userId]: { id: userId, name: 'user', type: 'folder', parentId: homeId, createdAt: Date.now(), modifiedAt: Date.now() },
    [desktopId]: { id: desktopId, name: 'Desktop', type: 'folder', parentId: userId, createdAt: Date.now(), modifiedAt: Date.now() },
    [documentsId]: { id: documentsId, name: 'Documents', type: 'folder', parentId: userId, createdAt: Date.now(), modifiedAt: Date.now() },
    [downloadsId]: { id: downloadsId, name: 'Downloads', type: 'folder', parentId: userId, createdAt: Date.now(), modifiedAt: Date.now() },
    [musicId]: { id: musicId, name: 'Music', type: 'folder', parentId: userId, createdAt: Date.now(), modifiedAt: Date.now() },
    [picturesId]: { id: picturesId, name: 'Pictures', type: 'folder', parentId: userId, createdAt: Date.now(), modifiedAt: Date.now() },
    [videosId]: { id: videosId, name: 'Videos', type: 'folder', parentId: userId, createdAt: Date.now(), modifiedAt: Date.now() },
    [configId]: { id: configId, name: '.config', type: 'folder', parentId: userId, createdAt: Date.now(), modifiedAt: Date.now(), isHidden: true },
    [trashId]: { id: trashId, name: '.trash', type: 'folder', parentId: userId, createdAt: Date.now(), modifiedAt: Date.now(), isHidden: true },
    [trashFilesId]: { id: trashFilesId, name: 'files', type: 'folder', parentId: trashId, createdAt: Date.now(), modifiedAt: Date.now() },
    [trashInfoId]: { id: trashInfoId, name: 'info', type: 'folder', parentId: trashId, createdAt: Date.now(), modifiedAt: Date.now() },
    [lostFoundId]: { id: lostFoundId, name: 'lost+found', type: 'folder', parentId: rootId, createdAt: Date.now(), modifiedAt: Date.now(), isHidden: true },
  };

  const readmeId = generateId();
  nodes[readmeId] = {
    id: readmeId, name: 'welcome.txt', type: 'file', parentId: documentsId,
    createdAt: Date.now(), modifiedAt: Date.now(),
    content: 'Welcome to UbuntuOS!\n\nThis is a web-based Linux desktop environment.\nExplore the apps and enjoy the experience.',
    size: 96,
  };

  return { nodes, trashMetadata: {} };
};

export function FileSystemProvider({ children }: { children: React.ReactNode }) {
  const [fs, setFs] = useState<FileSystemState>({ nodes: {}, trashMetadata: {} });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const nodes = await vfsDriver.getAllNodes();
        const trashMetadata = await vfsDriver.getTrashMetadata();
        
        if (Object.keys(nodes).length === 0) {
          const defaultFS = createDefaultFS();
          await vfsDriver.saveNodes(Object.values(defaultFS.nodes));
          await vfsDriver.saveTrashMetadata(defaultFS.trashMetadata);
          setFs(defaultFS);
        } else {
          setFs({ nodes, trashMetadata });
        }
      } catch (err) {
        console.error('Failed to load FS from IndexedDB:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const getChildren = useCallback((parentId: string) => Object.values(fs.nodes).filter((n) => n.parentId === parentId), [fs.nodes]);
  const getNodeById = useCallback((id: string) => fs.nodes[id], [fs.nodes]);
  const getNodePath = useCallback((id: string) => {
    const parts: string[] = [];
    let current: FileSystemNode | undefined = fs.nodes[id];
    while (current) {
      parts.unshift(current.name);
      current = current.parentId ? fs.nodes[current.parentId] : undefined;
    }
    return parts.join('/') || '/';
  }, [fs.nodes]);

  const createFile = useCallback((parentId: string, name: string, content: string | Blob = '') => {
    const id = generateId();
    const node: FileSystemNode = {
      id, name, type: 'file', parentId,
      createdAt: Date.now(), modifiedAt: Date.now(),
      content, size: content instanceof Blob ? content.size : new Blob([content]).size,
    };
    setFs((prev) => ({ ...prev, nodes: { ...prev.nodes, [id]: node } }));
    vfsDriver.saveNode(node);
    return id;
  }, []);

  const createFolder = useCallback((parentId: string, name: string) => {
    const id = generateId();
    const node: FileSystemNode = { id, name, type: 'folder', parentId, createdAt: Date.now(), modifiedAt: Date.now() };
    setFs((prev) => ({ ...prev, nodes: { ...prev.nodes, [id]: node } }));
    vfsDriver.saveNode(node);
    return id;
  }, []);

  const deleteNode = useCallback((id: string) => {
    setFs((prev) => {
      const nodes = { ...prev.nodes };
      const trashMeta = { ...prev.trashMetadata };
      const recurseDelete = (nodeId: string) => {
        const node = nodes[nodeId];
        if (!node) return;
        if (node.type === 'folder') Object.values(nodes).filter((n) => n.parentId === nodeId).forEach((n) => recurseDelete(n.id));
        delete nodes[nodeId];
        delete trashMeta[nodeId];
        vfsDriver.deleteNode(nodeId);
      };
      recurseDelete(id);
      vfsDriver.saveTrashMetadata(trashMeta);
      return { nodes, trashMetadata: trashMeta };
    });
  }, []);

  const moveToTrash = useCallback((id: string) => {
    setFs((prev) => {
      const nodes = { ...prev.nodes };
      const trashMeta = { ...prev.trashMetadata };
      const originalPath = (() => {
        const parts: string[] = [];
        let current: FileSystemNode | undefined = nodes[id];
        while (current) { parts.unshift(current.name); current = current.parentId ? nodes[current.parentId] : undefined; }
        return parts.join('/');
      })();
      trashMeta[id] = { originalPath, deletedAt: Date.now() };
      const recurseMove = (nodeId: string, newParentId: string) => {
        const node = nodes[nodeId];
        if (!node) return;
        const updatedNode = { ...node, parentId: newParentId, modifiedAt: Date.now() };
        nodes[nodeId] = updatedNode;
        vfsDriver.saveNode(updatedNode);
        if (node.type === 'folder') Object.values(nodes).filter((n) => n.parentId === nodeId).forEach((n) => recurseMove(n.id, nodeId));
      };
      const trashFilesId = Object.values(nodes).find((n) => n.name === 'files' && n.parentId && nodes[n.parentId]?.name === '.trash')?.id;
      if (trashFilesId) recurseMove(id, trashFilesId);
      vfsDriver.saveTrashMetadata(trashMeta);
      return { nodes, trashMetadata: trashMeta };
    });
  }, []);

  const renameNode = useCallback((id: string, newName: string) => {
    setFs((prev) => {
      const node = prev.nodes[id];
      if (!node) return prev;
      const updatedNode = { ...node, name: newName, modifiedAt: Date.now() };
      vfsDriver.saveNode(updatedNode);
      return { ...prev, nodes: { ...prev.nodes, [id]: updatedNode } };
    });
  }, []);

  const moveNode = useCallback((id: string, newParentId: string) => {
    setFs((prev) => {
      const node = prev.nodes[id];
      if (!node) return prev;
      const updatedNode = { ...node, parentId: newParentId, modifiedAt: Date.now() };
      vfsDriver.saveNode(updatedNode);
      return { ...prev, nodes: { ...prev.nodes, [id]: updatedNode } };
    });
  }, []);

  const readFile = useCallback((id: string) => fs.nodes[id]?.type === 'file' ? fs.nodes[id].content : undefined, [fs.nodes]);

  const writeFile = useCallback(async (id: string, content: string | Blob) => {
    setFs((prev) => {
      const node = prev.nodes[id];
      if (!node || node.type !== 'file') return prev;
      const updatedNode = { ...node, content, size: content instanceof Blob ? content.size : new Blob([content]).size, modifiedAt: Date.now() };
      vfsDriver.saveNode(updatedNode);
      return { ...prev, nodes: { ...prev.nodes, [id]: updatedNode } };
    });
  }, []);

  const emptyTrash = useCallback(() => {
    setFs((prev) => {
      const nodes = { ...prev.nodes };
      const trashMeta = { ...prev.trashMetadata };
      Object.keys(trashMeta).forEach((id) => {
        const recurseDelete = (nodeId: string) => {
          const node = nodes[nodeId];
          if (!node) return;
          if (node.type === 'folder') Object.values(nodes).filter((n) => n.parentId === nodeId).forEach((n) => recurseDelete(n.id));
          delete nodes[nodeId];
          vfsDriver.deleteNode(nodeId);
        };
        recurseDelete(id);
        delete trashMeta[id];
      });
      vfsDriver.saveTrashMetadata(trashMeta);
      return { nodes, trashMetadata: trashMeta };
    });
  }, []);

  const findNodeByPath = useCallback((path: string) => {
    if (path === '/') return Object.values(fs.nodes).find((n) => n.parentId === null);
    const parts = path.split('/').filter(Boolean);
    let current = Object.values(fs.nodes).find((n) => n.parentId === null);
    for (const part of parts) {
      const found = Object.values(fs.nodes).find((n) => n.parentId === current?.id && n.name === part);
      if (!found) return undefined;
      current = found;
    }
    return current;
  }, [fs.nodes]);

  const scanHostDirectory = useCallback(async (parentId: string, handle: FileSystemDirectoryHandle) => {
    const nodes: FileSystemNode[] = [];
    for await (const entry of (handle as any).values()) {
      const id = generateId();
      const node: FileSystemNode = {
        id,
        name: entry.name,
        type: entry.kind === 'directory' ? 'folder' : 'file',
        parentId,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        handle: entry,
      };
      nodes.push(node);
    }
    
    setFs((prev) => {
      const newNodes = { ...prev.nodes };
      nodes.forEach(n => {
        // Avoid duplicates if scanning again
        const existing = Object.values(newNodes).find(en => en.parentId === parentId && en.name === n.name);
        if (!existing) newNodes[n.id] = n;
      });
      return { ...prev, nodes: newNodes };
    });
    
    // Save to VFS driver? No, handles are not serializable in IDB easily.
    // We keep them in memory for the session.
  }, []);

  const mountHostDirectory = useCallback(async (parentId: string) => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      const id = generateId();
      const node: FileSystemNode = {
        id,
        name: handle.name,
        type: 'host-mount',
        parentId,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        handle,
      };
      
      setFs((prev) => ({ ...prev, nodes: { ...prev.nodes, [id]: node } }));
      // Start initial scan
      await scanHostDirectory(id, handle);
      return id;
    } catch (err) {
      console.error('Failed to mount host directory:', err);
      return null;
    }
  }, [scanHostDirectory]);

  // Override readFile to handle host handles and hash validation
  const originalReadFile = readFile;
  const readHostFile = useCallback(async (id: string, validate = true) => {
    const node = fs.nodes[id];
    if (!node) return undefined;

    let content: string | Blob | undefined;
    if (node.handle && node.type === 'file') {
      const file = await (node.handle as any).getFile();
      const textExts = ['.txt', '.md', '.json', '.js', '.ts', '.css', '.html'];
      const isText = textExts.some(ext => node.name.endsWith(ext));
      content = isText ? await file.text() : file;
    } else {
      content = originalReadFile(id);
    }

    // Cryptographic Validation on Read
    if (validate && node.type === 'file' && node.hash && content !== undefined) {
      const currentHash = await generateHash(content);
      if (currentHash !== node.hash) {
        console.error(`INTEGRITY ERROR: File ${node.name} is corrupted!`);
        throw new Error(`Integrity violation: The file '${node.name}' has been tampered with or corrupted (Hash Mismatch).`);
      }
    }

    return content;
  }, [fs.nodes, originalReadFile]);

  // Override writeFile to handle host handles
  const originalWriteFile = writeFile;
  const writeHostFile = useCallback(async (id: string, content: string | Blob) => {
    const node = fs.nodes[id];
    if (node?.handle && node.type === 'file') {
      const writable = await (node.handle as any).createWritable();
      await writable.write(content);
      await writable.close();
      
      setFs(prev => ({
        ...prev,
        nodes: {
          ...prev.nodes,
          [id]: { ...prev.nodes[id], modifiedAt: Date.now(), size: content instanceof Blob ? content.size : new Blob([content]).size }
        }
      }));
      return;
    }
    originalWriteFile(id, content);
  }, [fs.nodes, originalWriteFile]);

  const value = {
    fs, isLoading, getChildren, getNodeById, getNodePath, createFile, createFolder,
    deleteNode, moveToTrash, renameNode, moveNode, 
    readFile: readHostFile, 
    writeFile: writeHostFile, 
    emptyTrash,
    getTrashItems: () => Object.keys(fs.trashMetadata).map((id) => fs.nodes[id]).filter(Boolean),
    findNodeByPath,
    mountHostDirectory,
    scanHostDirectory
  };

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>;
}

export function useFileSystem() {
  const context = useContext(FileSystemContext);
  if (!context) throw new Error('useFileSystem must be used within a FileSystemProvider');
  return context;
}
