/**
 * VFS Database Driver
 * Native IndexedDB implementation for high-performance file system persistence.
 * Supports strings and large Blobs.
 */

import type { FileSystemNode, TrashItemMetadata } from '@/types';

const DB_NAME = 'UbuntuOS_VFS';
const DB_VERSION = 1;
const NODES_STORE = 'nodes';
const METADATA_STORE = 'metadata';

export async function generateHash(content: string | Blob | undefined): Promise<string> {
  if (content === undefined) return "";
  try {
    const data = typeof content === "string" ? new TextEncoder().encode(content) : await content.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    console.error("Hashing failed:", e);
    return "hash-error";
  }
}

export class VFSDriver {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(NODES_STORE)) {
          db.createObjectStore(NODES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE);
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async getAllNodes(): Promise<Record<string, FileSystemNode>> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(NODES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const nodes: Record<string, FileSystemNode> = {};
        (request.result as FileSystemNode[]).forEach((node) => {
          nodes[node.id] = node;
        });
        resolve(nodes);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getNode(id: string): Promise<FileSystemNode | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(NODES_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveNode(node: FileSystemNode): Promise<void> {
    await this.init();
    if (node.type === 'file' && node.content !== undefined) {
      node.hash = await generateHash(node.content);
    }
    return new Promise((resolve, reject) => {
      const store = this.getStore(NODES_STORE, 'readwrite');
      const request = store.put(node);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveNodes(nodes: FileSystemNode[]): Promise<void> {
    await this.init();
    // Pre-calculate hashes for all files
    for (const node of nodes) {
      if (node.type === 'file' && node.content !== undefined && !node.hash) {
        node.hash = await generateHash(node.content);
      }
    }
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('No DB');
      const transaction = this.db.transaction(NODES_STORE, 'readwrite');
      const store = transaction.objectStore(NODES_STORE);

      nodes.forEach((node) => store.put(node));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteNode(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(NODES_STORE, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTrashMetadata(): Promise<Record<string, TrashItemMetadata>> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(METADATA_STORE);
      const request = store.get('trash');
      request.onsuccess = () => resolve(request.result || {});
      request.onerror = () => reject(request.error);
    });
  }

  async saveTrashMetadata(metadata: Record<string, TrashItemMetadata>): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(METADATA_STORE, 'readwrite');
      const request = store.put(metadata, 'trash');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('No DB');
      const transaction = this.db.transaction([NODES_STORE, METADATA_STORE], 'readwrite');
      transaction.objectStore(NODES_STORE).clear();
      transaction.objectStore(METADATA_STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async fsck(repair = false): Promise<{ healthy: number; corrupted: string[]; orphans: string[] }> {
    const nodesMap = await this.getAllNodes();
    const nodes = Object.values(nodesMap);
    const report = { healthy: 0, corrupted: [] as string[], orphans: [] as string[] };
    
    // Ensure lost+found exists if repairing
    let lostFoundId = nodes.find(n => n.name === 'lost+found')?.id;
    if (repair && !lostFoundId) {
      lostFoundId = Math.random().toString(36).slice(2);
      await this.saveNode({
        id: lostFoundId,
        name: 'lost+found',
        type: 'folder',
        parentId: 'root', // Assuming root exists
        createdAt: Date.now(),
        modifiedAt: Date.now()
      });
    }

    for (const node of nodes) {
      if (node.type === 'file' && node.content !== undefined) {
        const actualHash = await generateHash(node.content);
        if (node.hash && actualHash !== node.hash) {
          report.corrupted.push(node.name);
          if (repair && lostFoundId) {
            await this.saveNode({
              ...node,
              name: `[CORRUPT]_${node.name}_${Date.now()}`,
              parentId: lostFoundId,
              modifiedAt: Date.now()
            });
          }
        } else {
          report.healthy++;
        }
      }

      // Structure check
      if (node.parentId && node.parentId !== 'root' && !nodesMap[node.parentId]) {
        report.orphans.push(node.name);
        if (repair) {
          await this.saveNode({
            ...node,
            parentId: 'root',
            modifiedAt: Date.now()
          });
        }
      }
    }

    return report;
  }
}

export const vfsDriver = new VFSDriver();
export const vfsDb = vfsDriver;
