// ============================================================
// TopPanel — Activities button, clock, system tray
// ============================================================

import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { format } from 'date-fns';
import { Wifi, Volume2, Battery, Power, Keyboard, Accessibility } from 'lucide-react';
import { useOS } from '@/hooks/useOSStore';

const DISTRO_LOGOS: Record<string, string> = {
  ubuntu: '🟠',
  arch: '💠',
  fedora: '💙',
  kali: '🐉',
  debian: '🍥',
  manjaro: '🌿',
  redhat: '🎩',
  mint: '🍃',
  centos: '🔷',
  raspberry: '🍓',
};

const DISTRO_NAMES: Record<string, string> = {
  ubuntu: 'Ubuntu',
  arch: 'Arch Linux',
  fedora: 'Fedora',
  kali: 'Kali Linux',
  debian: 'Debian',
  manjaro: 'Manjaro',
  redhat: 'Red Hat Enterprise Linux',
  mint: 'Linux Mint',
  centos: 'CentOS',
  raspberry: 'Raspberry Pi OS',
};

const TopPanel = memo(function TopPanel() {
  const { state, dispatch } = useOS();
  const [time, setTime] = useState(new Date());
  const [sysMenuOpen, setSysMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const currentDistro = state.theme.distro || 'ubuntu';

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sysMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSysMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sysMenuOpen]);

  const handleActivities = useCallback(() => {
    dispatch({ type: 'TOGGLE_APP_LAUNCHER' });
  }, [dispatch]);

  const handleClockClick = useCallback(() => {
    dispatch({ type: 'TOGGLE_NOTIFICATION_CENTER' });
  }, [dispatch]);

  const formattedTime = format(time, 'EEE h:mm a');
  const formattedDate = format(time, 'EEEE, MMMM d, yyyy');

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between px-2 text-xs font-medium select-none"
      style={{
        height: 28,
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Left: Activities */}
      <div className="flex items-center">
        <button
          onClick={handleActivities}
          className="h-7 px-3 rounded hover:bg-[var(--bg-hover)] transition-colors text-xs font-medium flex items-center gap-2"
        >
          <span className="text-sm">{DISTRO_LOGOS[currentDistro]}</span>
          Activities
        </button>
      </div>

      {/* Center: Clock */}
      <button
        onClick={handleClockClick}
        className="absolute left-1/2 -translate-x-1/2 h-7 px-2 rounded hover:bg-[var(--bg-hover)] transition-colors text-xs font-medium group relative"
      >
        <span>{formattedTime}</span>
        {/* Tooltip */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded bg-[var(--bg-tooltip)] text-[var(--text-primary)] text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[5000]">
          {formattedDate}
        </div>
      </button>

      {/* Right: System tray */}
      <div className="flex items-center gap-1">
        <button className="h-7 px-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors">
          <Accessibility size={14} />
        </button>
        <button className="h-7 px-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors">
          <Keyboard size={14} />
        </button>
        <button className="h-7 px-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors">
          <Wifi size={14} />
        </button>
        <button className="h-7 px-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors">
          <Volume2 size={14} />
        </button>
        <button className="h-7 px-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1">
          <Battery size={14} />
          <span className="text-[10px]">100%</span>
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setSysMenuOpen(!sysMenuOpen)}
            className="h-7 px-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Power size={14} />
          </button>
 
          {sysMenuOpen && (
            <div
              className="absolute top-full right-0 mt-1 py-2 rounded-lg z-[5000]"
              style={{
                background: 'var(--bg-context-menu)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-default)',
                width: 240,
                animation: 'menuAppear 120ms cubic-bezier(0, 0, 0.2, 1)',
              }}
            >
              {/* User row */}
              <div className="flex items-center gap-2 px-3 py-2 mb-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-inner" style={{ background: state.theme.accent }}>
                  <span className="text-white text-xs font-bold">{DISTRO_LOGOS[currentDistro]}</span>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{state.auth.userName}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] truncate">{DISTRO_NAMES[currentDistro]} Edition</span>
                </div>
                <button
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--bg-hover)]"
                  onClick={() => {
                    setSysMenuOpen(false);
                    dispatch({ type: 'OPEN_WINDOW', appId: 'settings' });
                  }}
                >
                  <span className="text-xs">⚙</span>
                </button>
              </div>

              <div className="my-1 mx-2" style={{ height: 1, background: 'var(--border-subtle)' }} />

              {[
                { label: 'Wired Connection', icon: '🌐', toggle: true },
                { label: 'Wi-Fi', icon: '📶', toggle: true },
                { label: 'Bluetooth', icon: '🔵', toggle: true },
              ].map((item) => (
                <div 
                  key={item.label} 
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] cursor-pointer"
                  onClick={() => {
                    if (item.label === 'Wi-Fi') dispatch({ type: 'ADD_NOTIFICATION', notification: { appId: 'system', appName: 'System', appIcon: 'Wifi', title: 'Network', message: 'Wi-Fi toggled', isRead: false }});
                  }}
                >
                  <span className="text-xs">{item.icon}</span>
                  <span className="text-sm flex-1">{item.label}</span>
                  {item.toggle && (
                    <button 
                      className="w-8 h-5 rounded-full relative transition-colors" 
                      style={{ background: 'var(--accent-primary)' }}
                    >
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm" />
                    </button>
                  )}
                </div>
              ))}

              <div className="my-1 mx-2" style={{ height: 1, background: 'var(--border-subtle)' }} />

              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors text-left"
                onClick={() => { setSysMenuOpen(false); dispatch({ type: 'LOGOUT' }); }}
              >
                <span>🔒</span>
                Lock
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors text-left"
                onClick={() => { setSysMenuOpen(false); dispatch({ type: 'LOGOUT' }); }}
              >
                <span>🚪</span>
                Log Out
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors text-left"
                onClick={() => {
                  setSysMenuOpen(false);
                  if (confirm('Are you sure you want to power off?')) {
                    dispatch({ type: 'SET_BOOT_PHASE', phase: 'off' });
                    window.location.reload();
                  }
                }}
              >
                <span>⏻</span>
                Power Off / Restart
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes menuAppear {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
});

export default TopPanel;
