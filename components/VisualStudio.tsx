
import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Wand2, 
  ArrowLeft,
  RefreshCw, 
  AlertCircle,
  Zap,
  ChevronDown
} from 'lucide-react';
import { generateThumbnail, generateVideo, searchImages, searchPexelsImages, searchPixabayImages } from '../services/geminiService';
import { ProjectState, SceneAsset, AssetSource, MotionType, GlobalTask } from '../types';

interface VisualStudioProps {
    projectData: ProjectState;
    onUpdateProject: (data: Partial<ProjectState>) => void;
    onNext: () => void;
    // Task Props
    onStartTask: (type: GlobalTask['type'], title: string) => void;
    onUpdateTask: (progress: number, log?: string) => void;
    onCompleteTask: (success: boolean) => void;
}

export const VisualStudio: React.FC<VisualStudioProps> = ({ 
    projectData, 
    onUpdateProject, 
    onNext,
    onStartTask,
    onUpdateTask,
    onCompleteTask 
}) => {
  const [localScenes, setLocalScenes] = useState<SceneAsset[]>([]);
  const [loadingSceneIndex, setLoadingSceneIndex] = useState<number | null>(null);
  
  // Keys availability
  const [hasPexels, setHasPexels] = useState(false);
  const [hasPixabay, setHasPixabay] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
      // Check for keys
      setHasPexels(!!localStorage.getItem('pexels_api_key'));
      setHasPixabay(!!localStorage.getItem('pixabay_api_key'));

      // Sync local state
      if (projectData.script?.scenes && projectData.sceneAssets.length === 0) {
          const initialAssets: SceneAsset[] = projectData.script.scenes.map((scene, index) => ({
              sceneIndex: index,
              prompt: scene.visualCue,
              type: 'image', 
              source: 'gemini', // Default source
              motion: (scene as any).suggestedMotion || 'none'
          }));
          setLocalScenes(initialAssets);
          onUpdateProject({ sceneAssets: initialAssets });
      } else if (projectData.sceneAssets.length > 0) {
          setLocalScenes(projectData.sceneAssets);
      }
  }, [projectData.script]);

  const updateSceneAsset = (index: number, updates: Partial<SceneAsset>) => {
      const newScenes = [...localScenes];
      newScenes[index] = { ...newScenes[index], ...updates };
      setLocalScenes(newScenes);
      onUpdateProject({ sceneAssets: newScenes });
  };

  const executeGeneration = async (index: number, type: 'image' | 'video', source: AssetSource, prompt: string): Promise<string | null> => {
      if (type === 'video') {
           return await generateVideo(prompt);
      } else {
           switch (source) {
               case 'gemini':
                   return await generateThumbnail(prompt);
               case 'pexels':
                   const pexels = await searchPexelsImages(prompt);
                   return pexels[0] || null;
               case 'pixabay':
                   const pixabay = await searchPixabayImages(prompt);
                   return pixabay[0] || null;
               case 'google_search':
                   const google = await searchImages(prompt);
                   return google[0] || null;
               default:
                   return await generateThumbnail(prompt);
           }
      }
  };

  const handleGenerateSingle = async (index: number, type: 'image' | 'video') => {
      setLoadingSceneIndex(index);
      setErrorMsg(null);
      const scene = localScenes[index];
      const source = scene.source || 'gemini';
      
      try {
          const url = await executeGeneration(index, type, source, scene.prompt);
          if (url) {
              updateSceneAsset(index, { 
                  imageUrl: type === 'image' ? url : undefined,
                  videoUrl: type === 'video' ? url : undefined,
                  type: type 
              });
          } else {
              setErrorMsg(`فشل الحصول على وسائط من المصدر: ${source}`);
          }
      } catch (e: any) {
          console.error(e);
          if (e.message?.includes('429')) {
             setErrorMsg("تم تجاوز حد الاستخدام (Quota Exceeded). يرجى الانتظار قليلاً.");
          } else {
             setErrorMsg(e.message || "حدث خطأ غير متوقع.");
          }
      } finally {
          setLoadingSceneIndex(null);
      }
  };

  // Batch Generation using Global Task Manager
  const handleMagicBatchGeneration = async () => {
      setErrorMsg(null);
      const newScenes = [...localScenes];
      const totalItems = newScenes.length;
      
      onStartTask('VISUAL_BATCH', 'توليد المشاهد والمؤثرات البصرية...');
      onUpdateTask(0, `بدء المعالجة لـ ${totalItems} مشهد`);

      let completedCount = 0;
      
      for (let i = 0; i < newScenes.length; i++) {
          const scene = newScenes[i];
          const source = scene.source || 'gemini';

          // 1. Apply AI Motion if needed
          if (scene.motion === 'none' && projectData.script?.scenes?.[i]?.suggestedMotion) {
              scene.motion = projectData.script.scenes[i].suggestedMotion;
          }

          if (!scene.imageUrl && !scene.videoUrl) { 
             onUpdateTask(
                 Math.round((completedCount / totalItems) * 100),
                 `المشهد ${i + 1}: جاري التوليد من مصدر ${source}...`
             );
             
             try {
                 const url = await executeGeneration(i, 'image', source, scene.prompt);
                 if (url) {
                     newScenes[i] = { ...scene, imageUrl: url, type: 'image' };
                     // Update locally visually so user sees progress if looking
                     setLocalScenes([...newScenes]); 
                 } else {
                     onUpdateTask(Math.round((completedCount / totalItems) * 100), `فشل في المشهد ${i+1} (قد يكون بسبب الكوتا)`);
                 }
             } catch(e: any) {
                 console.error(`Failed scene ${i}`, e);
                 onUpdateTask(Math.round((completedCount / totalItems) * 100), `خطأ في المشهد ${i+1}`);
             }
             
             // INCREASED DELAY to 10000ms (10 seconds) to prevent 429 Errors strictly
             await new Promise(r => setTimeout(r, 10000));
          }
          completedCount++;
      }
      
      onUpdateProject({ sceneAssets: newScenes });
      onUpdateTask(100, "تم الانتهاء من جميع المشاهد");
      onCompleteTask(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col animate-fadeIn pb-32 relative">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <ImageIcon className="text-purple-500" />
            الاستوديو المرئي
          </h2>
          <p className="text-slate-400">تحكم كامل: اختر المصدر لكل مشهد ثم اضغط توليد.</p>
        </div>
        
        <div className="flex gap-3 flex-wrap justify-end">
             {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errorMsg}
                </div>
            )}
            
             <button 
                onClick={handleMagicBatchGeneration}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-indigo-900/30"
            >
                <Wand2 className="w-4 h-4" />
                توليد الصورة والفيدهوهات وعمل الموثرات (Magic)
            </button>

            <button onClick={onNext} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition border border-slate-700">
                التالي <ArrowLeft className="w-4 h-4" />
            </button>
        </div>
      </div>

      {!projectData.script ? (
          <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
              <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
              <p>لا يوجد سيناريو بعد. يرجى الذهاب لـ "محرك المحتوى" أولاً.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 gap-6">
              {localScenes.map((scene, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col md:flex-row min-h-[320px] shadow-lg hover:border-purple-500/30 transition">
                      {/* Preview Area */}
                      <div className="w-full md:w-1/3 bg-black relative flex items-center justify-center border-l border-slate-800 overflow-hidden">
                          {loadingSceneIndex === idx ? (
                              <div className="flex flex-col items-center gap-2">
                                  <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                                  <span className="text-xs text-slate-400">جاري المعالجة...</span>
                              </div>
                          ) : scene.imageUrl ? (
                               <div className="relative w-full h-full group overflow-hidden">
                                  <img 
                                    src={scene.imageUrl} 
                                    alt={`Scene ${idx}`} 
                                    className="w-full h-full object-cover"
                                    style={{
                                        transform: scene.motion === 'zoom-in' ? 'scale(1.3)' : 
                                                   scene.motion === 'zoom-out' ? 'scale(0.8)' : 
                                                   scene.motion === 'pan-left' ? 'translateX(-10%)' :
                                                   scene.motion === 'pan-right' ? 'translateX(10%)' :
                                                   scene.motion === 'tilt-up' ? 'translateY(-10%)' :
                                                   'scale(1)',
                                        transition: 'transform 10s linear'
                                    }}
                                  />
                                  <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white flex gap-1">
                                      <Zap className="w-3 h-3" /> {scene.motion}
                                  </div>
                               </div>
                          ) : (
                              <div className="text-center p-4">
                                  <ImageIcon className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                                  <p className="text-xs text-slate-500">جاهز للتوليد</p>
                              </div>
                          )}
                          <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white z-10">
                              Scene {idx + 1}
                          </div>
                      </div>

                      {/* Controls Area */}
                      <div className="flex-1 p-6 flex flex-col justify-between">
                          <div className="space-y-4">
                              <div className="flex justify-between items-start">
                                  <h3 className="text-white font-bold">{projectData.script?.scenes?.[idx]?.timestamp}</h3>
                                  <span className="text-xs text-slate-400 max-w-[300px] truncate">
                                      {projectData.script?.scenes?.[idx]?.description}
                                  </span>
                              </div>
                              
                              <textarea 
                                  value={scene.prompt}
                                  onChange={(e) => updateSceneAsset(idx, { prompt: e.target.value })}
                                  className="w-full h-20 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 outline-none resize-none placeholder-slate-600 focus:border-purple-500"
                              />
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* DROPDOWN MENU FOR SOURCE */}
                                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                                      <label className="text-[10px] text-slate-500 block mb-1">مصدر التوليد</label>
                                      <div className="relative">
                                          <select 
                                              value={scene.source || 'gemini'}
                                              onChange={(e) => updateSceneAsset(idx, { source: e.target.value as AssetSource })}
                                              className="w-full bg-transparent text-white text-xs font-bold outline-none appearance-none cursor-pointer py-1"
                                          >
                                              <option value="gemini" className="bg-slate-900">✨ Gemini AI (توليد)</option>
                                              <option value="google_search" className="bg-slate-900">🔎 Google Search (بحث)</option>
                                              {hasPexels && <option value="pexels" className="bg-slate-900">📸 Pexels (Stock)</option>}
                                              {hasPixabay && <option value="pixabay" className="bg-slate-900">🖼️ Pixabay (Stock)</option>}
                                          </select>
                                          <ChevronDown className="w-3 h-3 text-slate-500 absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                                      </div>
                                  </div>

                                  {/* Motion Selection */}
                                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                                      <label className="text-[10px] text-slate-500 block mb-1">تأثير الحركة (Motion)</label>
                                      <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                          {['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'tilt-up', 'shake', 'pulse'].map(m => (
                                              <button
                                                  key={m}
                                                  onClick={() => updateSceneAsset(idx, { motion: m as MotionType })}
                                                  className={`p-1.5 rounded border transition ${scene.motion === m ? 'bg-purple-500 text-white border-purple-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                                                  title={m}
                                              >
                                                  {m === 'none' ? <span className="text-[10px]">X</span> : <Zap className="w-3 h-3"/>}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="flex gap-3 mt-4 pt-4 border-t border-slate-800">
                              <button 
                                  onClick={() => handleGenerateSingle(idx, 'image')}
                                  disabled={loadingSceneIndex !== null}
                                  className="flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white transition"
                              >
                                  <Wand2 className="w-4 h-4" /> تنفيذ ({scene.source || 'gemini'})
                              </button>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};
