import type { useFileSystem } from '@/hooks/useFileSystem';

/**
 * Creates a Git-compatible FS bridge using the provided FileSystem hook methods.
 * This ensures that Git operations trigger React state updates across the OS.
 */
export const createGitFs = (fs: ReturnType<typeof useFileSystem>) => {
  return {
    async readFile(path: string, opts: any) {
      const node = fs.findNodeByPath(path);
      if (!node || node.type !== 'file') throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      const content = await fs.readFile(node.id) || '';
      if (opts?.encoding === 'utf8') return typeof content === 'string' ? content : await content.text();
      return typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(await content.arrayBuffer());
    },

    async writeFile(path: string, data: any, _opts: any) {
      const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
      const fileName = path.substring(path.lastIndexOf('/') + 1);
      const parentNode = fs.findNodeByPath(parentPath);
      if (!parentNode) throw new Error(`ENOENT: no such file or directory, mkdir '${parentPath}'`);
      
      const existing = fs.findNodeByPath(path);
      const content = data instanceof Uint8Array ? new Blob([data.buffer as ArrayBuffer]) : data;
      
      if (existing) {
        await fs.writeFile(existing.id, content);
      } else {
        await fs.createFile(parentNode.id, fileName, content);
      }
    },

    async unlink(path: string) {
      const node = fs.findNodeByPath(path);
      if (node) fs.deleteNode(node.id);
    },

    async readdir(path: string) {
      const node = fs.findNodeByPath(path);
      if (!node || node.type !== 'folder') return [];
      return fs.getChildren(node.id).map((n: any) => n.name);
    },

    async mkdir(path: string) {
      const existing = fs.findNodeByPath(path);
      if (existing) return;
      
      const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
      const folderName = path.substring(path.lastIndexOf('/') + 1);
      const parentNode = fs.findNodeByPath(parentPath);
      if (!parentNode) throw new Error(`ENOENT: no such file or directory, mkdir '${parentPath}'`);
      
      fs.createFolder(parentNode.id, folderName);
    },

    async rmdir(path: string) {
      const node = fs.findNodeByPath(path);
      if (node) fs.deleteNode(node.id);
    },

    async stat(path: string) {
      const node = fs.findNodeByPath(path);
      if (!node) throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
      return {
        type: node.type,
        size: node.size || 0,
        mtimeMs: node.modifiedAt,
        isDirectory: () => node.type === 'folder',
        isFile: () => node.type === 'file',
        isSymbolicLink: () => false
      };
    },

    async lstat(path: string) {
      return this.stat(path);
    },

    async _blobToString(blob: Blob): Promise<string> {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });
    }
  };
};
