import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useOS } from '@/hooks/useOSStore';
import { recoveryService } from '@/lib/vfs-recovery';
import { vfsDriver, generateHash } from '@/lib/vfs-db';

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
}

interface TerminalContext {
  currentPath: string;
  setCurrentPath: (path: string) => void;
  fs: ReturnType<typeof useFileSystem>;
  os: ReturnType<typeof useOS>;
  clear: () => void;
  history: string[];
}

const COMMANDS: Record<string, (args: string[], ctx: TerminalContext) => string | string[] | void | Promise<string | string[] | void>> = {
  help: () => [
    'Available commands:',
    '  ls [path]     - List directory contents',
    '  cd [path]     - Change directory',
    '  pwd           - Print working directory',
    '  mkdir <name>  - Create directory',
    '  touch <file>  - Create empty file',
    '  rm <name>     - Remove file or directory',
    '  cat <file>    - Display file contents',
    '  edit <file>   - Open file in Text Editor',
    '  echo <text>   - Print text',
    '  clear         - Clear terminal',
    '  whoami        - Print current user',
    '  date          - Print current date and time',
    '  uname         - Print system info',
    '  neofetch      - Display system information',
    '  mount         - Mount a host directory (File System Access API)',
    '  calc <expr>   - Calculate expression',
    '  history       - Show command history',
    '  bench         - Run VFS performance benchmark',
    '  backup        - Create a snapshot backup of the VFS',
    '  restore       - Restore VFS from a snapshot file',
    '  fsck          - File System Consistency Check (Integrity Audit)',
    '  help          - Show this help message',
  ],

  ls: (args, ctx) => {
    let targetPath = args[0] || '.';
    
    // Resolve relative path
    let absolutePath = '';
    if (targetPath.startsWith('/')) {
      absolutePath = targetPath;
    } else {
      const parts = ctx.currentPath.split('/').filter(Boolean);
      const relParts = targetPath.split('/').filter(Boolean);
      for (const p of relParts) {
        if (p === '..') parts.pop();
        else if (p !== '.') parts.push(p);
      }
      absolutePath = '/' + parts.join('/');
    }

    const node = ctx.fs.findNodeByPath(absolutePath);
    if (!node) return `ls: cannot access '${targetPath}': No such file or directory`;
    if (node.type === 'file') return node.name;

    const children = ctx.fs.getChildren(node.id);
    if (children.length === 0) return '';
    
    return children
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
      .map((c) => {
        const color = c.type === 'folder' ? '\x1b[34m' : '\x1b[0m';
        return `${color}${c.name}\x1b[0m`;
      })
      .join('  ');
  },

  cd: (args, ctx) => {
    if (!args[0] || args[0] === '~') {
      ctx.setCurrentPath('/home/user');
      return '';
    }
    
    let target = args[0];
    let absolutePath = '';
    if (target.startsWith('/')) {
      absolutePath = target;
    } else {
      const parts = ctx.currentPath.split('/').filter(Boolean);
      const relParts = target.split('/').filter(Boolean);
      for (const p of relParts) {
        if (p === '..') parts.pop();
        else if (p !== '.') parts.push(p);
      }
      absolutePath = '/' + parts.join('/');
    }

    const node = ctx.fs.findNodeByPath(absolutePath);
    if (!node) return `cd: no such file or directory: ${target}`;
    if (node.type !== 'folder') return `cd: not a directory: ${target}`;
    
    ctx.setCurrentPath(absolutePath);
    return '';
  },

  pwd: (_args, ctx) => ctx.currentPath,

  mkdir: (args, ctx) => {
    if (!args[0]) return 'mkdir: missing operand';
    const currentNode = ctx.fs.findNodeByPath(ctx.currentPath);
    if (!currentNode) return 'mkdir: cannot create directory';
    ctx.fs.createFolder(currentNode.id, args[0]);
    return '';
  },

  touch: (args, ctx) => {
    if (!args[0]) return 'touch: missing file operand';
    const currentNode = ctx.fs.findNodeByPath(ctx.currentPath);
    if (!currentNode) return 'touch: cannot create file';
    ctx.fs.createFile(currentNode.id, args[0]);
    return '';
  },

  rm: (args, ctx) => {
    if (!args[0]) return 'rm: missing operand';
    const currentNode = ctx.fs.findNodeByPath(ctx.currentPath);
    if (!currentNode) return 'rm: cannot access current directory';
    
    const children = ctx.fs.getChildren(currentNode.id);
    const target = children.find((c) => c.name === args[0]);
    
    if (!target) return `rm: cannot remove '${args[0]}': No such file or directory`;
    ctx.fs.deleteNode(target.id);
    return '';
  },

  cat: (args, ctx) => {
    if (!args[0]) return 'cat: missing file operand';
    const currentNode = ctx.fs.findNodeByPath(ctx.currentPath);
    if (!currentNode) return 'cat: cannot read file';
    
    const children = ctx.fs.getChildren(currentNode.id);
    const target = children.find((c) => c.name === args[0]);
    
    if (!target) return `cat: '${args[0]}': No such file or directory`;
    if (target.type === 'folder') return `cat: '${args[0]}': Is a directory`;
    
    const content = ctx.fs.readFile(target.id);
    if (content instanceof Blob) return '[Binary Data]';
    return content || '';
  },

  edit: (args, ctx) => {
    if (!args[0]) return 'edit: missing file operand';
    const currentNode = ctx.fs.findNodeByPath(ctx.currentPath);
    if (!currentNode) return 'edit: cannot open file';
    
    const children = ctx.fs.getChildren(currentNode.id);
    let target = children.find((c) => c.name === args[0]);
    
    let fileId = '';
    if (!target) {
      // Create file if it doesn't exist
      fileId = ctx.fs.createFile(currentNode.id, args[0]);
    } else {
      if (target.type === 'folder') return `edit: '${args[0]}': Is a directory`;
      fileId = target.id;
    }
    
    ctx.os.dispatch({ type: 'OPEN_WINDOW', appId: 'texteditor', params: { fileId } });
    return `Opening ${args[0]} in Text Editor...`;
  },

  echo: (args) => args.join(' '),

  clear: (_args, ctx) => {
    ctx.clear();
    return '';
  },

  whoami: () => 'user',

  date: () => new Date().toString(),

  uname: (args, ctx) => {
    const distro = ctx.os.state.theme.distro;
    return `${distro.charAt(0).toUpperCase() + distro.slice(1)}OS Web 1.0.0-generic x86_64`;
  },

  neofetch: (args, ctx) => {
    const distro = ctx.os.state.theme.distro;
    const colors: Record<string, string> = {
      ubuntu: '\x1b[31m', // Orange-red
      arch: '\x1b[36m',   // Cyan
      fedora: '\x1b[34m', // Blue
      kali: '\x1b[32m',   // Green
      debian: '\x1b[31m', // Red
    };
    const color = colors[distro] || '\x1b[35m';
    
    const logos: Record<string, string[]> = {
      ubuntu: [
        '         _    _  _   _  ____   ___  ____   _____ ',
        '        / \\  | || | / \\|  _ \\ / _ \\|  _ \\ / ____|',
        '       / _ \\ | || |/ _ \\ | | | | | | |_) | (___  ',
        '      / ___ \\|__   _/ ___ \\| |_| |  _ < \\___ \\ ',
        '     /_/   \\_\\_| |_/_/   \\_\\____/|_| \\_\\____/ ',
      ],
      arch: [
        '               __                     ',
        '              /  \\                    ',
        '             /    \\                   ',
        '            /      \\                  ',
        '           /   /\\   \\                 ',
        '          /   /  \\   \\                ',
        '         /___/    \\___\\               ',
      ],
      kali: [
        '              __                      ',
        '        _____/  |_                    ',
        '       /     \\   __\\                  ',
        '      |  Y Y  \\  |                    ',
        '      |__|_|  /__|                    ',
        '            \\/                        ',
      ],
      fedora: [
        '             _______                  ',
        '            /  ____/                  ',
        '           /  /___                    ',
        '          /  ____/                    ',
        '         /  /                         ',
        '        /__/                          ',
      ],
      debian: [
        '             _____                    ',
        '            /  __ \\                   ',
        '           |  /  \\ |                  ',
        '           |  |  | |                  ',
        '           |  \\__/ /                  ',
        '            \\_____/                   ',
      ]
    };

    const logo = logos[distro] || logos.ubuntu;
    const output = logo.map(line => `${color}${line}\x1b[0m`);
    
    output.push('');
    output.push(`\x1b[33muser\x1b[0m@\x1b[33m${distro}os-web\x1b[0m`);
    output.push('--------------');
    output.push(`\x1b[36mOS:\x1b[0m ${distro.charAt(0).toUpperCase() + distro.slice(1)}OS Web 1.0.0`);
    output.push(`\x1b[36mKernel:\x1b[0m browser-vfs-engine-1.0`);
    output.push(`\x1b[36mShell:\x1b[0m ubuntushell 2.0`);
    output.push(`\x1b[36mDE:\x1b[0m LinuxWeb Desktop`);
    output.push(`\x1b[36mTerminal:\x1b[0m vfs-terminal`);
    output.push(`\x1b[36mCPU:\x1b[0m WebAssembly V-Core`);
    output.push(`\x1b[36mMemory:\x1b[0m Browser Persistent IndexedDB`);
    output.push(`\x1b[36mTheme:\x1b[0m ${distro.charAt(0).toUpperCase() + distro.slice(1)} [GTK2/3]`);
    
    return output;
  },

  calc: (args) => {
    if (!args.length) return 'calc: missing expression';
    const expr = args.join('');
    try {
      const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '');
      if (sanitized !== expr) return 'calc: invalid characters';
      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + sanitized)();
      return String(result);
    } catch { return 'calc: error'; }
  },

  history: (_args, ctx) => ctx.history.map((cmd, i) => `${i + 1}  ${cmd}`),

  mount: async (args, ctx) => {
    if (!('showDirectoryPicker' in window)) {
      return 'mount: File System Access API is not supported in this browser.';
    }
    const currentFolder = ctx.fs.findNodeByPath(ctx.currentPath);
    if (!currentFolder || currentFolder.type !== 'folder') return 'mount: destination is not a directory';
    
    const mountId = await ctx.fs.mountHostDirectory(currentFolder.id);
    if (mountId) {
      const node = ctx.fs.getNodeById(mountId);
      return `Successfully mounted host directory: ${node?.name}`;
    }
    return 'mount: operation cancelled or failed.';
  },

  git: async (args, ctx) => {
    if (!args[0]) return 'git: missing command. Usage: git [clone|status|log]';
    
    const subCommand = args[0].toLowerCase();
    
    // Dynamic imports for git
    const [git, http, { createGitFs }] = await Promise.all([
      // @ts-ignore
      import('https://esm.sh/isomorphic-git'),
      // @ts-ignore
      import('https://esm.sh/isomorphic-git/http/web'),
      import('@/lib/git-bridge')
    ]);

    const gitFs = createGitFs(ctx.fs);
    const dir = ctx.currentPath;

    try {
      if (subCommand === 'clone') {
        const url = args[1];
        if (!url) return 'git clone: missing URL';
        
        const folderName = url.split('/').pop()?.replace('.git', '') || 'repo';
        const targetDir = dir === '/' ? `/${folderName}` : `${dir}/${folderName}`;
        
        // Ensure directory exists
        try { await gitFs.mkdir(targetDir); } catch (e) {}

        ctx.clear(); // Clear to show progress better
        return new Promise<string>((resolve) => {
          git.clone({
            fs: gitFs,
            http,
            dir: targetDir,
            url,
            corsProxy: 'https://cors.isomorphic-git.org',
            onMessage: (msg) => {
              // We can't easily push to Terminal lines from here without a refactor,
              // so we just log to console or return at the end.
              console.log('Git:', msg);
            }
          }).then(() => {
            resolve(`Successfully cloned ${url} into ${targetDir}`);
          }).catch(err => {
            resolve(`git clone error: ${err.message}`);
          });
        });
      }

      if (subCommand === 'status') {
        const status = await git.statusMatrix({ fs: gitFs, dir });
        return status.map(row => {
          const [file, head, workdir, stage] = row;
          return `${file}: ${head === workdir ? 'Clean' : 'Modified'}`;
        });
      }

      if (subCommand === 'log') {
        const commits = await git.log({ fs: gitFs, dir, depth: 5 });
        return commits.map(c => {
          const { oid, commit } = c;
          return `\x1b[33m${oid.slice(0, 7)}\x1b[0m ${commit.message} (${commit.author.name})`;
        });
      }

      return `git: '${subCommand}' is not implemented yet.`;
    } catch (err: any) {
      return `git error: ${err.message}`;
    }
  },

  bench: async (_args, _ctx) => {
    try {
      // @ts-ignore - dynamic import
      const { default: runBenchmark } = await import('../tests/vfs-bench');
      const results = await runBenchmark();
      return [
        '\x1b[36m🚀 VFS Performance Audit Results:\x1b[0m',
        `  Write (500 files): ${results.write.toFixed(2)}ms`,
        `  Read (500 files):  ${results.read.toFixed(2)}ms`,
        `  Integrity:         ${results.integrity === 500 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'}`,
        '',
        'Detailed table available in browser console.'
      ];
    } catch (err: any) {
      return `bench error: ${err.message}`;
    }
  },

  backup: async (_args, _ctx) => {
    try {
      const blob = await recoveryService.createSnapshot();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vfs-snapshot-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return 'Snapshot backup generated and download started successfully.';
    } catch (err: any) {
      return `backup error: ${err.message}`;
    }
  },

  restore: async (_args, _ctx) => {
    return new Promise<string>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) {
          resolve('Restore cancelled.');
          return;
        }
        try {
          const meta = await recoveryService.restoreFromSnapshot(file);
          resolve(`Restore successful! System: ${meta.system}, Version: ${meta.version}, Date: ${new Date(meta.timestamp).toLocaleString()}. Please refresh or restart the OS.`);
        } catch (err: any) {
          resolve(`restore error: ${err.message}`);
        }
      };
      input.click();
    });
  },

  fsck: async (args, ctx) => {
    try {
      const repair = args.includes('--repair');
      const outputs: string[] = [
        `\x1b[36m🔍 Starting File System Consistency Check${repair ? ' (REPAIR MODE)' : ''}...\x1b[0m`,
        ''
      ];

      const report = await vfsDriver.fsck(repair);

      if (report.corrupted.length > 0) {
        report.corrupted.forEach(name => outputs.push(`\x1b[31m[CORRUPT]\x1b[0m ${name}`));
      }
      if (report.orphans.length > 0) {
        report.orphans.forEach(name => outputs.push(`\x1b[33m[ORPHAN]\x1b[0m  ${name}`));
      }

      outputs.push('');
      outputs.push('\x1b[36m📊 FSCK Report:\x1b[0m');
      outputs.push(`  - Healthy Files:   ${report.healthy}`);
      outputs.push(`  - \x1b[31mCorrupted Files: ${report.corrupted.length}\x1b[0m`);
      outputs.push(`  - \x1b[33mOrphan Nodes:    ${report.orphans.length}\x1b[0m`);
      outputs.push('');

      if (repair) {
        outputs.push('\x1b[32m🔧 Repair operation completed.\x1b[0m');
        outputs.push('  - Corrupted files moved to /lost+found');
        outputs.push('  - Orphan nodes linked to /');
        outputs.push('');
      }

      outputs.push(report.corrupted.length === 0 && report.orphans.length === 0 
        ? '\x1b[32m✅ File system is CONSISTENT.\x1b[0m' 
        : `\x1b[31m❌ Inconsistencies detected.${repair ? '' : " Run 'fsck --repair' to fix."}\x1b[0m`);

      return outputs;
    } catch (err: any) {
      return `fsck error: ${err.message}`;
    }
  },
};

export default function Terminal() {
  const fs = useFileSystem();
  const os = useOS();
  
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'system', text: `Welcome to ${os.state.theme.distro.charAt(0).toUpperCase() + os.state.theme.distro.slice(1)}OS Terminal` },
    { type: 'system', text: 'VFS Control System v2.0 - Persistent IndexedDB' },
    { type: 'system', text: 'Type "help" for available commands.' },
    { type: 'output', text: '' },
  ]);
  
  const [input, setInput] = useState('');
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const clear = useCallback(() => setLines([]), []);

  const executeCommand = useCallback(
    async (cmdLine: string) => {
      const trimmed = cmdLine.trim();
      if (!trimmed) {
        setLines((prev) => [...prev, { type: 'input', text: trimmed }, { type: 'output', text: '' }]);
        return;
      }

      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      setLines((prev) => [...prev, { type: 'input', text: trimmed }]);
      setHistory((prev) => [...prev, trimmed]);

      const ctx: TerminalContext = {
        currentPath,
        setCurrentPath,
        fs,
        os,
        clear,
        history: [...history, trimmed],
      };

      const handler = COMMANDS[cmd];
      if (handler) {
        try {
          const result = await handler(args, ctx);
          if (result && result !== '') {
            if (Array.isArray(result)) {
              result.forEach((line) => setLines((prev) => [...prev, { type: 'output', text: line }]));
            } else {
              setLines((prev) => [...prev, { type: 'output', text: result }]);
            }
          }
        } catch (err) {
          setLines((prev) => [...prev, { type: 'error', text: `Error: ${err}` }]);
        }
      } else {
        setLines((prev) => [...prev, { type: 'error', text: `${cmd}: command not found` }]);
      }
    },
    [currentPath, fs, os, clear, history]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        executeCommand(input);
        setInput('');
        setHistoryIndex(-1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex === -1) setSavedInput(input);
        const newIndex = historyIndex + 1;
        if (newIndex < history.length) {
          setHistoryIndex(newIndex);
          setInput(history[history.length - 1 - newIndex]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          setInput(savedInput);
        } else {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(history[history.length - 1 - newIndex]);
        }
      }
    },
    [input, executeCommand, history, historyIndex, savedInput]
  );

  const parseAnsi = (text: string): React.ReactNode[] => {
    if (!text.includes('\x1b[')) return [text];
    const parts: React.ReactNode[] = [];
    const regex = /\x1b\[(\d+)m/g;
    let lastIndex = 0;
    let currentColor = '';
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++} style={{ color: currentColor }}>{text.slice(lastIndex, match.index)}</span>);
      }
      const code = parseInt(match[1], 10);
      switch (code) {
        case 31: currentColor = '#F44336'; break;
        case 32: currentColor = '#4CAF50'; break;
        case 33: currentColor = '#FF9800'; break;
        case 34: currentColor = '#2196F3'; break;
        case 35: currentColor = '#7C4DFF'; break;
        case 36: currentColor = '#00BCD4'; break;
        case 37: currentColor = '#E0E0E0'; break;
        case 0: currentColor = ''; break;
        default: currentColor = '';
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={key++} style={{ color: currentColor }}>{text.slice(lastIndex)}</span>);
    }
    return parts;
  };

  return (
    <div
      className="flex flex-col h-full font-mono text-xs select-text cursor-text overflow-hidden"
      style={{
        background: '#0C0C0C',
        color: '#E0E0E0',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all leading-relaxed mb-1">
            {line.type === 'input' && (
              <span className="flex items-center gap-1">
                <span className="text-[#4CAF50] font-bold">{currentPath}$</span>
                <span>{line.text}</span>
              </span>
            )}
            {line.type === 'output' && <div className="text-[#E0E0E0]">{parseAnsi(line.text)}</div>}
            {line.type === 'error' && <div className="text-[#F44336]">{line.text}</div>}
            {line.type === 'system' && <div className="text-[#9E9E9E] italic">{line.text}</div>}
          </div>
        ))}

        <div className="flex items-center gap-2 mt-2">
          <span className="text-[#4CAF50] font-bold shrink-0">{currentPath}$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-[#E0E0E0] min-w-0"
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
