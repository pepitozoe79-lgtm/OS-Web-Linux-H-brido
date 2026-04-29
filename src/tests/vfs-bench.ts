// src/tests/vfs-bench.ts
import { vfsDb } from "../lib/vfs-db";

const FILE_COUNT = 500;
const FILE_SIZE_KB = 1; // 1KB por archivo

async function runBenchmark() {
  console.log("%c🚀 Iniciando VFS Performance Audit...", "color: #00d1ff; font-weight: bold");
  
  // Setup: Crear datos de prueba
  const dummyContent = new Blob([new ArrayBuffer(FILE_SIZE_KB * 1024)], { type: 'application/octet-stream' });
  const results = { write: 0, read: 0, integrity: 0 };

  // --- FASE 1: ESCRITURA ---
  const t0 = performance.now();
  for (let i = 0; i < FILE_COUNT; i++) {
    await vfsDb.saveNode({
      id: `bench_${i}`,
      name: `test_file_${i}.bin`,
      type: 'file',
      parentId: 'bench_root',
      content: dummyContent, // Prueba real con Blobs
      updatedAt: Date.now()
    });
  }
  const t1 = performance.now();
  results.write = t1 - t0;

  // --- FASE 2: LECTURA e INTEGRIDAD ---
  const t2 = performance.now();
  for (let i = 0; i < FILE_COUNT; i++) {
    const node = await vfsDb.getNode(`bench_${i}`);
    if (node && node.content instanceof Blob && node.content.size === dummyContent.size) {
      results.integrity++;
    }
  }
  const t3 = performance.now();
  results.read = t3 - t2;

  // --- REPORTE FINAL ---
  console.table({
    "Operación": ["Escritura Masiva", "Lectura e Integridad"],
    "Tiempo Total (ms)": [results.write.toFixed(2), results.read.toFixed(2)],
    "Promedio/Archivo (ms)": [(results.write / FILE_COUNT).toFixed(2), (results.read / FILE_COUNT).toFixed(2)],
    "Éxito": [`${FILE_COUNT}/${FILE_COUNT}`, `${results.integrity}/${FILE_COUNT}`]
  });

  console.log(`%c📊 Resultado Final: ${results.integrity === FILE_COUNT ? 'PASSED ✅' : 'FAILED ❌'}`, "font-size: 14px; font-weight: bold");
  
  return results;
}

export default runBenchmark;
