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

  async saveNode(node: FileSystemNode): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(NODES_STORE, 'readwrite');
      const request = store.put(node);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveNodes(nodes: FileSystemNode[]): Promise<void> {
    await this.init();
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
}

export const vfsDriver = new VFSDriver();
