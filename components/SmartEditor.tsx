
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { 
  Scissors, Play, Pause, SkipBack, SkipForward, Download, 
  Settings2, Image as ImageIcon, Sticker, Layers, 
  ZoomIn, ZoomOut, Volume2, MonitorPlay, Video, Music, Mic,
  RefreshCw, Clock, ChevronRight, Wand2, Trash2,
  Type, DownloadCloud, AlertCircle
} from 'lucide-react';
import { ProjectState, Overlay, AudioAsset, SceneAsset } from '../types';
import { generateAIIcons } from '../services/geminiService';

interface SmartEditorProps {
    projectData: ProjectState;
    onUpdateProject: (data: Partial<ProjectState>) => void;
    onNext: () => void;
}

export const SmartEditor: React.FC<SmartEditorProps> = ({ projectData, onUpdateProject, onNext }) => {
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  
  // Timeline View State
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackInterval = useRef<number | null>(null);

  // Asset Panel State
  const [isGeneratingIcons, setIsGeneratingIcons] = useState(false);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  
  // Rendering Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  
  // --- COMPUTED TIMINGS (STRICT SYNC) ---
  const sceneTimings = useMemo(() => {
      const timings: { index: number, start: number, duration: number, end: number, asset: SceneAsset }[] = [];
      let cursor = 0;
      
      // Add Intro offset if exists
      if (projectData.intro) cursor += 5;

      // Group Voiceovers by their ID index (assuming ID format "vo-TIMESTAMP-INDEX")
      // or just map by array index if they match the scenes 1:1
      const voTracks = projectData.audioTracks
          .filter(t => t.type === 'voiceover')
          // Sort by the index embedded in ID or by start time to be safe
          .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

      projectData.sceneAssets.forEach((scene, i) => {
          // STRICT MATCH: Scene[i] gets Voice[i]
          const vo = voTracks[i]; 
          
          // Duration is strictly the voice duration, or 5s fallback
          const duration = vo ? parseFloat(vo.duration.toString()) : 5;
          
          // Start time is strictly where the previous scene ended (cursor)
          // We ignore the VO's 'startTime' metadata to force visual sync
          const startTime = cursor;
          
          timings.push({
              index: i,
              start: startTime,
              duration: duration,
              end: startTime + duration,
              asset: scene
          });
          
          cursor += duration; 
      });
      return timings;
  }, [projectData.audioTracks, projectData.sceneAssets, projectData.intro]);

  useEffect(() => {
      let max = 0;
      if (sceneTimings.length > 0) {
          max = sceneTimings[sceneTimings.length - 1].end;
      }
      if (projectData.outro) max += 5;
      
      // Also check if background music is longer
      projectData.audioTracks.forEach(t => {
          if (t.type !== 'voiceover') {
             const end = (t.startTime || 0) + parseFloat(t.duration.toString());
             if (end > max) max = end;
          }
      });

      setTotalDuration(Math.max(max, 10));
  }, [projectData.audioTracks, sceneTimings, projectData.outro]);

  // --- AUDIO ENGINE ---
  useEffect(() => {
      const currentIds = new Set(projectData.audioTracks.map(t => t.id));
      
      // Cleanup old
      Object.keys(audioRefs.current).forEach(id => {
          if (!currentIds.has(id)) {
              const audio = audioRefs.current[id];
              if (audio) { audio.pause(); audio.src = ''; }
              delete audioRefs.current[id];
          }
      });

      // Init new
      projectData.audioTracks.forEach((track, i) => {
          if (track.url && !audioRefs.current[track.id]) {
              const a = new Audio(track.url);
              a.preload = 'auto';
              a.crossOrigin = 'anonymous'; 
              audioRefs.current[track.id] = a;
          }
      });
  }, [projectData.audioTracks]);

  // --- CANVAS RENDERER ---
  const renderFrame = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Clear
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Determine Content
      let activeAsset: SceneAsset | null = null;
      let isIntro = false, isOutro = false;
      const introDur = projectData.intro ? 5 : 0;
      
      if (time < introDur && projectData.intro) isIntro = true;
      else if (time > (totalDuration - 5) && projectData.outro) isOutro = true;
      else {
          // Find scene strictly by computed timing
          const active = sceneTimings.find(s => time >= s.start && time < s.end);
          if (active) activeAsset = active.asset;
      }

      // 3. Draw Background
      if (isIntro) {
          ctx.fillStyle = '#312e81'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'white'; ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center';
          ctx.fillText("INTRO", canvas.width/2, canvas.height/2);
      } else if (isOutro) {
          ctx.fillStyle = '#4c1d95'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'white'; ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center';
          ctx.fillText("OUTRO", canvas.width/2, canvas.height/2);
      } else if (activeAsset && activeAsset.imageUrl) {
          const img = new Image();
          img.src = activeAsset.imageUrl;
          // Apply basic fit logic
          const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
          // Mock Motion Effect based on time
          let dx = 0;
          if (activeAsset.motion === 'pan-right') dx = (time % 5) * 10;
          
          try {
             ctx.drawImage(img, 0 + dx, 0, canvas.width, canvas.height);
          } catch(e) {}
      } else {
          // Fallback black
          ctx.fillStyle = '#1e293b'; ctx.fillRect(0,0, canvas.width, canvas.height);
          ctx.fillStyle = '#475569'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
          ctx.fillText("No Image", canvas.width/2, canvas.height/2);
      }

      // 4. Draw Icons (Overlays)
      projectData.overlays.forEach(ov => {
          if (time >= ov.startTime && time < ov.startTime + ov.duration) {
              const img = new Image();
              img.src = ov.url;
              const x = (ov.position.x / 100) * canvas.width;
              const y = (ov.position.y / 100) * canvas.height;
              try { ctx.drawImage(img, x - 32, y - 32, 64, 64); } catch(e){}
          }
      });

      // 5. Draw Subtitles (ONLY IF ENABLED)
      if (showSubtitles && activeAsset) {
          const sceneIdx = sceneTimings.findIndex(s => s.asset === activeAsset);
          if (sceneIdx !== -1) {
              const text = projectData.script?.scenes[sceneIdx]?.narration || '';
              if (text) {
                  // Text Background
                  ctx.fillStyle = 'rgba(0,0,0,0.7)';
                  ctx.fillRect(0, canvas.height - 100, canvas.width, 80);
                  
                  // Text Settings
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 32px Tajawal, Arial'; // Bigger font
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  
                  // Simple text wrapping could go here, for now truncate
                  ctx.fillText(text.substring(0, 60) + (text.length>60?'...':''), canvas.width/2, canvas.height - 60);
              }
          }
      }
  };

  // --- PLAYBACK LOOP ---
  useEffect(() => {
      if (isPlaying) {
          playbackInterval.current = requestAnimationFrame(updatePlayback);
      } else {
          if (playbackInterval.current) cancelAnimationFrame(playbackInterval.current);
          // Pause all audio
          Object.values(audioRefs.current).forEach((a: HTMLAudioElement) => a.pause());
      }
      return () => { if (playbackInterval.current) cancelAnimationFrame(playbackInterval.current); };
  }, [isPlaying, showSubtitles]); // Add showSubtitles dependency to re-render when toggled

  const updatePlayback = () => {
      setCurrentTime(prev => {
          const nextTime = prev + 0.033; // ~30fps
          if (nextTime >= totalDuration) {
              setIsPlaying(false);
              if (isExporting) stopExport();
              return totalDuration;
          }
          syncAudio(nextTime);
          renderFrame(nextTime); 
          playbackInterval.current = requestAnimationFrame(updatePlayback);
          return nextTime;
      });
  };

  // Re-render frame immediately when toggling subtitles while paused
  useEffect(() => {
      if (!isPlaying) renderFrame(currentTime);
  }, [showSubtitles, currentTime]);

  const syncAudio = (time: number) => {
      // Sync logic needs to handle Voiceovers differently than Music
      
      // 1. Voiceovers: Strictly tied to scene slots
      projectData.audioTracks.forEach(track => {
          const audio = audioRefs.current[track.id];
          if (!audio) return;

          let startTime = track.startTime || 0;
          
          // STRICT FIX: If it's a VO, use the calculated Scene Start Time
          if (track.type === 'voiceover') {
              // Find which scene index this VO belongs to
              // We assume track.id has index or we rely on sort order. 
              // A safer way is checking the sceneTimings map
              const sceneIdx = sceneTimings.findIndex(s => Math.abs(s.duration - parseFloat(track.duration.toString())) < 0.1 && s.start === startTime);
              if (sceneIdx !== -1) {
                  startTime = sceneTimings[sceneIdx].start;
              }
          }

          const duration = parseFloat(track.duration.toString());
          const endTime = startTime + duration;

          if (time >= startTime && time < endTime) {
              // Should be playing
              if (audio.paused) {
                  audio.currentTime = time - startTime;
                  audio.play().catch(() => {});
              } else if (Math.abs(audio.currentTime - (time - startTime)) > 0.3) {
                  // Drift correction
                  audio.currentTime = time - startTime;
              }
              
              // Apply Volume
              let vol = track.type === 'music' ? (projectData.musicVolume || 0.3) : (projectData.voiceVolume || 1.0);
              audio.volume = vol;
          } else {
              // Should be stopped
              if (!audio.paused) audio.pause();
          }
      });
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const newTime = Math.max(0, Math.min(x / pixelsPerSecond, totalDuration));
      setCurrentTime(newTime);
      renderFrame(newTime);
      
      // Sync audio heads
      Object.values(audioRefs.current).forEach((a: HTMLAudioElement) => { 
          a.pause(); 
          // We can't easily set currentTime for all, syncAudio will handle it on next play
      });
  };

  const handleExportVideo = () => {
      if (!canvasRef.current) return;
      
      // Request 30fps stream
      const stream = canvasRef.current.captureStream(30);
      
      // Create Recorder
      try {
          mediaRecorderRef.current = new MediaRecorder(stream, { 
              mimeType: 'video/webm;codecs=vp9',
              videoBitsPerSecond: 2500000 // 2.5 Mbps
          });
      } catch (e) {
          // Fallback
          mediaRecorderRef.current = new MediaRecorder(stream);
      }

      recordedChunks.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `autotube_project_${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setIsExporting(false);
          setIsPlaying(false);
          alert("تم تصدير الفيديو بنجاح! يمكنك العثور عليه في التنزيلات.");
      };

      setIsExporting(true);
      setCurrentTime(0);
      setIsPlaying(true);
      mediaRecorderRef.current.start();
  };

  const stopExport = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
  };

  const handleDeleteScene = (index: number) => {
      const newAssets = [...projectData.sceneAssets];
      newAssets.splice(index, 1);
      // Also remove corresponding VO track to keep sync
      const newTracks = projectData.audioTracks.filter(t => !(t.type === 'voiceover' && t.id.includes(`-${index}`))); // Heuristic ID match
      
      onUpdateProject({ sceneAssets: newAssets, audioTracks: newTracks });
  };

  const handleGenerateIcons = async () => {
      if (!projectData.script) return;
      setIsGeneratingIcons(true);
      try {
          const icons = await generateAIIcons(projectData.script);
          onUpdateProject({ overlays: [...projectData.overlays, ...icons] });
      } catch (e) {
          alert("Failed to generate icons");
      } finally {
          setIsGeneratingIcons(false);
      }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-sans text-slate-200">
      
      {/* 1. Header */}
      <div className="h-16 px-6 flex justify-between items-center bg-slate-950 border-b border-slate-800 shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
            <Scissors className="text-indigo-500" /> المحرر الذكي (Professional NLE)
        </h2>
        <div className="flex gap-3">
             <button 
                onClick={handleGenerateIcons}
                disabled={isGeneratingIcons}
                className="bg-purple-600/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2"
             >
                {isGeneratingIcons ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />} أيقونات AI
             </button>
             
             <button 
                onClick={handleExportVideo}
                disabled={isExporting}
                className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition ${isExporting ? 'bg-red-600 animate-pulse text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
             >
                {isExporting ? <><RefreshCw className="w-4 h-4 animate-spin"/> جاري التسجيل...</> : <><DownloadCloud className="w-4 h-4" /> تصدير فيديو</>}
            </button>
            
            <button onClick={onNext} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition border border-slate-700">
                التالي <ChevronRight className="w-4 h-4" />
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
          
          {/* 2. Left Sidebar */}
          <div className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
               <div className="p-3 bg-slate-950 border-b border-slate-800 font-bold text-xs text-slate-400">المشاهد (Timeline Order)</div>
               <div className="flex-1 overflow-y-auto p-2 space-y-2">
                   {projectData.sceneAssets.map((asset, i) => (
                       <div key={i} className="flex gap-2 bg-slate-950 p-2 rounded border border-slate-800 hover:border-indigo-500/50 transition">
                           <div className="w-12 h-12 bg-black rounded overflow-hidden">
                               {asset.imageUrl && <img src={asset.imageUrl} className="w-full h-full object-cover" alt=""/>}
                           </div>
                           <div className="flex-1 min-w-0 flex flex-col justify-center">
                               <div className="text-[10px] text-white font-bold">مشهد {i+1}</div>
                               <div className="text-[9px] text-slate-500 truncate">{projectData.script?.scenes[i]?.narration || 'No text'}</div>
                           </div>
                           <button onClick={() => handleDeleteScene(i)} className="text-slate-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                       </div>
                   ))}
               </div>
          </div>

          {/* 3. Main Stage (Canvas) */}
          <div className="flex-1 bg-black/95 flex flex-col relative">
               <div className="flex-1 flex items-center justify-center p-8 relative">
                   <div className="relative aspect-video w-full max-w-4xl bg-black shadow-2xl border border-slate-800 rounded-lg overflow-hidden">
                       <canvas 
                           ref={canvasRef} 
                           width={1280} 
                           height={720} 
                           className="w-full h-full object-contain"
                       />
                       
                       {/* Overlay Controls */}
                       <div className="absolute top-4 right-4 flex gap-2 z-10">
                           <button 
                                onClick={() => setShowSubtitles(prev => !prev)}
                                className={`p-2 rounded bg-black/50 backdrop-blur border transition ${showSubtitles ? 'text-white border-white bg-indigo-600/50' : 'text-slate-500 border-slate-700'}`}
                                title="Toggle Subtitles (CC)"
                            >
                               <Type className="w-5 h-5" />
                           </button>
                       </div>
                   </div>
               </div>

               {/* Transport */}
               <div className="h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-8 shrink-0">
                   <button onClick={() => setCurrentTime(0)} className="text-slate-400 hover:text-white"><SkipBack className="w-6 h-6" /></button>
                   <button 
                    onClick={() => setIsPlaying(!isPlaying)} 
                    className={`w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg transition transform hover:scale-105 ${isPlaying ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                   >
                       {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                   </button>
                   <div className="text-sm font-mono text-indigo-400 bg-slate-950 px-3 py-1 rounded border border-indigo-500/30">
                       {currentTime.toFixed(2)}s / {totalDuration.toFixed(2)}s
                   </div>
               </div>
          </div>
      </div>

      {/* 4. Multi-Track Timeline */}
      <div className="h-72 bg-slate-950 border-t border-slate-800 flex flex-col shrink-0 relative z-20">
          
          {/* Toolbar */}
          <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
               <div className="flex items-center gap-2">
                   <ZoomOut className="w-4 h-4 text-slate-500"/>
                   <input 
                    type="range" min="10" max="150" step="10" 
                    value={pixelsPerSecond} 
                    onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))} 
                    className="w-32 accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                   />
                   <ZoomIn className="w-4 h-4 text-slate-500"/>
               </div>
          </div>

          <div ref={timelineRef} className="flex-1 overflow-x-auto relative bg-slate-950 select-none custom-scrollbar" onMouseDown={handleSeek}>
              <div className="relative h-full" style={{ width: Math.max(1000, totalDuration * pixelsPerSecond) + 500 }}>
                  
                  {/* Time Ruler */}
                  <div className="h-6 border-b border-slate-800 bg-slate-900 sticky top-0 z-30 flex items-end">
                      {Array.from({ length: Math.ceil(totalDuration / 5) + 2 }).map((_, i) => (
                          <div key={i} className="absolute bottom-0 text-[10px] text-slate-500 border-l border-slate-700 pl-1 pb-1" style={{ left: i * 5 * pixelsPerSecond }}>
                              {i * 5}s
                          </div>
                      ))}
                  </div>

                  {/* Playhead */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)]" 
                    style={{ left: currentTime * pixelsPerSecond }}
                  >
                      <div className="w-3 h-3 bg-red-500 rotate-45 -translate-x-1.5 -translate-y-1.5"></div>
                  </div>
                  
                  {/* TRACK 1: Visual Scenes */}
                  <div className="h-16 relative mt-2 mb-1">
                       <div className="absolute left-2 top-0 text-[10px] text-slate-500 font-bold bg-slate-950 px-1 z-10">VIDEO</div>
                       {sceneTimings.map((scene) => (
                           <div 
                                key={scene.index} 
                                className="absolute top-4 bottom-1 border-r border-slate-950 bg-slate-800 hover:bg-slate-700 flex items-center px-2 overflow-hidden rounded-sm cursor-pointer border-l-4 border-l-indigo-500" 
                                style={{ left: scene.start * pixelsPerSecond, width: scene.duration * pixelsPerSecond }}
                                onClick={(e) => { e.stopPropagation(); setCurrentTime(scene.start); }}
                                title={`Scene ${scene.index+1}`}
                           >
                               {scene.asset.imageUrl && <img src={scene.asset.imageUrl} className="h-full w-auto object-cover opacity-50 mr-2" alt=""/>}
                               <span className="text-[10px] text-slate-300 font-bold whitespace-nowrap">Scene {scene.index + 1}</span>
                           </div>
                       ))}
                  </div>
                  
                  {/* TRACK 2: Voiceover */}
                  <div className="h-10 relative mb-1">
                      <div className="absolute left-2 top-0 text-[10px] text-slate-500 font-bold bg-slate-950 px-1 z-10">VOICE</div>
                       {projectData.audioTracks.filter(t => t.type === 'voiceover').map(t => (
                           <div key={t.id} className="absolute top-4 h-5 bg-rose-900/50 border border-rose-600/50 rounded-sm" style={{ left: (t.startTime||0) * pixelsPerSecond, width: parseFloat(t.duration.toString()) * pixelsPerSecond }}>
                               <div className="w-full h-full opacity-30 bg-[url('https://upload.wikimedia.org/wikipedia/commons/c/c8/Waveform_1.png')] bg-cover bg-center filter sepia hue-rotate-[-50deg]"></div>
                           </div>
                       ))}
                  </div>

                  {/* TRACK 3: Audio/SFX */}
                  <div className="h-10 relative mb-1">
                      <div className="absolute left-2 top-0 text-[10px] text-slate-500 font-bold bg-slate-950 px-1 z-10">AUDIO</div>
                       {projectData.audioTracks.filter(t => t.type === 'music' || t.type === 'sfx').map(t => (
                           <div key={t.id} className={`absolute top-4 h-5 rounded-sm border opacity-80 ${t.type === 'music' ? 'bg-blue-900/50 border-blue-500' : 'bg-orange-900/50 border-orange-500'}`} style={{ left: (t.startTime||0) * pixelsPerSecond, width: parseFloat(t.duration.toString()) * pixelsPerSecond }}>
                               <span className="text-[9px] text-white px-1 truncate block">{t.name}</span>
                           </div>
                       ))}
                  </div>

                  {/* TRACK 4: Overlays */}
                  <div className="h-10 relative">
                      <div className="absolute left-2 top-0 text-[10px] text-slate-500 font-bold bg-slate-950 px-1 z-10">OVERLAYS</div>
                       {projectData.overlays.map(ov => (
                           <div key={ov.id} className="absolute top-4 h-5 bg-purple-900/50 border border-purple-500 rounded-sm flex items-center px-1" style={{ left: ov.startTime * pixelsPerSecond, width: ov.duration * pixelsPerSecond }}>
                               <Sticker className="w-3 h-3 text-purple-300"/>
                           </div>
                       ))}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
