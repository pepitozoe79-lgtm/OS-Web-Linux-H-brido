import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, ListMusic, Music
} from 'lucide-react';
import { useFileSystem } from '@/hooks/useFileSystem';

// ---- Types ----
interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  content?: string | Blob;
}

interface MusicPlayerProps {
  params?: {
    fileId?: string;
  };
}

// ---- Visualizer Bars ----
const VisualizerBars = memo(function VisualizerBars({ isPlaying }: { isPlaying: boolean }) {
  const [bars, setBars] = useState<number[]>(Array(32).fill(4));

  useEffect(() => {
    if (!isPlaying) {
      setBars(Array(32).fill(4));
      return;
    }
    const interval = setInterval(() => {
      setBars(Array.from({ length: 32 }, () => Math.random() * 40 + 4));
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="flex items-end justify-center gap-[2px]" style={{ height: 50 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="rounded-full transition-all"
          style={{
            width: 4,
            height: h,
            background: `linear-gradient(to top, var(--accent-primary), var(--accent-secondary))`,
            opacity: 0.6 + (i / 32) * 0.4,
          }}
        />
      ))}
    </div>
  );
});

// ---- Helpers ----
const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ---- Main Music Player ----
export default function MusicPlayer({ params }: MusicPlayerProps) {
  const { fs, getNodeById, getChildren } = useFileSystem();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off');
  const [showPlaylist, setShowPlaylist] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrls = useRef<Record<string, string>>({});

  // Initialize Audio object
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => handleNext();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Load playlist from folder
  const tracks = useMemo(() => {
    if (!params?.fileId) return [];
    
    const file = getNodeById(params.fileId);
    if (!file) return [];

    const parentId = file.parentId;
    if (!parentId) return [file as any];

    const siblings = getChildren(parentId);
    const audioFiles = siblings.filter(n => 
      n.type === 'file' && 
      (n.name.toLowerCase().endsWith('.mp3') || 
       n.name.toLowerCase().endsWith('.wav') || 
       n.name.toLowerCase().endsWith('.ogg'))
    );

    return audioFiles.map(f => ({
      id: f.id,
      title: f.name,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      duration: 0, // Will be updated on load
      content: f.content
    }));
  }, [params?.fileId, fs.nodes]);

  // Handle current track change
  useEffect(() => {
    const track = tracks[currentIndex];
    if (!track || !audioRef.current) return;

    let url = blobUrls.current[track.id];
    if (!url && track.content instanceof Blob) {
      url = URL.createObjectURL(track.content);
      blobUrls.current[track.id] = url;
    }

    if (url) {
      const wasPlaying = isPlaying;
      audioRef.current.src = url;
      if (wasPlaying) audioRef.current.play().catch(console.error);
    }
  }, [currentIndex, tracks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(blobUrls.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Initial index selection
  useEffect(() => {
    if (params?.fileId && tracks.length > 0) {
      const index = tracks.findIndex(t => t.id === params.fileId);
      if (index !== -1) setCurrentIndex(index);
    }
  }, [params?.fileId, tracks.length]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    if (isShuffle) {
      setCurrentIndex(Math.floor(Math.random() * tracks.length));
    } else {
      setCurrentIndex((prev) => (prev + 1) % tracks.length);
    }
    setIsPlaying(true);
  }, [isShuffle, tracks.length]);

  const handlePrev = useCallback(() => {
    if (!audioRef.current || tracks.length === 0) return;
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
    } else {
      setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    }
    setIsPlaying(true);
  }, [tracks.length]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
    if (audioRef.current) {
      audioRef.current.loop = repeatMode === 'one';
    }
  };

  const currentTrack = tracks[currentIndex];

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] bg-[var(--bg-window)]">
        <Music size={64} className="mb-4 opacity-10" />
        <p>Drop audio files to play</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ background: 'var(--bg-window)' }}>
      {/* Album Art Area */}
      <div className="flex flex-col items-center pt-6 pb-4">
        <div
          className="flex items-center justify-center rounded-xl mb-4 transition-transform"
          style={{
            width: 160, height: 160,
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            boxShadow: 'var(--shadow-lg)',
            animation: isPlaying ? 'pulse 2s infinite' : 'none',
          }}
        >
          <Music size={60} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>

        <div className="text-center px-4 w-full">
          <h2 className="text-base font-semibold text-[var(--text-primary)] truncate" title={currentTrack.title}>
            {currentTrack.title}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">
            {currentTrack.artist}
          </p>
        </div>
      </div>

      {/* Visualizer */}
      <div className="px-6 mb-2">
        <VisualizerBars isPlaying={isPlaying} />
      </div>

      {/* Progress Bar */}
      <div className="px-6 mb-2">
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-[var(--bg-hover)] rounded-full appearance-none cursor-pointer"
          style={{ accentColor: 'var(--accent-primary)' }}
        />
        <div className="flex justify-between mt-1 text-[10px] text-[var(--text-disabled)]">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-center gap-5 px-6 py-2">
        <button
          onClick={() => setIsShuffle((s) => !s)}
          className={`hover:scale-110 transition-transform ${isShuffle ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
        >
          <Shuffle size={18} />
        </button>
        <button onClick={handlePrev} className="text-[var(--text-primary)] hover:scale-110 transition-transform">
          <SkipBack size={24} />
        </button>
        <button
          onClick={handlePlayPause}
          className="flex items-center justify-center rounded-full bg-[var(--accent-primary)] text-white w-14 h-14 hover:scale-105 transition-transform shadow-lg"
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
        </button>
        <button onClick={handleNext} className="text-[var(--text-primary)] hover:scale-110 transition-transform">
          <SkipForward size={24} />
        </button>
        <button
          onClick={toggleRepeat}
          className={`hover:scale-110 transition-transform ${repeatMode !== 'off' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
        >
          {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
        </button>
      </div>

      {/* Volume + Playlist Row */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] mt-auto">
        <div className="flex items-center gap-2 flex-1 max-w-[140px]">
          <button onClick={() => setVolume(v => v === 0 ? 0.7 : 0)} className="text-[var(--text-secondary)]">
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="flex-1 h-1 bg-[var(--bg-hover)] rounded-full appearance-none cursor-pointer"
            style={{ accentColor: 'var(--accent-primary)' }}
          />
        </div>
        <button
          onClick={() => setShowPlaylist((s) => !s)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors ${showPlaylist ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
        >
          <ListMusic size={20} />
        </button>
      </div>

      {/* Playlist Panel */}
      {showPlaylist && (
        <div className="absolute inset-0 z-10 bg-[var(--bg-window)] animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between px-4 py-3 border-bottom border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-window)] z-10">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Playlist</span>
            <button onClick={() => setShowPlaylist(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <Icons.X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto custom-scrollbar h-[calc(100%-40px)]">
            {tracks.map((track, i) => (
              <div
                key={track.id}
                onClick={() => { setCurrentIndex(i); setIsPlaying(true); }}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-all ${
                  i === currentIndex ? 'bg-[var(--bg-selected)] border-l-4 border-[var(--accent-primary)]' : 'border-l-4 border-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className={`truncate text-xs ${i === currentIndex ? 'font-bold text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                    {track.title}
                  </div>
                  <div className="truncate text-[10px] text-[var(--text-secondary)]">
                    {track.artist}
                  </div>
                </div>
                {i === currentIndex && isPlaying && (
                   <div className="flex gap-[2px] items-end h-3">
                     <div className="w-[2px] bg-[var(--accent-primary)] animate-bounce h-2" style={{ animationDelay: '0.1s' }} />
                     <div className="w-[2px] bg-[var(--accent-primary)] animate-bounce h-3" style={{ animationDelay: '0.3s' }} />
                     <div className="w-[2px] bg-[var(--accent-primary)] animate-bounce h-1" style={{ animationDelay: '0.2s' }} />
                   </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
