import React, { useState } from 'react';
import { Sparkles, Loader2, X, Wand2 } from 'lucide-react';
import { motion } from 'motion/react';
import { generateStoryboard, GeneratedScene } from '../services/geminiService';

interface GeminiAssistantProps {
  onGenerate: (scenes: GeneratedScene[]) => void;
  onClose: () => void;
}

export function GeminiAssistant({ onGenerate, onClose }: GeminiAssistantProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateStoryboard(prompt, 8);
      onGenerate(result);
      onClose();
    } catch (err: any) {
      console.error('Gemini error:', err);
      setError('Failed to generate storyboard. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-white border-4 border-border w-full max-w-lg rounded-2xl overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,1)]">
        <div className="bg-accent text-white p-4 flex justify-between items-center border-b-4 border-border">
          <div className="flex items-center gap-2">
            <Sparkles size={20} />
            <h2 className="font-bold uppercase tracking-tight">Gemini AI Assistant</h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-text-muted mb-4 font-serif italic">
            Describe your story idea, and Gemini will generate an 8-panel storyboard for you.
          </p>
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A futuristic detective investigating a neon-lit mystery in Tokyo..."
            className="w-full h-32 p-4 border-2 border-border rounded-xl mb-4 focus:ring-2 focus:ring-accent outline-none resize-none font-sans text-sm"
          />
          
          {error && (
            <p className="text-red-500 text-xs font-bold mb-4 uppercase tracking-tight">{error}</p>
          )}
          
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="w-full bg-accent text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-[4px_4px_0px_var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                GENERATING STORYBOARD...
              </>
            ) : (
              <>
                <Wand2 size={20} />
                GENERATE FULL STORYBOARD
              </>
            )}
          </button>
        </div>
        
        <div className="bg-gray-50 p-4 border-t-2 border-border text-[10px] text-gray-400 uppercase font-bold text-center">
          Powered by Gemini 3 Flash • AI generated content may require refinement
        </div>
      </div>
    </motion.div>
  );
}
