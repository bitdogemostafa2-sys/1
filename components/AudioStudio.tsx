
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic2, 
  Play, 
  Wand2,
  ArrowLeft,
  Loader2,
  Sparkles,
  X,
  Pause,
  Download,
  Music,
  Trash2,
  Search,
  User,
  ChevronDown,
  ChevronUp,
  Volume2
} from 'lucide-react';
import { ProjectState, AudioAsset, GlobalTask } from '../types';
import { generateVoiceover } from '../services/geminiService';

interface AudioStudioProps {
    projectData: ProjectState;
    onUpdateProject: (data: Partial<ProjectState>) => void;
    onNext: () => void;
    onStartTask: (type: GlobalTask['type'], title: string) => void;
    onUpdateTask: (progress: number, log?: string) => void;
    onCompleteTask: (success: boolean) => void;
}

// RELIABLE MP3 LINKS (Demo/Stock)
const YOUTUBE_LIBRARY = [
    { id: 'mus_1', title: 'Cinematic Epic', mood: 'Epic', duration: '6:12', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { id: 'mus_2', title: 'Emotional Piano', mood: 'Dramatic', duration: '7:05', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { id: 'mus_3', title: 'Upbeat Corporate', mood: 'Happy', duration: '5:30', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3' },
    { id: 'mus_4', title: 'Action Percussion', mood: 'Intense', duration: '4:20', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
    { id: 'mus_5', title: 'Tech Ambience', mood: 'Tech', duration: '3:45', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
];

export const SFX_LIBRARY = [
    { id: 'sfx_whoosh', title: 'Whoosh', category: 'Transition', duration: '0:01', url: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg' },
    { id: 'sfx_boom', title: 'Cinematic Boom', category: 'Impact', duration: '0:03', url: 'https://actions.google.com/sounds/v1/cartoon/clown_horn.ogg' },
    { id: 'sfx_type', title: 'Keyboard', category: 'Tech', duration: '0:02', url: 'https://actions.google.com/sounds/v1/foley/typing_on_keyboard.ogg' },
    { id: 'sfx_cam', title: 'Camera', category: 'Tech', duration: '0:01', url: 'https://actions.google.com/sounds/v1/foley/camera_snapping.ogg' },
    { id: 'sfx_bell', title: 'Notification', category: 'UI', duration: '0:01', url: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' },
];

const VOICES = [
    { name: 'Kore', gender: 'Female', style: 'Calm' },
    { name: 'Fenrir', gender: 'Male', style: 'Deep' },
    { name: 'Puck', gender: 'Male', style: 'Energetic' },
    { name: 'Charon', gender: 'Male', style: 'Narrative' },
    { name: 'Aoede', gender: 'Female', style: 'Soft' }
];

export const AudioStudio: React.FC<AudioStudioProps> = ({ 
    projectData, 
    onUpdateProject, 
    onNext,
    onStartTask,
    onUpdateTask,
    onCompleteTask 
}) => {
  // UI State
  const [activeTab, setActiveTab] = useState<'voiceover' | 'music' | 'sfx'>('voiceover');
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isMixerCollapsed, setIsMixerCollapsed] = useState(false); 
  
  // Playback State
  const [isPlayingMaster, setIsPlayingMaster] = useState(false);
  const [masterTime, setMasterTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  // Refs
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const playbackInterval = useRef<number | null>(null);

  // 1. Initialize Audio Objects
  useEffect(() => {
      let max = 0;
      projectData.audioTracks.forEach(t => {
          const end = (t.startTime || 0) + parseFloat(t.duration.toString());
          if (end > max) max = end;
          
          if (t.url && !audioRefs.current[t.id]) {
              const a = new Audio(t.url);
              a.preload = 'auto';
              a.crossOrigin = 'anonymous';
              a.volume = t.type === 'music' ? (projectData.musicVolume || 0.3) : 1.0;
              audioRefs.current[t.id] = a;
          }
      });
      setTotalDuration(Math.max(max, 10));
  }, [projectData.audioTracks]);

  // 2. Master Playback Loop
  useEffect(() => {
      if (isPlayingMaster) {
          playbackInterval.current = requestAnimationFrame(updateMasterPlayback);
      } else {
          if (playbackInterval.current) cancelAnimationFrame(playbackInterval.current);
          Object.values(audioRefs.current).forEach((a) => a.pause());
      }
      return () => { if (playbackInterval.current) cancelAnimationFrame(playbackInterval.current); };
  }, [isPlayingMaster]);

  const updateMasterPlayback = () => {
      setMasterTime(prev => {
          const next = prev + 0.05;
          if (next >= totalDuration) {
              setIsPlayingMaster(false);
              return totalDuration;
          }
          syncTracks(next);
          playbackInterval.current = requestAnimationFrame(updateMasterPlayback);
          return next;
      });
  };

  const syncTracks = (time: number) => {
      projectData.audioTracks.forEach(track => {
          const audio = audioRefs.current[track.id];
          if (!audio) return;
          const start = track.startTime || 0;
          const dur = parseFloat(track.duration.toString());
          
          if (time >= start && time < start + dur) {
              if (audio.paused) {
                  audio.currentTime = time - start;
                  audio.play().catch(() => {});
              } else if (Math.abs(audio.currentTime - (time - start)) > 0.5) {
                  audio.currentTime = time - start;
              }
          } else {
              if (!audio.paused) audio.pause();
          }
      });
  };

  const toggleLibraryPreview = (url: string, id: string) => {
      try {
          if (currentPlayingId === id) {
              audioRefs.current['preview']?.pause();
              setCurrentPlayingId(null);
          } else {
              if (audioRefs.current['preview']) audioRefs.current['preview'].pause();
              const audio = new Audio(url);
              audio.crossOrigin = 'anonymous';
              audio.volume = 0.5;
              audio.onended = () => setCurrentPlayingId(null);
              audio.play().catch(e => console.error("Playback error", e));
              audioRefs.current['preview'] = audio;
              setCurrentPlayingId(id);
          }
      } catch (e) { console.error(e); }
  };

  const addMusicTrack = (track: typeof YOUTUBE_LIBRARY[0]) => {
      const cleanTracks = projectData.audioTracks.filter(t => t.type !== 'music');
      const newTrack: AudioAsset = {
          id: `music-${Date.now()}`,
          name: track.title,
          type: 'music',
          duration: totalDuration.toFixed(2), 
          url: track.url,
          startTime: 0
      };
      onUpdateProject({ audioTracks: [...cleanTracks, newTrack] });
  };

  const addSFXTrack = (sfx: typeof SFX_LIBRARY[0]) => {
      const newTrack: AudioAsset = {
          id: `sfx-${Date.now()}`,
          name: sfx.title,
          type: 'sfx',
          duration: sfx.duration,
          url: sfx.url,
          startTime: masterTime // Insert at current playhead
      };
      onUpdateProject({ audioTracks: [...projectData.audioTracks, newTrack] });
  };

  const handleAutoMix = async () => {
      if (!projectData.script) return;
      onStartTask('AUDIO_BATCH', 'توليد صوتي وميكساج شامل (Magic Mix)...');
      
      try {
          const newTracks: AudioAsset[] = [];
          const script = projectData.script;
          let timelineCursor = 0; 

          // 1. Voiceover
          const segments = [
              { text: script.hook, id: 'hook', label: 'المقدمة', sfxCue: undefined as string | undefined }, 
              ...script.scenes.map((s, i) => ({ 
                  text: s.narration || s.description || '', 
                  id: `scene-${i}`, 
                  label: `مشهد ${i+1}`,
                  sfxCue: s.sfxCue 
              }))
          ];

          for (let i = 0; i < segments.length; i++) {
              const seg = segments[i];
              onUpdateTask(10 + Math.round((i/segments.length) * 50), `توليد صوت (${selectedVoice}): ${seg.label}`);
              
              const audioUrl = await generateVoiceover(seg.text, selectedVoice);
              if (audioUrl) {
                  const a = new Audio(audioUrl);
                  await new Promise(r => { a.onloadedmetadata = r; a.onerror = r; a.src = audioUrl; });
                  const duration = a.duration || 5.0;
                  
                  newTracks.push({
                      id: `vo-${Date.now()}-${i}`,
                      name: seg.label,
                      type: 'voiceover',
                      duration: duration.toFixed(2),
                      url: audioUrl,
                      startTime: timelineCursor
                  });
                  
                  if (seg.sfxCue && seg.sfxCue !== 'None') {
                      const cueLower = seg.sfxCue.toLowerCase();
                      const sfx = SFX_LIBRARY.find(s => 
                          s.title.toLowerCase().includes(cueLower) || cueLower.includes(s.title.toLowerCase())
                      );
                      if (sfx) {
                          newTracks.push({
                              id: `sfx-auto-${i}`, name: sfx.title, type: 'sfx', duration: sfx.duration, url: sfx.url, startTime: timelineCursor
                          });
                      }
                  }
                  timelineCursor += duration;
              }
          }

          // 2. Background Music
          const aiTrackId = script.selectedMusicTrackId;
          const bgTrack = YOUTUBE_LIBRARY.find(t => t.id === aiTrackId) || YOUTUBE_LIBRARY[0];
          newTracks.push({
              id: 'bg-music', name: bgTrack.title, type: 'music', duration: timelineCursor.toFixed(1), url: bgTrack.url, startTime: 0
          });

          onUpdateTask(100, "تم الميكساج!");
          onCompleteTask(true);
          onUpdateProject({ audioTracks: newTracks });

      } catch (e: any) {
          onUpdateTask(100, "فشل");
          onCompleteTask(false);
          alert(e.message);
      }
  };

  const handleDownloadFullMix = async () => {
      if (projectData.audioTracks.length === 0) return;
      setIsRendering(true);
      try {
          const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
          const ctx = new OfflineContext(2, 44100 * (totalDuration + 1), 44100);
          
          const buffers = await Promise.all(projectData.audioTracks.map(async (t) => {
              if (!t.url) return null;
              const res = await fetch(t.url);
              const ab = await res.arrayBuffer();
              return { b: await ctx.decodeAudioData(ab), t };
          }));

          buffers.forEach(item => {
              if (!item) return;
              const src = ctx.createBufferSource();
              src.buffer = item.b;
              const gain = ctx.createGain();
              gain.gain.value = item.t.type === 'music' ? 0.3 : 1.0;
              src.connect(gain);
              gain.connect(ctx.destination);
              src.start(item.t.startTime || 0);
          });

          const rendered = await ctx.startRendering();
          
          // WAV Encoding logic (Inline for portability)
          const buffer = rendered;
          const length = buffer.length * 2 * 2 + 44;
          const bufferArr = new ArrayBuffer(length);
          const view = new DataView(bufferArr);
          const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
          let offset = 0, pos = 0;
          const writeString = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); offset += s.length; };
          
          writeString('RIFF'); view.setUint32(4, 36 + buffer.length * 4, true); offset += 4; writeString('WAVE');
          writeString('fmt '); view.setUint32(16, 16, true); offset += 4; view.setUint16(20, 1, true); offset += 2; view.setUint16(22, 2, true); offset += 2; view.setUint32(24, 44100, true); offset += 4; view.setUint32(28, 44100 * 4, true); offset += 4; view.setUint16(32, 4, true); offset += 2; view.setUint16(34, 16, true); offset += 2;
          writeString('data'); view.setUint32(40, buffer.length * 4, true); offset += 4;

          while(pos < buffer.length) {
              for(let i=0; i<2; i++) {
                  let s = Math.max(-1, Math.min(1, channels[i][pos]));
                  s = s < 0 ? s * 0x8000 : s * 0x7FFF;
                  view.setInt16(offset, s, true); offset += 2;
              }
              pos++;
          }
          
          const url = URL.createObjectURL(new Blob([bufferArr], { type: 'audio/wav' }));
          const a = document.createElement('a'); a.href = url; a.download = 'mix_final.wav'; a.click();
      } catch (e) { alert("Rendering failed"); }
      setIsRendering(false);
  };

  const removeTrack = (id: string) => {
      onUpdateProject({ audioTracks: projectData.audioTracks.filter(t => t.id !== id) });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-sans relative">
      {/* Header */}
      <div className="h-20 px-8 flex justify-between items-center bg-slate-950 border-b border-slate-800 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Music className="text-rose-500" /> الاستوديو الصوتي
          </h2>
          <p className="text-xs text-slate-400">توليد التعليق، اختيار الموسيقى، والميكساج.</p>
        </div>
        <div className="flex gap-3">
             <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2">
                 <User className="w-4 h-4 text-slate-400"/>
                 <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="bg-transparent text-white text-xs font-bold p-2 outline-none cursor-pointer"
                 >
                     {VOICES.map(v => <option key={v.name} value={v.name} className="bg-slate-900">{v.name} ({v.gender})</option>)}
                 </select>
             </div>
             <button onClick={handleAutoMix} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-900/30 transition">
                <Sparkles className="w-5 h-5"/> توليد شامل (Magic Mix)
             </button>
             <button onClick={onNext} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition border border-slate-700">
                التالي <ArrowLeft className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Main Workspace (Split View) */}
      <div className={`flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-slate-950 transition-all duration-300 ${isMixerCollapsed ? 'pb-16' : 'pb-64'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. Voiceover Script */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Mic2 className="w-4 h-4 text-rose-500"/> السيناريو والتعليق
                </h3>
                <div className="space-y-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 opacity-80">
                        <span className="text-[10px] text-rose-400 font-bold block mb-1">المقدمة (Hook)</span>
                        <p className="text-xs text-slate-300 truncate">{projectData.script?.hook}</p>
                    </div>
                    {projectData.script?.scenes.map((scene, i) => (
                        <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-rose-400 font-bold">مشهد {i+1}</span>
                                {scene.sfxCue && scene.sfxCue !== 'None' && <span className="text-[9px] bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded">SFX: {scene.sfxCue}</span>}
                            </div>
                            <p className="text-xs text-slate-300 dir-rtl">{scene.narration}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Library (Music & SFX) - RESTORED */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex gap-2 mb-4 border-b border-slate-800 pb-2">
                    <button onClick={() => setActiveTab('music')} className={`text-xs font-bold px-3 py-1.5 rounded transition ${activeTab === 'music' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>مكتبة الموسيقى</button>
                    <button onClick={() => setActiveTab('sfx')} className={`text-xs font-bold px-3 py-1.5 rounded transition ${activeTab === 'sfx' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}>مكتبة المؤثرات</button>
                </div>

                {activeTab === 'music' && (
                    <div className="space-y-2">
                        {YOUTUBE_LIBRARY.map(track => (
                            <div key={track.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between group hover:border-blue-500/30 transition">
                                <div>
                                    <div className="text-xs text-white font-bold">{track.title}</div>
                                    <div className="text-[10px] text-slate-500">{track.mood} • {track.duration}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => addMusicTrack(track)} className="p-2 rounded-full bg-slate-900 text-green-500 hover:bg-green-900/20 transition" title="إضافة للمشروع"><Sparkles className="w-4 h-4"/></button>
                                    <button onClick={() => toggleLibraryPreview(track.url, track.id)} className="p-2 rounded-full bg-slate-900 text-blue-500 hover:bg-blue-900/20 transition">
                                        {currentPlayingId === track.id ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'sfx' && (
                    <div className="grid grid-cols-2 gap-2">
                        {SFX_LIBRARY.map(sfx => (
                            <div key={sfx.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between group hover:border-orange-500/30 transition">
                                <div className="truncate pr-2">
                                    <div className="text-xs text-white font-bold truncate">{sfx.title}</div>
                                    <div className="text-[10px] text-slate-500">{sfx.category}</div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => addSFXTrack(sfx)} className="p-2 rounded-full bg-slate-900 text-green-500 hover:bg-green-900/20 transition" title="إضافة"><Sparkles className="w-3 h-3"/></button>
                                    <button onClick={() => toggleLibraryPreview(sfx.url, sfx.id)} className="p-2 rounded-full bg-slate-900 text-orange-500 hover:bg-orange-900/20 transition">
                                        {currentPlayingId === sfx.id ? <Pause className="w-3 h-3"/> : <Play className="w-3 h-3"/>}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* FIXED BOTTOM MIXER (Collapsible) */}
      <div 
        className={`bg-black border-t border-slate-800 flex flex-col shrink-0 shadow-2xl fixed bottom-0 left-64 right-0 z-50 transition-all duration-300 ${isMixerCollapsed ? 'h-12' : 'h-64'}`}
      >
           {/* Controls Bar */}
           <div className="h-12 bg-slate-900/90 backdrop-blur flex items-center justify-between px-6 border-b border-slate-800 shrink-0" onClick={() => isMixerCollapsed && setIsMixerCollapsed(false)}>
                
                {/* Collapse Toggle */}
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsMixerCollapsed(!isMixerCollapsed); }}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-400 hover:text-white w-10 h-4 rounded-t-lg flex items-center justify-center border-t border-x border-slate-700 text-[10px]"
                >
                    {isMixerCollapsed ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                </button>

                <div className="flex items-center gap-4 w-1/2">
                    <span className="text-xs font-mono text-indigo-400 w-12">{masterTime.toFixed(1)}s</span>
                    <input 
                        type="range" min="0" max={totalDuration || 100} step="0.1" 
                        value={masterTime} 
                        onChange={(e) => { setMasterTime(parseFloat(e.target.value)); setIsPlayingMaster(false); }}
                        className="flex-1 accent-rose-500 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer hover:h-2 transition-all"
                    />
                    <span className="text-xs font-mono text-slate-500 w-12 text-right">{totalDuration.toFixed(1)}s</span>
                </div>

                <div className="flex items-center gap-4">
                   <button onClick={() => setIsPlayingMaster(!isPlayingMaster)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition">
                       {isPlayingMaster ? <Pause className="w-4 h-4 fill-current"/> : <Play className="w-4 h-4 fill-current ml-0.5"/>}
                   </button>
                   <button onClick={handleDownloadFullMix} disabled={isRendering} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                        {isRendering ? <Loader2 className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3"/>} تحميل الميكس (WAV)
                   </button>
                </div>
           </div>

           {/* Tracks Timeline (Hidden when collapsed) */}
           <div className={`flex-1 bg-slate-950 p-4 overflow-y-auto custom-scrollbar relative ${isMixerCollapsed ? 'hidden' : 'block'}`}>
               <div className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none" style={{ left: `calc(${(masterTime / (totalDuration || 1)) * 100}% + 16px)` }}></div>
               
               {['voiceover', 'music', 'sfx'].map((type) => (
                   <div key={type} className="mb-2 relative">
                       <div className="flex items-center mb-1">
                           <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${type==='voiceover'?'bg-rose-900/30 text-rose-400':type==='music'?'bg-blue-900/30 text-blue-400':'bg-orange-900/30 text-orange-400'}`}>
                               {type === 'voiceover' ? 'التعليق' : type === 'music' ? 'الموسيقى' : 'المؤثرات'}
                           </span>
                       </div>
                       <div className="h-8 bg-slate-900 rounded border border-slate-800 relative w-full overflow-hidden">
                           {projectData.audioTracks.filter(t => t.type === type).map(t => (
                               <div 
                                    key={t.id} 
                                    className={`absolute top-1 bottom-1 rounded flex items-center px-2 group ${type==='voiceover'?'bg-rose-600':type==='music'?'bg-blue-600':'bg-orange-600'}`} 
                                    style={{ 
                                        left: `${(t.startTime! / (totalDuration || 1))*100}%`, 
                                        width: `${(parseFloat(t.duration.toString()) / (totalDuration || 1))*100}%`,
                                        minWidth: '4px'
                                    }}
                                    title={t.name}
                               >
                                   <span className="text-[8px] text-white font-bold truncate opacity-80">{t.name}</span>
                                   <div className="hidden group-hover:flex absolute right-1 gap-1">
                                       <button onClick={(e) => { e.stopPropagation(); removeTrack(t.id); }} className="text-white hover:text-red-300">
                                           <Trash2 className="w-3 h-3"/>
                                       </button>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
               ))}
           </div>
      </div>
    </div>
  );
};
