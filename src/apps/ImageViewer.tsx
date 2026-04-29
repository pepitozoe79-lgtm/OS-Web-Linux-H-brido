import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, Play, Square, Info, X, RotateCcw
} from 'lucide-react';
import { useFileSystem } from '@/hooks/useFileSystem';

// ---- Types ----
interface ImageItem {
  id: string;
  name: string;
  src: string;
  width?: number;
  height?: number;
  size?: string;
  isBlob?: boolean;
}

interface ImageViewerProps {
  params?: {
    fileId?: string;
  };
}

// ---- Main Image Viewer ----
export default function ImageViewer({ params }: ImageViewerProps) {
  const { fs, getNodeById, getChildren } = useFileSystem();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'fit' | 'actual'>('fit');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const slideshowTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrls = useRef<Record<string, string>>({});

  // Memoize the list of images in the current folder
  const images = useMemo(() => {
    if (!params?.fileId) return [];
    
    const file = getNodeById(params.fileId);
    if (!file) return [];

    const parentId = file.parentId;
    if (!parentId) return [file as any];

    const siblings = getChildren(parentId);
    const imageFiles = siblings.filter((n: any) => 
      n.type === 'file' && 
      (n.name.toLowerCase().endsWith('.jpg') || 
       n.name.toLowerCase().endsWith('.jpeg') || 
       n.name.toLowerCase().endsWith('.png') || 
       n.name.toLowerCase().endsWith('.gif'))
    );

    return imageFiles.map((f: any) => ({
      id: f.id,
      name: f.name,
      src: '', 
      size: `${Math.round((f.size || 0) / 1024)} KB`,
    }));
  }, [params?.fileId, fs.nodes]);

  // Set initial index based on fileId
  useEffect(() => {
    if (params?.fileId && images.length > 0) {
      const index = images.findIndex(img => img.id === params.fileId);
      if (index !== -1) setCurrentIndex(index);
    }
  }, [params?.fileId, images.length]);

  // Handle ObjectURL creation and revocation
  const currentImage = images[currentIndex];
  const [displaySrc, setDisplaySrc] = useState<string>('');

  useEffect(() => {
    if (!currentImage) return;

    if (blobUrls.current[currentImage.id]) {
      setDisplaySrc(blobUrls.current[currentImage.id]);
      return;
    }

    const load = async () => {
      const raw = await fs.readFile(currentImage.id);
      if (raw instanceof Blob) {
        const url = URL.createObjectURL(raw);
        blobUrls.current[currentImage.id] = url;
        setDisplaySrc(url);
      } else if (typeof raw === 'string' && raw.startsWith('data:')) {
        setDisplaySrc(raw);
      } else {
        setDisplaySrc('');
      }
    };
    load();
  }, [currentImage, fs]);

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(blobUrls.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Slideshow logic
  useEffect(() => {
    if (isSlideshow && images.length > 1) {
      slideshowTimer.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
      }, 3000);
    }
    return () => { if (slideshowTimer.current) clearInterval(slideshowTimer.current); };
  }, [isSlideshow, images.length]);

  const goNext = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [images.length]);

  const goPrev = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [images.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight') goNext();
      if (e.code === 'ArrowLeft') goPrev();
      if (e.code === 'Equal' && e.shiftKey) setZoom((z) => Math.min(z + 0.25, 5));
      if (e.code === 'Minus') setZoom((z) => Math.max(z - 0.25, 0.1));
      if (e.code === 'Space') { e.preventDefault(); setIsSlideshow((s) => !s); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  if (!currentImage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] bg-[#0A0A0A]">
        <Maximize2 size={48} className="mb-4 opacity-20" />
        <p>No image selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative" style={{ background: '#0A0A0A' }}>
      {/* Top Toolbar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 transition-opacity"
        style={{
          height: 40,
          background: 'rgba(0,0,0,0.6)',
          opacity: isSlideshow ? 0 : 1,
          pointerEvents: isSlideshow ? 'none' : 'auto',
        }}
      >
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.1))} className="flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.1)] w-7 h-7">
            <ZoomOut size={16} className="text-white" />
          </button>
          <span className="text-[11px] text-white/70 min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} className="flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.1)] w-7 h-7">
            <ZoomIn size={16} className="text-white" />
          </button>
          <div className="w-[1px] h-5 bg-white/20 mx-1" />
          <button onClick={() => { setViewMode('fit'); setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.1)] w-7 h-7">
            <Maximize2 size={16} className={viewMode === 'fit' ? 'text-[var(--accent-primary)]' : 'text-white'} />
          </button>
          <button onClick={() => setViewMode('actual')} className="flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.1)] w-7 h-7">
            <RotateCcw size={16} className={viewMode === 'actual' ? 'text-[var(--accent-primary)]' : 'text-white'} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsSlideshow(!isSlideshow)} className="flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.1)] w-7 h-7">
            {isSlideshow ? <Square size={16} className="text-[var(--accent-primary)]" /> : <Play size={16} className="text-white" />}
          </button>
          <button onClick={() => setShowInfo(!showInfo)} className="flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.1)] w-7 h-7">
            <Info size={16} className={showInfo ? 'text-[var(--accent-primary)]' : 'text-white'} />
          </button>
        </div>
      </div>

      {/* Image Display Area */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing relative"
        onMouseDown={(e) => {
          if (zoom > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
          }
        }}
        onMouseMove={(e) => {
          if (isDragging && zoom > 1) {
            setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
          }
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onWheel={(e) => {
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          setZoom((z) => Math.max(0.1, Math.min(5, z + delta)));
        }}
      >
        {displaySrc && (
          <img
            src={displaySrc}
            alt={currentImage.name}
            className="transition-transform select-none pointer-events-none"
            style={{
              transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
              maxWidth: viewMode === 'fit' ? '100%' : 'none',
              maxHeight: viewMode === 'fit' ? '100%' : 'none',
              objectFit: 'contain',
            }}
          />
        )}

        {/* Navigation Arrows */}
        {!isSlideshow && images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all z-10"
            >
              <ChevronLeft size={24} className="text-white" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all z-10"
            >
              <ChevronRight size={24} className="text-white" />
            </button>
          </>
        )}

        {/* Info Panel */}
        {showInfo && (
          <div className="absolute top-12 right-3 z-30 p-4 rounded-xl bg-black/80 backdrop-blur-lg border border-white/10 w-[220px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold text-white">Image Info</span>
              <button onClick={() => setShowInfo(false)}><X size={14} className="text-white/60" /></button>
            </div>
            <div className="flex flex-col gap-2">
              <InfoRow label="Name" value={currentImage.name} />
              <InfoRow label="Size" value={currentImage.size || 'Unknown'} />
              <InfoRow label="Index" value={`${currentIndex + 1} / ${images.length}`} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="h-8 flex items-center justify-between px-4 bg-black/60 backdrop-blur-md text-white/60 text-[11px] z-20">
        <span className="truncate max-w-[200px] text-white/80">{currentImage.name}</span>
        <span>{currentIndex + 1} / {images.length}</span>
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && !isSlideshow && (
        <div className="h-20 bg-[var(--bg-titlebar)] border-t border-[var(--border-subtle)] overflow-x-auto custom-scrollbar z-20">
          <div className="flex gap-2 p-2 h-full">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => { setCurrentIndex(i); setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
                className={`relative rounded-lg overflow-hidden transition-all shrink-0 w-[60px] h-full border-2 ${
                  i === currentIndex ? 'border-[var(--accent-primary)] opacity-100' : 'border-transparent opacity-60'
                }`}
              >
                {/* We use a tiny preview if possible or a generic icon */}
                <div className="w-full h-full bg-white/5 flex items-center justify-center text-[8px] text-center p-1 break-all">
                  {img.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[11px] text-white/50">{label}</span>
      <span className="text-[11px] text-white truncate ml-2">{value}</span>
    </div>
  );
}
