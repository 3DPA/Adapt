import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, getAdditionalUserInfo, sendEmailVerification } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, getDocs, query, orderBy, writeBatch } from 'firebase/firestore';
import { Settings, LogIn, LogOut, FileText, ExternalLink, Loader2, ShieldAlert, Mail, Sparkles, Play, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { debounce } from 'lodash';
import { auth, db } from './firebase';
import { SceneData } from './types';
import { ScenePanel } from './components/ScenePanel';
import { TeacherDashboard } from './components/TeacherDashboard';
import { GeminiAssistant } from './components/GeminiAssistant';
import { GeneratedScene } from './services/geminiService';

const SCENE_COUNT = 8;
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive.file'
];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Record<string, SceneData>>({});
  const [googleDocId, setGoogleDocId] = useState<string | null>(null);
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('Connecting...');
  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'doc' | 'slides' | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const scenesRef = useRef(scenes);
  const tokenRef = useRef(accessToken);
  const docIdRef = useRef(googleDocId);

  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { docIdRef.current = googleDocId; }, [googleDocId]);

  const autoSaveToGoogleDocs = useMemo(() => debounce(async () => {
    if (!tokenRef.current || !auth.currentUser) {
      if (auth.currentUser) {
        setCloudStatus('Sync Paused: Sign in to link Google Docs');
      }
      return;
    }
    
    try {
      setCloudStatus('Syncing to Google Docs...');
      const response = await fetch('/api/export/google-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: tokenRef.current,
          scenes: scenesRef.current,
          documentId: docIdRef.current,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setCloudStatus('Google Online');
        if (result.documentId && result.documentId !== docIdRef.current) {
          setGoogleDocId(result.documentId);
          await setDoc(doc(db, 'users', auth.currentUser.uid), { googleDocId: result.documentId }, { merge: true });
        }
      }
    } catch (error) {
      console.error('Auto-save to Google Docs network error:', error);
      setCloudStatus('Google Online');
    }
  }, 3000), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setCloudStatus('Google Online');
        setAuthError(null);
      } else {
        setUser(null);
        setAccessToken(null);
        setCloudStatus('Google Online');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAiGenerate = async (generatedScenes: GeneratedScene[]) => {
    if (!user) return;
    
    const batch = writeBatch(db);
    const newScenes: Record<string, SceneData> = {};
    const now = Date.now();

    for (let i = 0; i < generatedScenes.length; i++) {
      const index = i + 1;
      const sceneId = `scene_${index}`;
      const data = {
        title: `Scene ${index}: ${generatedScenes[i].visual.slice(0, 20)}...`,
        visual: generatedScenes[i].visual,
        narration: generatedScenes[i].narration,
        completed: false,
        updatedAt: now + i // Ensure unique timestamps for ordering
      };
      newScenes[sceneId] = data;
      
      const docRef = doc(db, 'users', user.uid, 'scenes', sceneId);
      batch.set(docRef, data);
    }
    
    try {
      setCloudStatus('Google Online');
      await batch.commit();
      setScenes(prev => ({ ...prev, ...newScenes }));
      setCloudStatus('Google Online');
      // Trigger auto-save to Google Docs
      autoSaveToGoogleDocs();
    } catch (error) {
      console.error('Error saving AI storyboard:', error);
      setCloudStatus('Google Online');
    }
  };

  const handleSignIn = async () => {
    if (isSigningIn) return;

    const provider = new GoogleAuthProvider();
    // Add scopes for Google Docs and Slides
    GOOGLE_SCOPES.forEach(scope => provider.addScope(scope));
    
    setIsSigningIn(true);
    setAuthError(null);
    try {
      setCloudStatus('Google Online');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Security Protocol: Restrict to adaptcn.org domain
      if (user.email && !user.email.endsWith('@adaptcn.org')) {
        await signOut(auth);
        setAuthError('Access Denied: Only @adaptcn.org email addresses are permitted to use this application.');
        setCloudStatus('Google Online');
        return;
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
      }
      setCloudStatus('Google Online');
    } catch (error: any) {
      console.error('Auth error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError('The sign-in window was closed before completion. If this keeps happening, try clicking "OPEN IN NEW TAB" below to sign in more reliably.');
        setCloudStatus('Google Online');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setAuthError('Multiple sign-in requests detected. Please wait.');
        setCloudStatus('Google Online');
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError('The sign-in popup was blocked by your browser. Please allow popups for this site or use the "OPEN IN NEW TAB" button below.');
        setCloudStatus('Google Online');
      } else {
        setAuthError(`Authentication failed: ${error.message}`);
        setCloudStatus('Google Online');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleSendVerification = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        setVerificationSent(true);
      } catch (error: any) {
        console.error('Verification error:', error);
        alert(`Error: ${error.message}`);
      }
    }
  };

  const handleExport = async (type: 'doc' | 'slides', forceNew: boolean = false) => {
    if (isSigningIn) return;
    if (!accessToken) {
      await handleSignIn();
      return;
    }

    setIsExporting(true);
    setExportUrl(null);
    setExportType(type);
    try {
      const endpoint = type === 'doc' ? '/api/export/google-doc' : '/api/export/google-slides';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          scenes,
          documentId: (type === 'doc' && !forceNew) ? googleDocId : null,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setExportUrl(result.url);
        if (type === 'doc' && result.documentId) {
          setGoogleDocId(result.documentId);
          // Save the documentId to Firestore for persistence
          if (user) {
            await setDoc(doc(db, 'users', user.uid), { googleDocId: result.documentId }, { merge: true });
          }
        }
        // Automatically open in new window as requested
        window.open(result.url, '_blank');
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error: any) {
      console.error('Export error:', error);
      alert(`Failed to export: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setScenes({});
      return;
    }

    // Scoped to User UID
    const q = query(collection(db, 'users', user.uid, 'scenes'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newScenes: Record<string, SceneData> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Migration: If narration is missing but dialogue exists, use dialogue
        newScenes[doc.id] = {
          title: data.title || '',
          visual: data.visual || '',
          narration: data.narration || data.dialogue || '',
          completed: !!data.completed,
          updatedAt: data.updatedAt || Date.now()
        } as SceneData;
      });
      
      const mergedScenes = { ...newScenes };
      for (let i = 1; i <= SCENE_COUNT; i++) {
        const id = `scene_${i}`;
        if (!mergedScenes[id]) {
          mergedScenes[id] = { title: '', visual: '', narration: '', completed: false, updatedAt: Date.now() };
        }
      }
      setScenes(mergedScenes);
    }, (error) => {
      console.error('Firestore error:', error);
      setCloudStatus('Google Online');
    });

    // Fetch user-level metadata (like googleDocId)
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.googleDocId) setGoogleDocId(data.googleDocId);
      } else {
        // Initialize user document if it doesn't exist
        setDoc(userDocRef, { 
          role: 'student', 
          email: user.email,
          updatedAt: Date.now() 
        }, { merge: true }).catch(err => console.error("Error initializing user:", err));
      }
    });

    return () => {
      unsubscribe();
      unsubscribeUser();
    };
  }, [user]);

  const updateScene = useCallback(async (index: number, field: keyof SceneData, value: string | boolean) => {
    if (!user) return;
    const sceneId = `scene_${index}`;
    // Scoped to User UID
    const docRef = doc(db, 'users', user.uid, 'scenes', sceneId);
    
    // Get current state to ensure all required fields are sent (satisfies security rules on first write)
    const currentScene = scenes[sceneId] || { title: '', visual: '', narration: '', completed: false, updatedAt: Date.now() };
    
    const updatedData = {
      title: currentScene.title || '',
      visual: currentScene.visual || '',
      narration: currentScene.narration || '',
      completed: !!currentScene.completed,
      ...currentScene,
      [field]: value,
      updatedAt: Date.now()
    };

    try {
      await setDoc(docRef, updatedData, { merge: true });
      // Trigger auto-save to Google Docs
      autoSaveToGoogleDocs();
    } catch (error) {
      console.error('Error saving scene:', error);
    }
  }, [user, scenes]);

  const refreshData = async () => {
    if (!user) return;
    try {
      // Scoped to User UID
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'scenes'));
      const newScenes: Record<string, SceneData> = {};
      snapshot.forEach((doc) => {
        newScenes[doc.id] = doc.data() as SceneData;
      });
      setScenes((prev) => ({ ...prev, ...newScenes }));
    } catch (error) {
      console.error('Refresh error:', error);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto flex flex-col">
      <header className="flex flex-col md:flex-row justify-between items-end mb-12 border-b-4 border-black pb-4">
        <div className="brand">
          <h1 className="comic-title">STORYBOARD</h1>
          <span className="font-comic text-sm text-white opacity-60 tracking-widest">ADAPT COMMUNITY NETWORK STORYBOARD CLASS</span>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-5 text-[12px] font-black uppercase">
            <div className="flex items-center gap-2 bg-white text-black border-2 border-black px-3 py-1 shadow-[2px_2px_0px_rgba(220,38,38,1)]">
              {cloudStatus.includes('Online') ? (
                <Check size={14} className="text-success stroke-[3px]" />
              ) : (
                <div className={`w-3 h-3 rounded-none border border-black ${cloudStatus.includes('Online') ? 'bg-success' : 'bg-red-500'}`} />
              )}
              {cloudStatus}
            </div>
            {user ? (
              <>
                <div className="hidden sm:block text-white font-black">{user.displayName || 'User'}</div>
                <button 
                  onClick={() => setIsAiMode(true)}
                  className="bg-accent text-white px-3 py-1 border-2 border-black font-black hover:bg-red-700 transition-colors flex items-center gap-1 shadow-[4px_4px_0px_rgba(220,38,38,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <Sparkles size={12} />
                  AI ASSISTANT
                </button>
                <button 
                  onClick={handleSignOut}
                  className="bg-white text-black border-2 border-black px-3 py-1 font-black hover:bg-gray-100 transition-colors flex items-center gap-1 shadow-[4px_4px_0px_rgba(220,38,38,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  SIGN OUT <LogOut size={12} />
                </button>
              </>
            ) : (
              <button 
                onClick={handleSignIn}
                className="bg-accent text-white px-6 py-2 border-2 border-black font-black hover:bg-red-700 transition-colors flex items-center gap-2 shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              >
                SIGN IN WITH GOOGLE <LogIn size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-grow">
        <AnimatePresence>
          {authError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="col-span-full bg-red-50 border-2 border-red-500 rounded-xl p-6 mb-8 flex flex-col items-center text-center shadow-[8px_8px_0px_var(--color-red-500)]"
            >
              <ShieldAlert size={48} className="text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-red-700 uppercase mb-2">Sign-In Error</h3>
              <p className="text-red-600 mb-6 max-w-md">{authError}</p>
              <div className="flex flex-wrap justify-center gap-4">
                <button 
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="bg-red-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-600 transition-colors shadow-[4px_4px_0px_rgba(0,0,0,0.2)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
                >
                  {isSigningIn ? "SIGNING IN..." : "RETRY SIGN-IN"}
                </button>
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white text-red-500 border-2 border-red-500 px-6 py-2 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  OPEN IN NEW TAB <ExternalLink size={16} />
                </a>
                <button 
                  onClick={() => setAuthError(null)}
                  className="text-red-400 px-6 py-2 rounded-lg font-bold hover:bg-red-50 transition-colors"
                >
                  DISMISS
                </button>
              </div>
            </motion.div>
          )}

          {user && !user.emailVerified && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="col-span-full bg-amber-50 border-2 border-amber-500 rounded-xl p-4 mb-4 flex items-center justify-between shadow-[4px_4px_0px_var(--color-amber-500)]"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="text-amber-600" />
                <div>
                  <p className="font-bold text-amber-700 uppercase text-xs tracking-tight">Email Verification Required</p>
                  <p className="text-xs text-amber-600">Please verify your email to access all features (including Admin Dashboard).</p>
                </div>
              </div>
              <button 
                onClick={handleSendVerification}
                disabled={verificationSent}
                className="bg-amber-500 text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 hover:bg-amber-600 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,0.2)] disabled:opacity-50"
              >
                {verificationSent ? "VERIFICATION SENT" : "SEND VERIFICATION EMAIL"} <Mail size={14} />
              </button>
            </motion.div>
          )}

          {exportUrl && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="col-span-full bg-green-50 border-2 border-success rounded-xl p-4 mb-4 flex items-center justify-between shadow-[4px_4px_0px_var(--color-success)]"
            >
              <div className="flex items-center gap-3">
                <FileText className="text-success" />
                <div>
                  <p className="font-bold text-success uppercase text-xs tracking-tight">Export Successful!</p>
                  <p className="text-xs text-green-700">Your storyboard has been saved to a new Google {exportType === 'doc' ? 'Doc' : 'Slides presentation'}.</p>
                </div>
              </div>
              <a 
                href={exportUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-success text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 hover:bg-green-600 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,0.2)]"
              >
                OPEN {exportType === 'doc' ? 'DOCUMENT' : 'PRESENTATION'} <ExternalLink size={14} />
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {!user ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-gray-300 rounded-xl">
            <h2 className="text-xl font-bold mb-4">Welcome to Storyboard Pro</h2>
            <p className="text-text-muted mb-6">Please sign in to start collaborating on your comic.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <button 
                onClick={handleSignIn}
                className="bg-accent text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center gap-3 shadow-[4px_4px_0px_var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                SIGN IN WITH GOOGLE <LogIn size={20} />
              </button>
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white text-accent border-2 border-accent px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition-all flex items-center gap-3"
              >
                OPEN IN NEW TAB <ExternalLink size={20} />
              </a>
            </div>
          </div>
        ) : (
          Array.from({ length: SCENE_COUNT }).map((_, i) => {
            const index = i + 1;
            const sceneId = `scene_${index}`;
            const data = scenes[sceneId] || { title: '', visual: '', narration: '', completed: false, updatedAt: 0 };
            return (
              <ScenePanel
                key={sceneId}
                index={index}
                data={data}
                onUpdate={(field, value) => updateScene(index, field, value)}
              />
            );
          })
        )}

        {user && (
          <div className="col-span-full flex flex-col items-center gap-8 mt-12 pb-12">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-8 w-full">
              <button 
                onClick={() => handleExport('doc')}
                disabled={isExporting}
                className="bg-white text-black border-4 border-black px-12 py-6 font-comic text-3xl hover:bg-gray-100 transition-all flex items-center gap-4 shadow-[12px_12px_0px_rgba(220,38,38,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
              >
                {isExporting && exportType === 'doc' ? <Loader2 size={32} className="animate-spin" /> : <FileText size={32} />}
                SAVE PROGRESS WITH GOOGLE DOCS
              </button>

              <button 
                onClick={() => handleExport('slides')}
                disabled={isExporting}
                className="bg-yellow-400 text-black border-4 border-black px-12 py-6 font-comic text-3xl hover:bg-yellow-500 transition-all flex items-center gap-4 shadow-[12px_12px_0px_rgba(220,38,38,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
              >
                {isExporting && exportType === 'slides' ? <Loader2 size={32} className="animate-spin" /> : <Play size={32} />}
                WEEK NINE: FINAL PROJECT (GOOGLE SLIDES)
              </button>
            </div>

            <button 
              onClick={() => handleExport('doc', true)}
              disabled={isExporting}
              className="bg-gray-800 text-white border-2 border-black px-6 py-3 font-black text-sm hover:bg-black transition-all flex items-center gap-2 shadow-[4px_4px_0px_rgba(220,38,38,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 uppercase tracking-widest"
            >
              <Settings size={16} />
              BACKUP PROGRESS (CREATE NEW DOC)
            </button>
          </div>
        )}
      </main>

      <footer className="mt-20 text-center opacity-40 text-xs italic font-sans">
        <p>© 2026 Storyboard Educational Tool - All changes are saved automatically.</p>
      </footer>

      <AnimatePresence>
        {isTeacherMode && (
          <TeacherDashboard
            scenes={scenes}
            onClose={() => setIsTeacherMode(false)}
            onRefresh={refreshData}
          />
        )}
        {isAiMode && (
          <GeminiAssistant
            onGenerate={handleAiGenerate}
            onClose={() => setIsAiMode(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
