import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize, Minimize, Settings, Film, X
} from 'lucide-react';
import { useFileSystem } from '@/hooks/useFileSystem';

// ---- Types ----
interface VideoFile {
  id: string;
  name: string;
  duration: number;
  size: string;
  content?: string | Blob;
}

interface VideoPlayerProps {
  params?: {
    fileId?: string;
  };
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ---- Helpers ----
const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ---- Main Video Player ----
export default function VideoPlayer({ params }: VideoPlayerProps) {
  const { fs, getNodeById, getChildren } = useFileSystem();
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobUrls = useRef<Record<string, string>>({});

  // Load playlist from folder
  const playlist = useMemo(() => {
    if (!params?.fileId) return [];
    
    const file = getNodeById(params.fileId);
    if (!file) return [];

    const parentId = file.parentId;
    if (!parentId) return [file as any];

    const siblings = getChildren(parentId);
    const videoFiles = siblings.filter(n => 
      n.type === 'file' && 
      (n.name.toLowerCase().endsWith('.mp4') || 
       n.name.toLowerCase().endsWith('.webm') || 
       n.name.toLowerCase().endsWith('.mov'))
    );

    return videoFiles.map(f => ({
      id: f.id,
      name: f.name,
      duration: 0,
      size: `${Math.round((f.size || 0) / (1024 * 1024))} MB`,
      content: f.content
    }));
  }, [params?.fileId, fs.nodes]);

  // Set initial index
  useEffect(() => {
    if (params?.fileId && playlist.length > 0) {
      const index = playlist.findIndex(v => v.id === params.fileId);
      if (index !== -1) setCurrentIndex(index);
    }
  }, [params?.fileId, playlist.length]);

  // Handle current video change
  useEffect(() => {
    const video = playlist[currentIndex];
    if (!video || !videoRef.current) return;

    let url = blobUrls.current[video.id];
    if (!url && video.content instanceof Blob) {
      url = URL.createObjectURL(video.content);
      blobUrls.current[video.id] = url;
    }

    if (url) {
      videoRef.current.src = url;
      if (isPlaying) videoRef.current.play().catch(console.error);
    }
  }, [currentIndex, playlist]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(blobUrls.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const currentVideo = playlist[currentIndex];

  if (!currentVideo) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] bg-[#000]">
        <Film size={64} className="mb-4 opacity-10" />
        <p>Select a video to play</p>
      </div>
    );
  }

  return (
    <div
      ref={videoContainerRef}
      className="flex flex-col h-full relative group overflow-hidden"
      style={{ background: '#000' }}
      onMouseMove={handleMouseMove}
    >
      {/* Video Display Area */}
      <div className="flex-1 flex items-center justify-center relative bg-black">
        <video
          ref={videoRef}
          className="w-full h-full max-h-full"
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setIsPlaying(false)}
          onClick={handlePlayPause}
          playbackRate={playbackSpeed}
        />

        {/* Big Play Button when paused */}
        {!isPlaying && (
          <button
            onClick={handlePlayPause}
            className="absolute inset-0 m-auto w-20 h-20 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-white/20 hover:scale-110 transition-transform z-10"
          >
            <Play size={40} className="text-white ml-2" />
          </button>
        )}

        {/* Controls Overlay */}
        <div 
          className={`absolute bottom-0 left-0 right-0 p-4 pt-12 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 z-20 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Progress bar */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer mb-4"
            style={{ accentColor: 'var(--accent-primary)' }}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handlePlayPause} className="text-white hover:text-[var(--accent-primary)] transition-colors">
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              
              <div className="flex items-center gap-2">
                <button onClick={() => videoRef.current && (videoRef.current.currentTime -= 10)} className="text-white/80 hover:text-white">
                  <SkipBack size={18} />
                </button>
                <button onClick={() => videoRef.current && (videoRef.current.currentTime += 10)} className="text-white/80 hover:text-white">
                  <SkipForward size={18} />
                </button>
              </div>

              <span className="text-xs text-white/80 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Speed Menu */}
              <div className="relative">
                <button 
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="text-white/80 hover:text-white text-xs font-bold"
                >
                  {playbackSpeed}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-black/90 border border-white/10 rounded-lg overflow-hidden py-1 min-w-[60px]">
                    {SPEED_OPTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => { setPlaybackSpeed(s); setShowSpeedMenu(false); }}
                        className={`block w-full px-3 py-1 text-left text-[10px] hover:bg-white/10 ${s === playbackSpeed ? 'text-[var(--accent-primary)]' : 'text-white'}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2 group/volume">
                <button onClick={() => setVolume(v => v === 0 ? 0.7 : 0)} className="text-white/80 hover:text-white">
                  {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-0 group-hover/volume:w-20 transition-all h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: 'white' }}
                />
              </div>

              <button onClick={toggleFullscreen} className="text-white/80 hover:text-white">
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Playlist Strip */}
      {playlist.length > 1 && (
        <div className="h-24 bg-black border-t border-white/10 overflow-x-auto custom-scrollbar shrink-0">
          <div className="flex gap-2 p-2 h-full">
            {playlist.map((video, i) => (
              <button
                key={video.id}
                onClick={() => { setCurrentIndex(i); setIsPlaying(true); }}
                className={`flex flex-col gap-1 p-2 rounded-lg transition-all shrink-0 w-32 h-full border-2 text-left ${
                  i === currentIndex ? 'border-[var(--accent-primary)] bg-white/5' : 'border-transparent bg-white/5 opacity-60'
                }`}
              >
                <div className="text-[10px] text-white font-medium truncate w-full">{video.name}</div>
                <div className="text-[9px] text-white/40">{video.size}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
