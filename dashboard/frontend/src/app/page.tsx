'use client';

import { useQuery } from '@tanstack/react-query';
import { getLogs, getGlobalLogs, Log } from '@/lib/api/logs';
import { format } from 'date-fns';
import { Terminal, GitBranch, Hash, Clock, Search, Filter, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export default function Dashboard() {
  const [view, setView] = useState<'timeline' | 'global'>('timeline');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs', view],
    queryFn: () => (view === 'global' ? getGlobalLogs() : getLogs()),
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-[#0d0d0d] p-6 hidden md:flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Logloop
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Context Navigator</p>
        </div>

        <nav className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-2">Menu</div>
          <button
            onClick={() => setView('timeline')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              view === 'timeline' ? 'bg-zinc-800/50 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800/20'
            }`}
          >
            <Terminal size={16} className={view === 'timeline' ? 'text-indigo-400' : ''} />
            Timeline
          </button>
          <button
            onClick={() => setView('global')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              view === 'global' ? 'bg-zinc-800/50 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800/20'
            }`}
          >
            <Globe size={16} className={view === 'global' ? 'text-cyan-400' : ''} />
            Global History
          </button>
        </nav>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-4">Filters</div>
          {/* Add filters component here */}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-[#0a0a0a] relative overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-8 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Search logs, commits, tags..."
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-400 hover:text-white transition-colors">
              <Filter size={18} />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500" />
          </div>
        </header>

        {/* Timeline View */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-4xl mx-auto relative">
            {/* Timeline Line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/50 via-zinc-800 to-transparent" />

            <div className="space-y-12">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20 text-zinc-500 animate-pulse">
                    Loading timeline...
                  </div>
                ) : logs?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-4">
                    <Terminal size={48} className="opacity-20" />
                    <p>No logs found. Run `logloop` to start tracking.</p>
                  </div>
                ) : (
                  logs?.map((log, index) => (
                    <LogCard key={log.id} log={log} index={index} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LogCard({ log, index }: { log: Log; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative pl-12 group"
    >
      {/* Timeline Dot */}
      <div className="absolute left-[13px] top-2 h-[7px] w-[7px] rounded-full bg-indigo-500 ring-4 ring-indigo-500/20 z-10 group-hover:scale-150 transition-transform" />

      <div className="bg-[#121212] border border-zinc-800 hover:border-zinc-700 p-5 rounded-2xl transition-all hover:shadow-2xl hover:shadow-indigo-500/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono mb-2">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {format(new Date(log.createdAt), 'HH:mm:ss')}
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="text-indigo-400 font-bold uppercase tracking-widest">{log.project.name}</span>
            </div>
            
            <p className="text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap">
              {log.message}
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              {log.tags.map(tag => (
                <span key={tag.id} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  #{tag.name}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {log.branch && (
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
                <GitBranch size={12} />
                {log.branch}
              </div>
            )}
            {log.commitHash && (
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
                <Hash size={12} />
                {log.commitHash.slice(0, 7)}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
