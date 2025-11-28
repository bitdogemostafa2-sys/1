
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic2, 
  Music, 
  Volume2, 
  Play, 
  Pause, 
  Wand2,
  ArrowLeft,
  Search,
  Plus,
  Loader2,
  Sparkles,
  X,
  Layers,
  Clock
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

// REAL Stock Music Data
const YOUTUBE_LIBRARY = [
    { id: 'mus_1', title: 'Cinematic Dream', artist: 'SoundHelix', genre: 'Cinematic', mood: 'Dramatic', duration: '6:12', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { id: 'mus_2', title: 'Epic Journey', artist: 'SoundHelix', genre: 'Cinematic', mood: 'Epic', duration: '7:05', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
    { id: 'mus_3', title: 'Happy Vibes', artist: 'SoundHelix', genre: 'Pop', mood: 'Happy', duration: '5:44', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { id: 'mus_6', title: 'Action Power', artist: 'SoundHelix', genre: 'Rock', mood: 'Epic', duration: '4:30', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3' },
    { id: 'mus_7', title: 'Romantic Piano', artist: 'SoundHelix', genre: 'Piano', mood: 'Romance', duration: '4:20', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
    { id: 'mus_8', title: 'Dark Suspense', artist: 'SoundHelix', genre: 'Soundtrack', mood: 'Horror', duration: '3:50', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3' },
];

// High Quality SFX Library
export const SFX_LIBRARY = [
    { id: 'sfx_whoosh', title: 'Cinematic Whoosh', category: 'Transition', duration: '0:01', url: 'https://cdn.freesound.org/previews/614/614620_11132629-lq.mp3' },
    { id: 'sfx_glitch', title: 'Tech Glitch', category: 'Transition', duration: '0:01', url: 'https://cdn.freesound.org/previews/390/390627_5121236-lq.mp3' },
    { id: 'sfx_boom', title: 'Deep Boom', category: 'Impact', duration: '0:03', url: 'https://cdn.freesound.org/previews/148/148858_2578041-lq.mp3' },
    { id: 'sfx_hit', title: 'Action Hit', category: 'Action', duration: '0:01', url: 'https://cdn.freesound.org/previews/538/538466_6627602-lq.mp3' },
    { id: 'sfx_riser', title: 'Tension Riser', category: 'Horror', duration: '0:05', url: 'https://cdn.freesound.org/previews/415/415951_8127393-lq.mp3' },
    { id: 'sfx_heart', title: 'Slow Heartbeat', category: 'Horror', duration: '0:04', url: 'https://cdn.freesound.org/previews/320/320673_5260872-lq.mp3' },
    { id: 'sfx_type', title: 'Fast Typing', category: 'Technology', duration: '0:02', url: 'https://cdn.freesound.org/previews/240/240839_4107740-lq.mp3' },
    { id: 'sfx_cam', title: 'Camera Snap', category: 'Technology', duration: '0:01', url: 'https://cdn.freesound.org/previews/545/545499_11977239-lq.mp3' },
    { id: 'sfx_rain', title: 'Light Rain', category: 'Nature', duration: '0:05', url: 'https://cdn.freesound.org/previews/519/519965_11306603-lq.mp3' }
];

export const AudioStudio: React.FC<AudioStudioProps> = ({ 
    projectData, 
    onUpdateProject, 
    onNext,
    onStartTask,
    onUpdateTask,
    onCompleteTask 
}) => {
  const [activeTab, setActiveTab] = useState<'voiceover' | 'music' | 'sfx'>('voiceover');
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentVoice, setCurrentVoice] = useState('Kore');
  const [isAutoMixing, setIsAutoMixing] = useState(false);
  const [processingSegment, setProcessingSegment] = useState<number | null>(null);

  useEffect(() => {
    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };
  }, []);

  const togglePlay = (url: string, id: string) => {
      if (currentPlayingId === id) {
          audioRef.current?.pause();
          setCurrentPlayingId(null);
      } else {
          if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
          }
          try {
              const audio = new Audio(url);
              audio.volume = 0.5;
              audio.onended = () => setCurrentPlayingId(null);
              audio.play();
              audioRef.current = audio;
              setCurrentPlayingId(id);
          } catch (err) {
              console.error("Audio Play Error:", err);
          }
      }
  };

  const getAudioDuration = (url: string): Promise<number> => {
      return new Promise((resolve) => {
          const audio = new Audio(url);
          audio.onloadedmetadata = () => {
              if (audio.duration && isFinite(audio.duration)) resolve(audio.duration);
              else resolve(5); 
          };
          audio.onerror = () => resolve(5); 
      });
  };

  // --- THE MAGIC MIXER (STRICT MODE) ---
  const handleAutoMix = async () => {
      if (!projectData.script) return;
      
      setIsAutoMixing(true);
      onStartTask('AUDIO_BATCH', 'جاري توليد وميكساج الصوت الكامل (Magic Mix)...');
      
      try {
          const newTracks: AudioAsset[] = [];
          const script = projectData.script;
          
          // START AT 0: Only intro video in Editor adds offset visually
          let timelineCursor = 0; 

          onUpdateTask(10, `توليد صوت المعلق (${currentVoice})...`);
          
          // Combine hook and scenes into one process list
          const segments = [
              { text: script.hook, id: 'hook', label: 'المقدمة (Hook)', sfxCue: 'Suspense Rise' }, 
              ...script.scenes.map((s, i) => ({ 
                  text: s.narration || s.description || "No text", 
                  id: `scene-${i}`, 
                  label: `مشهد ${i+1}`,
                  sfxCue: s.sfxCue 
              }))
          ];

          for (let i = 0; i < segments.length; i++) {
              const seg = segments[i];
              onUpdateTask(20 + Math.round((i/segments.length) * 40), `جاري توليد: ${seg.label}`);
              
              // Add delay to prevent rate limiting
              await new Promise(r => setTimeout(r, 800));

              try {
                  const audioUrl = await generateVoiceover(seg.text, currentVoice);
                  if (audioUrl) {
                      const duration = await getAudioDuration(audioUrl);
                      
                      // Add Voice Track
                      newTracks.push({
                          id: `vo-${Date.now()}-${i}`,
                          name: seg.label,
                          type: 'voiceover',
                          duration: duration.toFixed(2), // Keep precision
                          url: audioUrl,
                          startTime: timelineCursor
                      });
                      
                      // Add SFX Track (STRICT: Only if cue exists and valid)
                      if (seg.sfxCue && seg.sfxCue !== 'None') {
                          const sfxAsset = SFX_LIBRARY.find(s => 
                              s.title.toLowerCase().includes(seg.sfxCue!.toLowerCase()) || 
                              s.category.toLowerCase().includes(seg.sfxCue!.toLowerCase())
                          );
                          
                          if (sfxAsset) {
                              newTracks.push({
                                  id: `sfx-auto-${Date.now()}-${i}`,
                                  name: `SFX: ${sfxAsset.title}`,
                                  type: 'sfx',
                                  duration: sfxAsset.duration, 
                                  url: sfxAsset.url,
                                  // Place SFX at start of scene
                                  startTime: timelineCursor 
                              });
                          }
                      }
                      
                      timelineCursor += duration;
                  }
              } catch (e) {
                  console.error(`Failed segment ${i}`, e);
                  // Continue to next segment even if one fails
              }
          }

          // --- SMART MUSIC SELECTION ---
          const aiTrackId = script.selectedMusicTrackId;
          const aiMusicMood = script.musicMood || 'Dramatic';
          onUpdateTask(80, `اختيار الموسيقى (ID: ${aiTrackId || 'Auto'})...`);
          
          let bgTrack;
          if (aiTrackId) {
              bgTrack = YOUTUBE_LIBRARY.find(t => t.id === aiTrackId);
          }
          if (!bgTrack) {
              bgTrack = YOUTUBE_LIBRARY.find(t => t.mood === aiMusicMood);
          }
          if (!bgTrack) bgTrack = YOUTUBE_LIBRARY[0]; 
          
          newTracks.push({
              id: `bg-music-${Date.now()}`,
              name: `Music: ${bgTrack.title}`,
              type: 'music',
              duration: timelineCursor.toFixed(1), 
              url: bgTrack.url,
              startTime: 0 
          });

          onUpdateTask(100, "تم!");
          onCompleteTask(true);
          onUpdateProject({ audioTracks: newTracks });

      } catch (error: any) {
          console.error(error);
          onUpdateTask(100, "فشل التوليد");
          onCompleteTask(false);
          alert("حدث خطأ: " + error.message);
      } finally {
          setIsAutoMixing(false);
      }
  };

  const generateSingleSegment = async (text: string, index: number, label: string) => {
      setProcessingSegment(index);
      try {
          const audioUrl = await generateVoiceover(text, currentVoice);
          if (audioUrl) {
              const duration = await getAudioDuration(audioUrl);
              const newTrack: AudioAsset = {
                  id: `vo-${Date.now()}-${index}`,
                  name: label,
                  type: 'voiceover',
                  duration: duration.toFixed(1), 
                  url: audioUrl,
                  startTime: (index * 5) // Fallback
              };
              onUpdateProject({ audioTracks: [...projectData.audioTracks, newTrack] });
          }
      } catch(e: any) {
          alert("فشل توليد الصوت: " + e.message);
      } finally {
          setProcessingSegment(null);
      }
  };

  const removeTrack = (id: string) => {
      const updated = projectData.audioTracks.filter(t => t.id !== id);
      onUpdateProject({ audioTracks: updated });
  };

  const maxDuration = Math.max(
    ...projectData.audioTracks.map(t => (t.startTime || 0) + parseFloat(t.duration.toString())),
    60 
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-sans">
      <div className="h-20 px-8 flex justify-between items-center bg-slate-950 border-b border-slate-800 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Mic2 className="text-rose-500" />
            الاستوديو الصوتي (DAW Mode)
          </h2>
          <p className="text-xs text-slate-400">توليد، ميكساج، وتوزيع زمني دقيق (0.0s Precision).</p>
        </div>
        
        <div className="flex gap-3">
             <button 
                onClick={handleAutoMix}
                disabled={isAutoMixing || !projectData.script}
                className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-900/30 transition disabled:opacity-50 animate-pulse"
             >
                {isAutoMixing ? <Loader2 className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5"/>}
                توليد وميكساج شامل (Magic)
             </button>

             <button onClick={onNext} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition border border-slate-700">
                الذهاب للمحرر <ArrowLeft className="w-4 h-4" />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-slate-950 pb-72">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
                <button onClick={() => setActiveTab('voiceover')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'voiceover' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}>المعلق</button>
                <button onClick={() => setActiveTab('music')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'music' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}>الموسيقى</button>
                <button onClick={() => setActiveTab('sfx')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'sfx' ? 'bg-orange-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}>المؤثرات</button>
            </div>

            {activeTab === 'voiceover' && (
                 <div className="space-y-4">
                    {projectData.script?.scenes.map((scene, i) => (
                        <div key={i} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                            <div>
                                <h4 className="text-white font-bold text-sm">مشهد {i+1}</h4>
                                <p className="text-xs text-slate-400 max-w-lg truncate">{scene.narration}</p>
                            </div>
                            <button onClick={() => generateSingleSegment(scene.narration, i, `مشهد ${i+1}`)} disabled={processingSegment===i} className="bg-indigo-600 px-3 py-1 rounded text-xs text-white">
                                {processingSegment===i ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>} توليد
                            </button>
                        </div>
                    ))}
                 </div>
            )}
            
            {activeTab === 'sfx' && (
                 <div className="grid grid-cols-2 gap-2">
                     {SFX_LIBRARY.map(sfx => (
                         <div key={sfx.id} className="bg-slate-950 p-3 rounded border border-slate-800 flex justify-between">
                             <span className="text-white text-sm">{sfx.title}</span>
                             <button onClick={() => togglePlay(sfx.url, sfx.id)} className="text-orange-500"><Play className="w-4 h-4"/></button>
                         </div>
                     ))}
                 </div>
            )}
        </div>
      </div>

      {/* TIMELINE MIXER (Fixed Bottom) */}
      <div className="h-64 bg-slate-900 border-t border-slate-800 flex flex-col shrink-0 shadow-2xl fixed bottom-0 left-64 right-0 z-50">
           <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-rose-500" /> ميكسر الترتيب (Tracks)
                </h3>
                <span className="text-xs text-slate-500"><Clock className="w-3 h-3 inline"/> Total: {maxDuration.toFixed(1)}s</span>
           </div>

           <div className="flex-1 overflow-x-auto custom-scrollbar p-4 bg-slate-900 relative">
               <div className="relative min-w-full h-full" style={{ width: `${Math.max(100, maxDuration * 10)}%` }}>
                   <div className="absolute inset-0 pointer-events-none">
                       {Array.from({ length: Math.ceil(maxDuration / 5) }).map((_, i) => (
                           <div key={i} className="absolute top-0 bottom-0 border-l border-slate-800 text-[9px] text-slate-600 pl-1" style={{ left: `${(i * 5 / maxDuration) * 100}%` }}>{i * 5}s</div>
                       ))}
                   </div>

                   <div className="space-y-2 relative pt-4">
                        {/* Rows for Voice, Music, SFX */}
                        {['voiceover', 'music', 'sfx'].map(type => (
                            <div key={type} className="h-10 w-full relative bg-slate-950/30 rounded border border-slate-800/30 mb-2">
                                <div className="absolute -left-16 top-2 text-[10px] text-slate-500 w-12 text-right capitalize">{type}</div>
                                {projectData.audioTracks.filter(t => t.type === type).map(track => (
                                    <div 
                                        key={track.id}
                                        className={`absolute top-1 h-8 rounded-lg flex items-center px-2 overflow-hidden group cursor-pointer border ${type === 'voiceover' ? 'bg-rose-900/80 border-rose-500' : type === 'music' ? 'bg-blue-900/80 border-blue-500' : 'bg-orange-900/80 border-orange-500'}`}
                                        style={{ 
                                            left: `${(track.startTime! / maxDuration) * 100}%`,
                                            width: `${(parseFloat(track.duration.toString()) / maxDuration) * 100}%`
                                        }}
                                    >
                                        <span className="text-[10px] text-white font-bold truncate flex-1">{track.name}</span>
                                        <button onClick={() => removeTrack(track.id)} className="text-white opacity-0 group-hover:opacity-100 hover:text-red-300"><X className="w-3 h-3"/></button>
                                    </div>
                                ))}
                            </div>
                        ))}
                   </div>
               </div>
           </div>
      </div>
    </div>
  );
};
