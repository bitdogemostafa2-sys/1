
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ContentEngine } from './components/ContentEngine';
import { VisualStudio } from './components/VisualStudio';
import { StrategyHub } from './components/StrategyHub';
import { AudioStudio } from './components/AudioStudio';
import { SmartEditor } from './components/SmartEditor';
import { Publishing } from './components/Publishing';
import { Settings } from './components/Settings';
import { ViewState, ProjectState, GlobalTask, Channel } from './types';
import { Loader2, Minimize2, Maximize2, X, CheckCircle, AlertCircle, Save, History } from 'lucide-react';
import { gatherFullState, saveLocalBackup, loadProjectFromDB, saveProjectToDB } from './services/storageService';

const App: React.FC = () => {
  // --- View Persistence ---
  const [currentView, setCurrentView] = useState<ViewState>(() => {
      try {
          const savedView = localStorage.getItem('autoTube_currentView');
          return (savedView as ViewState) || ViewState.DASHBOARD;
      } catch {
          return ViewState.DASHBOARD;
      }
  });

  useEffect(() => {
      localStorage.setItem('autoTube_currentView', currentView);
  }, [currentView]);

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showRestoreToast, setShowRestoreToast] = useState(false);
  const [activeTask, setActiveTask] = useState<GlobalTask | null>(null);

  // --- Helper to Sanitize Channels ---
  const sanitizeChannels = (data: any): Channel[] => {
      if (!Array.isArray(data)) return [];
      return data.filter(c => c && typeof c === 'object' && c.id && c.name);
  };

  // --- Channels State (Sync Init) ---
  const [channels, setChannels] = useState<Channel[]>(() => {
      try {
          // 1. Try Main Storage
          const local = localStorage.getItem('autoTube_channels');
          if (local && local !== '[]') {
              const parsed = JSON.parse(local);
              const sanitized = sanitizeChannels(parsed);
              if (sanitized.length > 0) return sanitized;
          }

          // 2. Try Safety Backup
          const backup = localStorage.getItem('autoTube_channels_BACKUP');
          if (backup && backup !== '[]') {
              const parsed = JSON.parse(backup);
              const sanitized = sanitizeChannels(parsed);
              if (sanitized.length > 0) {
                  console.warn("[AutoTube] Main storage empty, recovering from BACKUP.");
                  localStorage.setItem('autoTube_channels', JSON.stringify(sanitized));
                  return sanitized;
              }
          }
          return [];
      } catch (e) {
          return [];
      }
  });

  useEffect(() => {
      if (channels.length > 0) {
          setShowRestoreToast(true);
          setTimeout(() => setShowRestoreToast(false), 5000);
      }
  }, []);

  // --- Project State (Async IndexedDB) ---
  const defaultProjectState: ProjectState = {
      language: 'ar',
      duration: 'medium',
      topic: '',
      tone: 'درامي',
      script: null,
      thumbnails: [],
      sceneAssets: [],
      generatedVideos: [],
      audioTracks: [],
      voiceVolume: 1.0,
      musicVolume: 0.3,
      overlays: []
  };

  const [projectState, setProjectState] = useState<ProjectState>(defaultProjectState);
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);

  // Load from IndexedDB on Mount
  useEffect(() => {
      const load = async () => {
          const saved = await loadProjectFromDB();
          if (saved) {
              setProjectState({ ...defaultProjectState, ...saved });
              console.log("[App] Project Loaded from IndexedDB");
          } else {
               // Fallback to legacy localstorage for migration
               const legacy = localStorage.getItem('autoTube_projectState');
               if(legacy) {
                   try {
                       const parsed = JSON.parse(legacy);
                       setProjectState({ ...defaultProjectState, ...parsed });
                       console.log("[App] Project Migrated from LocalStorage");
                   } catch {}
               }
          }
          setIsProjectLoaded(true);
      };
      load();
  }, []);

  // Auto-save Project State to IndexedDB
  useEffect(() => {
    if (isProjectLoaded) {
        saveProjectToDB(projectState);
        setLastSaved(new Date());
    }
  }, [projectState, isProjectLoaded]);

  // --- STRICT ACTIONS ---
  
  const persistChannels = async (newChannels: Channel[]) => {
      try {
          const validChannels = sanitizeChannels(newChannels);
          const json = JSON.stringify(validChannels);
          
          localStorage.setItem('autoTube_channels', json);
          
          if (validChannels.length > 0) {
              localStorage.setItem('autoTube_channels_BACKUP', json);
          }
          
          if(isProjectLoaded) {
              const backup = await gatherFullState(projectState, validChannels);
              await saveLocalBackup(backup);
          }
          
          setLastSaved(new Date());
      } catch(e) {
          console.error("Persist Channels Failed", e);
      }
  };

  const handleAddChannel = (newChannel: Channel) => {
      setChannels(prev => {
          const updated = [...prev, newChannel];
          if (updated.length === 1) updated[0].isActive = true;
          persistChannels(updated);
          return updated;
      });
  };

  const handleRemoveChannel = (id: string) => {
      setChannels(prev => {
          const updated = prev.filter(c => c.id !== id);
          persistChannels(updated);
          return updated;
      });
  };

  const handleUpdateChannel = (id: string, updates: Partial<Channel>) => {
      setChannels(prev => {
          const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
          localStorage.setItem('autoTube_channels', JSON.stringify(updated));
          return updated;
      });
  };

  const handleSwitchChannel = (id: string) => {
      setChannels(prev => {
        const updated = prev.map(c => ({ ...c, isActive: c.id === id }));
        localStorage.setItem('autoTube_channels', JSON.stringify(updated));
        return updated;
      });
  };

  const handleToggleChannel = (id: string) => handleSwitchChannel(id);

  const updateProject = (updates: Partial<ProjectState>) => {
    setProjectState(prev => ({ ...prev, ...updates }));
  };

  // --- Task Manager ---
  const startTask = (type: GlobalTask['type'], title: string) => {
      setActiveTask({
          id: Date.now().toString(),
          type,
          title,
          progress: 0,
          status: 'running',
          logs: ['بدء العملية...'],
          isMinimized: false
      });
  };

  const updateTask = (progress: number, log?: string) => {
      setActiveTask(prev => prev ? { ...prev, progress, logs: log ? [...prev.logs, log] : prev.logs } : null);
  };

  const completeTask = (success: boolean) => {
      setActiveTask(prev => prev ? { 
          ...prev, 
          status: success ? 'completed' : 'error', 
          progress: success ? 100 : prev.progress, 
          logs: [...prev.logs, success ? 'تمت بنجاح' : 'فشلت'] 
      } : null);
      if (success) setTimeout(() => setActiveTask(null), 3000);
  };

  const minimizeTask = () => setActiveTask(prev => prev ? { ...prev, isMinimized: !prev.isMinimized } : null);
  
  const handleManualSave = () => {
      persistChannels(channels);
      if(isProjectLoaded) saveProjectToDB(projectState);
  };

  // --- Emergency Save on Exit ---
  useEffect(() => {
      const handleBeforeUnload = () => {
          if (channels.length > 0) {
             localStorage.setItem('autoTube_channels_BACKUP', JSON.stringify(channels));
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [channels]);

  const renderView = () => {
    const commonProps = { projectData: projectState, onUpdateProject: updateProject, onStartTask: startTask, onUpdateTask: updateTask, onCompleteTask: completeTask };
    const safeChannels = Array.isArray(channels) ? channels : [];

    if (!isProjectLoaded && currentView !== ViewState.SETTINGS) {
        return <div className="flex h-screen items-center justify-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mr-2"/> جاري تحميل البيانات من قاعدة البيانات...</div>;
    }

    switch (currentView) {
        case ViewState.DASHBOARD:
            return <Dashboard onNewVideo={() => setCurrentView(ViewState.CONTENT_GENERATOR)} channels={safeChannels} onLinkChannel={() => setCurrentView(ViewState.SETTINGS)} onUpdateChannel={handleUpdateChannel} />;
        case ViewState.STRATEGY:
            return <StrategyHub onAdoptTopic={(t, l) => { updateProject({ topic: t, language: l }); setCurrentView(ViewState.CONTENT_GENERATOR); }} activeChannel={safeChannels.find(c => c.isActive)} />;
        case ViewState.CONTENT_GENERATOR:
            return <ContentEngine {...commonProps} onSaveScript={(s) => { updateProject({ script: s }); setCurrentView(ViewState.VISUAL_STUDIO); }} />;
        case ViewState.VISUAL_STUDIO:
            return <VisualStudio {...commonProps} onNext={() => setCurrentView(ViewState.AUDIO_STUDIO)} />;
        case ViewState.AUDIO_STUDIO:
            return <AudioStudio {...commonProps} onNext={() => setCurrentView(ViewState.SMART_EDITOR)} />;
        case ViewState.SMART_EDITOR:
            return <SmartEditor projectData={projectState} onUpdateProject={updateProject} onNext={() => setCurrentView(ViewState.PUBLISHING)} />;
        case ViewState.PUBLISHING:
            return <Publishing />;
        case ViewState.SETTINGS:
            return <Settings channels={safeChannels} onAddChannel={handleAddChannel} onRemoveChannel={handleRemoveChannel} onToggleChannel={handleToggleChannel} />;
        default:
            return <Dashboard onNewVideo={() => setCurrentView(ViewState.CONTENT_GENERATOR)} channels={safeChannels} onLinkChannel={() => setCurrentView(ViewState.SETTINGS)} onUpdateChannel={handleUpdateChannel} />;
    }
  };

  return (
    <div className="flex bg-slate-950 min-h-screen font-sans text-slate-200">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        onNewProject={() => { if(confirm("بدء مشروع جديد؟")) { setProjectState({ ...defaultProjectState }); setCurrentView(ViewState.CONTENT_GENERATOR); }}}
        channels={channels || []} 
        onSwitchChannel={handleSwitchChannel}
        onManageChannels={() => setCurrentView(ViewState.SETTINGS)}
        onManualSave={handleManualSave}
      />
      
      <main className="flex-1 mr-64 relative min-h-screen bg-slate-950">
        <div className="fixed top-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
            {lastSaved && (
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700 text-slate-400 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-fadeIn shadow-lg">
                    <Save className="w-3 h-3 text-emerald-500" />
                    تم الحفظ {lastSaved.toLocaleTimeString()} (IndexedDB)
                </div>
            )}
            {showRestoreToast && (
                <div className="bg-emerald-600/90 backdrop-blur text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 animate-bounceIn shadow-xl border border-emerald-400/30">
                    <History className="w-4 h-4" />
                    تم استعادة القنوات
                </div>
            )}
        </div>
        
        {renderView()}
      </main>

      {activeTask && (
          <div className={`fixed z-[100] transition-all duration-300 shadow-2xl border border-indigo-500/50 overflow-hidden ${activeTask.isMinimized ? 'bottom-4 left-4 w-72 bg-slate-900 rounded-lg' : 'bottom-0 left-0 w-full h-full bg-slate-950/80 backdrop-blur-sm flex items-center justify-center'}`}>
              <div className={`${activeTask.isMinimized ? 'p-4' : 'bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-800 p-8 shadow-2xl relative'}`}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className={`font-bold text-white flex items-center gap-2 ${activeTask.isMinimized ? 'text-sm' : 'text-xl'}`}>
                          {activeTask.status === 'running' && <Loader2 className="animate-spin text-indigo-500" />}
                          {activeTask.status === 'completed' && <CheckCircle className="text-emerald-500" />}
                          {activeTask.status === 'error' && <AlertCircle className="text-red-500" />}
                          {activeTask.title}
                      </h3>
                      <div className="flex gap-2">
                          <button onClick={minimizeTask} className="p-1 hover:bg-slate-800 rounded text-slate-400">{activeTask.isMinimized ? <Maximize2 className="w-4 h-4"/> : <Minimize2 className="w-5 h-5"/>}</button>
                          {activeTask.status !== 'running' && <button onClick={() => setActiveTask(null)} className="p-1 hover:bg-slate-800 rounded text-slate-400"><X className="w-5 h-5"/></button>}
                      </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-4 overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${activeTask.status === 'error' ? 'bg-red-500' : activeTask.status === 'completed' ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} style={{ width: `${activeTask.progress}%` }}></div>
                  </div>
                  {!activeTask.isMinimized && <div className="bg-slate-950 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs space-y-2 custom-scrollbar border border-slate-800">{activeTask.logs.map((log, i) => <div key={i} className="text-slate-400 border-b border-slate-800/50 pb-1">{log}</div>)}</div>}
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
