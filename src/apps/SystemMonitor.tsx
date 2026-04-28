import { useState, useEffect } from 'react';
import { Activity, Database, Cpu, HardDrive, BarChart3 } from 'lucide-react';

export default function SystemMonitor() {
  const [storage, setStorage] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });
  const [cpuUsage, setCpuUsage] = useState<number[]>(Array(20).fill(0));
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setUptime(Math.floor((Date.now() - startTime) / 1000));
      
      // Simulate CPU usage variation
      setCpuUsage(prev => {
        const next = [...prev.slice(1), Math.random() * 40 + 10];
        return next;
      });
    }, 1000);

    const updateStorage = async () => {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setStorage({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0
        });
      }
    };

    updateStorage();
    const storageInterval = setInterval(updateStorage, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(storageInterval);
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const usagePercent = storage.quota > 0 ? (storage.usage / storage.quota) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-window)] text-[var(--text-primary)] p-4 font-sans select-none overflow-auto custom-scrollbar">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="text-[var(--accent-primary)]" size={24} />
        <h2 className="text-lg font-bold">System Monitor</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Storage Card */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-titlebar)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="text-[var(--accent-primary)]" size={18} />
              <span className="text-sm font-semibold">IndexedDB Storage</span>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)]">{formatBytes(storage.usage)} / {formatBytes(storage.quota)}</span>
          </div>
          
          <div className="h-2 w-full bg-[var(--bg-hover)] rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-[var(--accent-primary)] transition-all duration-1000" 
              style={{ width: `${Math.max(1, usagePercent)}%` }} 
            />
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]">
            Used for persistent virtual file system and Git repositories.
          </p>
        </div>

        {/* Resources Card */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-titlebar)]">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="text-[var(--accent-primary)]" size={18} />
            <span className="text-sm font-semibold">Virtual Core</span>
          </div>
          <div className="flex items-end gap-1 h-12">
            {cpuUsage.map((val, i) => (
              <div 
                key={i} 
                className="flex-1 bg-[var(--accent-primary)] opacity-60 rounded-t-sm transition-all duration-500" 
                style={{ height: `${val}%` }} 
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-[var(--text-secondary)]">
            <span>Uptime: {formatUptime(uptime)}</span>
            <span>Load: {Math.round(cpuUsage[cpuUsage.length-1])}%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Process List</h3>
        {[
          { name: 'System Shell', cpu: '0.2%', mem: '12MB', icon: <BarChart3 size={14}/> },
          { name: 'VFS Daemon', cpu: '1.5%', mem: '45MB', icon: <HardDrive size={14}/> },
          { name: 'Window Manager', cpu: '0.8%', mem: '32MB', icon: <Activity size={14}/> },
        ].map((proc, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] border border-transparent hover:border-[var(--border-subtle)] transition-all">
            <div className="p-2 rounded bg-[var(--bg-window)] text-[var(--accent-primary)]">
              {proc.icon}
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium">{proc.name}</div>
              <div className="text-[10px] text-[var(--text-secondary)]">PID: {100 + i} • Running</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-[var(--accent-primary)]">{proc.cpu} CPU</div>
              <div className="text-[10px] text-[var(--text-secondary)]">{proc.mem} RAM</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
