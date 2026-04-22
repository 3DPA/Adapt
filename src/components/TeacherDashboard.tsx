import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw } from 'lucide-react';
import { SceneData } from '../types';

interface TeacherDashboardProps {
  scenes: Record<string, SceneData>;
  onClose: () => void;
  onRefresh: () => void;
}

export function TeacherDashboard({ scenes, onClose, onRefresh }: TeacherDashboardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-4 md:inset-10 z-50 bg-card-bg border-4 border-border shadow-[15px_15px_0px_rgba(0,0,0,0.3)] rounded-xl p-6 md:p-8 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl md:text-3xl font-extrabold font-sans text-text-main uppercase tracking-tighter">TEACHER BACKEND VIEW</h2>
        <button
          onClick={onClose}
          className="bg-red-500 text-white px-4 py-2 rounded font-bold hover:bg-red-600 flex items-center gap-2 transition-colors border-2 border-border shadow-[4px_4px_0px_var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          CLOSE <X size={20} />
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <button
          onClick={onRefresh}
          className="bg-accent text-white px-6 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2 transition-colors border-2 border-border shadow-[4px_4px_0px_var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          REFRESH DATA <RefreshCw size={20} />
        </button>
        <p className="text-sm font-sans text-text-muted self-center italic">
          Monitoring all 8 scenes in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left font-sans text-sm">
        {Object.entries(scenes)
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([id, data]) => (
            <div key={id} className="p-5 border-2 border-border rounded-xl bg-white text-text-main shadow-[4px_4px_0px_var(--color-border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_var(--color-border)] transition-all">
              <div className="flex justify-between items-center font-extrabold border-b-2 border-border mb-4 pb-2 uppercase tracking-wider">
                <span>{data.title || id.replace('_', ' ')}</span>
                <span className={data.completed ? "text-success" : "text-amber-500"}>
                  {data.completed ? '✓ COMPLETED' : '⏳ IN PROGRESS'}
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase text-text-muted font-extrabold mb-1">Visual Description:</div>
                  <div className="p-3 bg-gray-100 rounded-md border border-dashed border-gray-300 font-serif italic text-text-main min-h-[60px]">
                    {data.visual || <span className="text-gray-400">(empty)</span>}
                  </div>
                </div>
                
                <div>
                  <div className="text-[10px] uppercase text-text-muted font-extrabold mb-1">Narration:</div>
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-200 font-serif italic text-text-main min-h-[40px]">
                    {data.narration || <span className="text-gray-400">(empty)</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </motion.div>
  );
}
