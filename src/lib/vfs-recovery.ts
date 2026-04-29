import { vfsDb, generateHash } from "./vfs-db";

const SYSTEM_VERSION = "2.5.0-hybrid";

export const recoveryService = {
  async createSnapshot() {
    const nodesMap = await vfsDb.getAllNodes();
    const nodes = Object.values(nodesMap);
    
    // Process nodes to handle Blobs
    const processedNodes = await Promise.all(nodes.map(async (node) => {
      const serializedNode = { ...node };
      if (node.content instanceof Blob) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(node.content as Blob);
        });
        serializedNode.content = base64;
        (serializedNode as any).isBlob = true;
      }
      return serializedNode;
    }));

    const snapshot = {
      metadata: {
        system: "OS-Web-Linux-Híbrido",
        version: SYSTEM_VERSION,
        timestamp: Date.now(),
        nodeCount: nodes.length,
      },
      data: processedNodes
    };

    // Serialización segura
    return new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  },

  async restoreFromSnapshot(file: File | Blob) {
    const content = await file.text();
    const snapshot = JSON.parse(content);

    // Validación de Integridad Estructural
    if (snapshot.metadata?.system !== "OS-Web-Linux-Híbrido") {
      throw new Error("Formato de backup no compatible.");
    }

    // Operación de Restauración Masiva
    for (const nodeData of snapshot.data) {
      const node = { ...nodeData };
      
      // Handle Blobs reconstruction
      if (node.isBlob && typeof node.content === 'string') {
        const response = await fetch(node.content);
        node.content = await response.blob();
        delete node.isBlob;
      }
      
      // Validation: Compare restored hash with original hash
      if (node.type === 'file' && node.hash) {
        const restoredHash = await generateHash(node.content);
        if (restoredHash !== node.hash) {
          throw new Error(`Integrity error: Hash mismatch for file '${node.name}'. Backup might be corrupted.`);
        }
      }
      
      await vfsDb.saveNode(node);
    }
    
    return snapshot.metadata;
  }
};
