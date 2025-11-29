
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { 
  Scissors, Play, Pause, SkipBack, 
  ZoomIn, ZoomOut, 
  RefreshCw, ChevronRight, Wand2, Trash2,
  Type, DownloadCloud, Sticker, AlertCircle
} from 'lucide-react';
import { ProjectState, AudioAsset, SceneAsset } from '../types';
import { generateAIIcons } from '../services/geminiService';

interface SmartEditorProps {
    projectData: ProjectState;
    onUpdateProject: (data: Partial<ProjectState>) => void;
    onNext: () => void;
}

export const SmartEditor: React.FC<SmartEditorProps> = ({ projectData, onUpdateProject, onNext }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackInterval = useRef<number | null>(null);
  const [isGeneratingIcons, setIsGeneratingIcons] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  
  // Cache for preloaded images
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // 1. Calculate Timings & Duration
  const sceneTimings = useMemo(() => {
      const timings: { index: number, start: number, duration: number, end: number, asset: SceneAsset }[] = [];
      let cursor = 0;
      if (projectData.intro) cursor += 5;

      const voTracks = projectData.audioTracks
          .filter(t => t.type === 'voiceover')
          .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

      projectData.sceneAssets.forEach((scene, i) => {
          const vo = voTracks[i]; 
          const duration = vo ? parseFloat(vo.duration.toString()) : 5;
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
      projectData.audioTracks.forEach(t => {
          const end = (t.startTime || 0) + parseFloat(t.duration.toString());
          if (end > max) max = end;
      });
      setTotalDuration(Math.max(max, 10));
  }, [projectData.audioTracks, sceneTimings]);

  // 2. Preload Images with CORS (CRITICAL FOR EXPORT)
  useEffect(() => {
      projectData.sceneAssets.forEach(scene => {
          if (scene.imageUrl && !imageCacheRef.current.has(scene.imageUrl)) {
              const img = new Image();
              img.crossOrigin = "anonymous"; // Prevents tainted canvas
              img.src = scene.imageUrl;
              img.onload = () => {
                  imageCacheRef.current.set(scene.imageUrl!, img);
              };
          }
      });
  }, [projectData.sceneAssets]);

  // 3. Audio Init
  useEffect(() => {
      const currentIds = new Set(projectData.audioTracks.map(t => t.id));
      Object.keys(audioRefs.current).forEach(id => {
          if (!currentIds.has(id)) {
              const audio = audioRefs.current[id];
              if (audio) { audio.pause(); audio.src = ''; }
              delete audioRefs.current[id];
          }
      });

      projectData.audioTracks.forEach((track) => {
          if (track.url && track.url.length > 5 && !audioRefs.current[track.id]) {
              try {
                  const a = new Audio(track.url);
                  a.preload = 'auto';
                  a.crossOrigin = 'anonymous'; 
                  audioRefs.current[track.id] = a;
              } catch (e) {}
          }
      });
  }, [projectData.audioTracks]);

  const renderFrame = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let activeAsset: SceneAsset | null = null;
      let isIntro = false;
      
      if (time < 5 && projectData.intro) isIntro = true;
      else {
          const active = sceneTimings.find(s => time >= s.start && time < s.end);
          if (active) activeAsset = active.asset;
      }

      if (isIntro) {
          ctx.fillStyle = '#312e81'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'white'; ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center';
          ctx.fillText("INTRO", canvas.width/2, canvas.height/2);
      } else if (activeAsset && activeAsset.imageUrl) {
          // Use Cached Image if available
          const cached = imageCacheRef.current.get(activeAsset.imageUrl);
          if (cached) {
              let dx = 0;
              if (activeAsset.motion === 'pan-right') dx = (time % 5) * 10;
              
              ctx.save();
              // Simple Motion (Simulated)
              if (activeAsset.motion === 'zoom-in') {
                  const s = 1 + (time % 5) * 0.05;
                  ctx.translate(canvas.width/2, canvas.height/2);
                  ctx.scale(s, s);
                  ctx.translate(-canvas.width/2, -canvas.height/2);
              }
              try {
                 ctx.drawImage(cached, 0 + dx, 0, canvas.width, canvas.height);
              } catch(e) {}
              ctx.restore();
          }
      } else {
          ctx.fillStyle = '#1e293b'; ctx.fillRect(0,0, canvas.width, canvas.height);
          ctx.fillStyle = '#475569'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
          ctx.fillText("No Media", canvas.width/2, canvas.height/2);
      }

      // Subtitles
      if (showSubtitles && activeAsset) {
          const sceneIdx = sceneTimings.findIndex(s => s.asset === activeAsset);
          if (sceneIdx !== -1) {
              const text = projectData.script?.scenes[sceneIdx]?.narration || '';
              if (text) {
                  ctx.fillStyle = 'rgba(0,0,0,0.7)';
                  ctx.fillRect(0, canvas.height - 100, canvas.width, 80);
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 32px Tajawal, Arial'; 
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(text.substring(0, 60), canvas.width/2, canvas.height - 60);
              }
          }
      }
  };

  useEffect(() => {
      if (isPlaying) {
          playbackInterval.current = requestAnimationFrame(updatePlayback);
      } else {
          if (playbackInterval.current) cancelAnimationFrame(playbackInterval.current);
          Object.values(audioRefs.current).forEach((a) => a.pause());
      }
      return () => { if (playbackInterval.current) cancelAnimationFrame(playbackInterval.current); };
  }, [isPlaying]); 

  const updatePlayback = () => {
      setCurrentTime(prev => {
          const nextTime = prev + 0.033; 
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

  useEffect(() => {
      if (!isPlaying) renderFrame(currentTime);
  }, [currentTime]);

  const syncAudio = (time: number) => {
      projectData.audioTracks.forEach(track => {
          const audio = audioRefs.current[track.id];
          if (!audio) return; 

          let startTime = track.startTime || 0;
          if (track.type === 'voiceover') {
              const sceneIdx = sceneTimings.findIndex(s => Math.abs(s.duration - parseFloat(track.duration.toString())) < 0.1 && s.start === startTime);
              if (sceneIdx !== -1) startTime = sceneTimings[sceneIdx].start;
          }

          const duration = parseFloat(track.duration.toString());
          const endTime = startTime + duration;

          if (time >= startTime && time < endTime) {
              if (audio.paused) {
                  audio.currentTime = time - startTime;
                  audio.play().catch(() => {});
              } else if (Math.abs(audio.currentTime - (time - startTime)) > 0.3) {
                  audio.currentTime = time - startTime;
              }
              let vol = track.type === 'music' ? (projectData.musicVolume || 0.3) : 1.0;
              audio.volume = Math.max(0, Math.min(1, vol));
          } else {
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
  };

  const handleExportVideo = () => {
      if (!canvasRef.current) return;
      
      const stream = canvasRef.current.captureStream(30);
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mimeType = 'video/webm;codecs=vp9';
      else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';

      try {
          mediaRecorderRef.current = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3000000 });
      } catch (e) {
          alert("Export not supported.");
          return;
      }

      recordedChunks.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(recordedChunks.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `video_export.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setIsExporting(false);
          setIsPlaying(false);
      };

      setIsExporting(true);
      setCurrentTime(0);
      setIsPlaying(true);
      mediaRecorderRef.current.start(1000); 
  };

  const stopExport = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-sans text-slate-200">
      <div className="h-16 px-6 flex justify-between items-center bg-slate-950 border-b border-slate-800 shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
            <Scissors className="text-indigo-500" /> المحرر الذكي
        </h2>
        <div className="flex gap-3">
             <button 
                onClick={handleExportVideo}
                disabled={isExporting}
                className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition ${isExporting ? 'bg-red-600 animate-pulse text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
             >
                {isExporting ? <><RefreshCw className="w-4 h-4 animate-spin"/> تسجيل...</> : <><DownloadCloud className="w-4 h-4" /> تصدير فيديو</>}
            </button>
            <button onClick={onNext} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition border border-slate-700">
                التالي <ChevronRight className="w-4 h-4" />
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
               <div className="p-3 bg-slate-950 border-b border-slate-800 font-bold text-xs text-slate-400">المشاهد</div>
               <div className="flex-1 overflow-y-auto p-2 space-y-2">
                   {projectData.sceneAssets.map((asset, i) => (
                       <div key={i} className="flex gap-2 bg-slate-950 p-2 rounded border border-slate-800 hover:border-indigo-500/50 transition">
                           <div className="w-12 h-12 bg-black rounded overflow-hidden">
                               {asset.imageUrl && <img src={asset.imageUrl} className="w-full h-full object-cover" alt=""/>}
                           </div>
                           <div className="flex-1 min-w-0 flex flex-col justify-center">
                               <div className="text-[10px] text-white font-bold">مشهد {i+1}</div>
                               <div className="text-[9px] text-slate-500 truncate">{projectData.script?.scenes[i]?.narration || '...'}</div>
                           </div>
                       </div>
                   ))}
               </div>
          </div>

          {/* Player */}
          <div className="flex-1 bg-black/95 flex flex-col relative">
               <div className="flex-1 flex items-center justify-center p-8 relative">
                   <div className="relative aspect-video w-full max-w-4xl bg-black shadow-2xl border border-slate-800 rounded-lg overflow-hidden">
                       <canvas 
                           ref={canvasRef} 
                           width={1280} 
                           height={720} 
                           className="w-full h-full object-contain"
                       />
                   </div>
               </div>

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

      {/* Timeline */}
      <div className="h-64 bg-slate-950 border-t border-slate-800 flex flex-col shrink-0 relative z-20">
          <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
               <div className="flex items-center gap-2">
                   <ZoomOut className="w-4 h-4 text-slate-500"/>
                   <input type="range" min="10" max="150" step="10" value={pixelsPerSecond} onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))} className="w-32 accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                   <ZoomIn className="w-4 h-4 text-slate-500"/>
               </div>
          </div>

          <div ref={timelineRef} className="flex-1 overflow-x-auto relative bg-slate-950 select-none custom-scrollbar" onMouseDown={handleSeek}>
              <div className="relative h-full" style={{ width: Math.max(1000, totalDuration * pixelsPerSecond) + 500 }}>
                  <div className="h-6 border-b border-slate-800 bg-slate-900 sticky top-0 z-30 flex items-end">
                      {Array.from({ length: Math.ceil(totalDuration / 5) + 2 }).map((_, i) => (
                          <div key={i} className="absolute bottom-0 text-[10px] text-slate-500 border-l border-slate-700 pl-1 pb-1" style={{ left: i * 5 * pixelsPerSecond }}>
                              {i * 5}s
                          </div>
                      ))}
                  </div>

                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)]" 
                    style={{ left: currentTime * pixelsPerSecond }}
                  >
                      <div className="w-3 h-3 bg-red-500 rotate-45 -translate-x-1.5 -translate-y-1.5"></div>
                  </div>
                  
                  {/* Tracks */}
                  <div className="h-16 relative mt-2 mb-1">
                       <div className="absolute left-2 top-0 text-[10px] text-slate-500 font-bold bg-slate-950 px-1 z-10">VIDEO</div>
                       {sceneTimings.map((scene) => (
                           <div 
                                key={scene.index} 
                                className="absolute top-4 bottom-1 border-r border-slate-950 bg-slate-800 hover:bg-slate-700 flex items-center px-2 overflow-hidden rounded-sm cursor-pointer border-l-4 border-l-indigo-500" 
                                style={{ left: scene.start * pixelsPerSecond, width: scene.duration * pixelsPerSecond }}
                                onClick={(e) => { e.stopPropagation(); setCurrentTime(scene.start); }}
                           >
                               {scene.asset.imageUrl && <img src={scene.asset.imageUrl} className="h-full w-auto object-cover opacity-50 mr-2" alt=""/>}
                               <span className="text-[10px] text-slate-300 font-bold whitespace-nowrap">Scene {scene.index + 1}</span>
                           </div>
                       ))}
                  </div>
                  
                  <div className="h-10 relative mb-1">
                      <div className="absolute left-2 top-0 text-[10px] text-slate-500 font-bold bg-slate-950 px-1 z-10">VOICE</div>
                       {projectData.audioTracks.filter(t => t.type === 'voiceover').map(t => (
                           <div key={t.id} className="absolute top-4 h-5 bg-rose-900/50 border border-rose-600/50 rounded-sm" style={{ left: (t.startTime||0) * pixelsPerSecond, width: parseFloat(t.duration.toString()) * pixelsPerSecond }}></div>
                       ))}
                  </div>

                  <div className="h-10 relative mb-1">
                      <div className="absolute left-2 top-0 text-[10px] text-slate-500 font-bold bg-slate-950 px-1 z-10">AUDIO</div>
                       {projectData.audioTracks.filter(t => t.type === 'music' || t.type === 'sfx').map(t => (
                           <div key={t.id} className="absolute top-4 h-5 bg-blue-900/50 border border-blue-500 rounded-sm" style={{ left: (t.startTime||0) * pixelsPerSecond, width: parseFloat(t.duration.toString()) * pixelsPerSecond }}>
                               <span className="text-[9px] text-white px-1 truncate block">{t.name}</span>
                           </div>
                       ))}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
