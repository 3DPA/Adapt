import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Play, Sparkles, Loader2, Wand2, Mic, MicOff, Volume2, ShieldAlert, FileText } from 'lucide-react';
import { SceneData } from '../types';
import { cn } from '../lib/utils';
import { refineScene, generateSingleScene } from '../services/geminiService';

interface ScenePanelProps {
  index: number;
  data: SceneData;
  onUpdate: (field: keyof SceneData, value: string | boolean) => void;
}

const VoiceInput: React.FC<{ onTranscript: (text: string) => void; onListeningChange?: (listening: boolean) => void }> = ({ onTranscript, onListeningChange }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          onTranscript(finalTranscript);
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          console.warn('Speech recognition: No speech detected.');
        } else {
          console.error('Speech recognition error', event.error);
        }
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);

      setRecognition(rec);
    }
  }, [onTranscript]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      recognition?.stop();
    } else {
      try {
        recognition?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start recognition', err);
      }
    }
  };

  if (!recognition) return null;

  return (
    <button
      onClick={toggleListening}
      className={cn(
        "p-1.5 rounded-full transition-all border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none",
        isListening ? "bg-red-500 text-white voice-pulse" : "bg-white text-black hover:bg-gray-100"
      )}
      title={isListening ? "Stop Listening" : "Start Voice Input"}
    >
      {isListening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  );
};

export const ScenePanel: React.FC<ScenePanelProps> = ({ index, data, onUpdate }) => {
  const [isRefining, setIsRefining] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeField, setActiveField] = useState<'title' | 'visual' | 'narration' | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = async () => {
    if (!data.narration || isSpeaking) return;
    setIsSpeaking(true);
    
    // Attempt server-side Google TTS first
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.narration }),
      });
      const result = await response.json();
      
      if (result.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${result.audioContent}`);
        audio.onended = () => setIsSpeaking(false);
        audio.play();
        return; // Success
      } else {
        console.warn('Server-side TTS failed, falling back to browser speech:', result.error);
      }
    } catch (error) {
      console.warn('Server-side TTS error, falling back to browser speech:', error);
    }

    // Fallback: Browser Web Speech API
    try {
      const utterance = new SpeechSynthesisUtterance(data.narration);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (fallbackError) {
      console.error('All TTS methods failed:', fallbackError);
      setIsSpeaking(false);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    if (activeField) {
      const currentVal = data[activeField] as string;
      onUpdate(activeField, currentVal ? `${currentVal} ${text}` : text);
    } else {
      // If no field is focused, default to visual field
      const currentVal = data.visual;
      onUpdate('visual', currentVal ? `${currentVal} ${text}` : text);
    }
  };

  const handleRefine = async () => {
    const instruction = prompt('How should Gemini refine this scene? (e.g., "Make it more dramatic", "Add more detail to the background")');
    if (!instruction) return;

    setIsRefining(true);
    try {
      const result = await refineScene(data.visual, data.narration, instruction);
      onUpdate('visual', result.visual);
      onUpdate('narration', result.narration);
    } catch (error) {
      console.error('Refine error:', error);
      alert('Failed to refine scene.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerateSingle = async (customPrompt?: string) => {
    const promptText = customPrompt || prompt('What should happen in this specific scene?');
    if (!promptText) return;

    setIsGenerating(true);
    try {
      const result = await generateSingleScene(promptText);
      onUpdate('visual', result.visual);
      onUpdate('narration', result.narration);
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to generate scene.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "comic-panel flex flex-col p-4 h-full",
      )}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex flex-col">
          <span className="font-comic text-lg tracking-wide text-black">
            SCENE {index}
          </span>
          <span className="text-[10px] font-black text-success flex items-center gap-1">
            <ShieldAlert size={10} /> SECURITY CHECK: OK
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSpeak}
            disabled={!data.narration || isSpeaking}
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black transition-all border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none uppercase",
              isSpeaking ? "bg-accent text-white" : "bg-white text-black hover:bg-gray-100"
            )}
          >
            {isSpeaking ? "Speaking..." : "Narrate"}
          </button>
          <VoiceInput onTranscript={handleVoiceTranscript} onListeningChange={setIsVoiceListening} />
          <button
            onClick={() => handleGenerateSingle()}
            disabled={isGenerating || isRefining}
            className="bg-accent text-white p-1.5 rounded-full border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <input
          type="text"
          value={data.title || ''}
          onFocus={() => setActiveField('title')}
          onChange={(e) => onUpdate('title', e.target.value)}
          placeholder="SCENE TITLE..."
          className={cn(
            "w-full bg-white border-2 border-black p-2 font-comic text-sm text-black outline-none focus:bg-yellow-50 transition-colors",
            isVoiceListening && activeField === 'title' && "ring-2 ring-red-500 bg-red-50"
          )}
        />
      </div>

      <div className="relative flex-grow mb-3">
        <textarea
          value={data.visual}
          onFocus={() => {
            setIsFocused(true);
            setActiveField('visual');
          }}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 200);
          }}
          onChange={(e) => onUpdate('visual', e.target.value)}
          placeholder="[DESCRIBE VISUALS...]"
          className={cn(
            "w-full h-64 bg-white border-2 border-black p-3 pt-5 font-serif text-[13px] leading-relaxed text-black resize-none outline-none focus:bg-yellow-50 transition-colors",
            isVoiceListening && activeField === 'visual' && "ring-2 ring-red-500 bg-red-50"
          )}
        />
        <span className="absolute top-1 right-2 text-[8px] font-black opacity-50 pointer-events-none uppercase">
          {isVoiceListening && activeField === 'visual' ? "Listening..." : "Visuals"}
        </span>
        
        <AnimatePresence>
          {isFocused && !data.visual && !isGenerating && (
            <motion.button
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => handleGenerateSingle()}
              className="absolute inset-0 m-auto w-fit h-fit bg-white border-4 border-black text-black px-4 py-2 font-comic text-sm flex items-center gap-2 shadow-[4px_4px_0px_rgba(220,38,38,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_rgba(220,38,38,1)] transition-all"
            >
              <Wand2 size={16} />
              AI DRAW
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="relative mb-3">
        <textarea
          value={data.narration}
          onFocus={() => setActiveField('narration')}
          onChange={(e) => onUpdate('narration', e.target.value)}
          placeholder="[NARRATION SCRIPT...]"
          className={cn(
            "w-full h-24 bg-white border-2 border-black p-2 pt-4 font-serif italic text-[12px] text-black resize-none outline-none focus:bg-yellow-50 transition-colors",
            isVoiceListening && activeField === 'narration' && "ring-2 ring-red-500 bg-red-50"
          )}
        />
        <span className="absolute top-1 right-2 text-[8px] font-black opacity-50 pointer-events-none uppercase">
          {isVoiceListening && activeField === 'narration' ? "Listening..." : "Narration"}
        </span>
      </div>

      <button
        onClick={() => onUpdate('completed', !data.completed)}
        className={cn(
          "mt-3 self-end text-[10px] font-black border-2 border-black px-3 py-1 hover:bg-black hover:text-white transition-all uppercase flex items-center gap-1",
          data.completed ? "bg-success text-white" : "bg-white text-black"
        )}
      >
        {data.completed ? (
          <>
            DONE <Check size={12} />
          </>
        ) : "PENDING"}
      </button>
    </motion.div>
  );
};
