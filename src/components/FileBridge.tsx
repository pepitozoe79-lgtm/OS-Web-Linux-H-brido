import { useEffect, useState } from 'react';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useOS } from '@/hooks/useOSStore';

export default function FileBridge() {
  const { findNodeByPath, createFile } = useFileSystem();
  const { dispatch } = useOS();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const downloadsFolder = findNodeByPath('/home/user/Downloads');
      if (!downloadsFolder) {
        console.error('Downloads folder not found');
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Read file as Blob (already is a Blob/File)
        createFile(downloadsFolder.id, file.name, file);

        dispatch({
          type: 'ADD_NOTIFICATION',
          notification: {
            appId: 'filemanager',
            appName: 'File Manager',
            appIcon: 'Folder',
            title: 'File Uploaded',
            message: `"${file.name}" has been saved to Downloads.`,
            isRead: false,
          },
        });
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [findNodeByPath, createFile, dispatch]);

  if (!isDragging) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
      style={{ background: 'rgba(124, 77, 255, 0.1)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-[var(--bg-window)] border-2 border-dashed border-[var(--accent-primary)] p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-300">
        <div className="w-16 h-16 bg-[var(--bg-hover)] rounded-full flex items-center justify-center text-4xl">
          📥
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">Drop files to upload</h3>
          <p className="text-sm text-[var(--text-secondary)]">Files will be saved to ~/Downloads</p>
        </div>
      </div>
    </div>
  );
}
