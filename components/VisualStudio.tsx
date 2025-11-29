
import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Wand2, 
  ArrowLeft, 
  RefreshCw, 
  Video,
  Layers,
  Film,
  Play,
  Download
} from 'lucide-react';
import { generateThumbnail, generateVideo, searchImages, searchPexelsImages, searchPixabayImages, searchPexelsVideos, searchPixabayVideos } from '../services/geminiService';
import { ProjectState, SceneAsset, AssetSource, GlobalTask } from '../types';

interface VisualStudioProps {
    projectData: ProjectState;
    onUpdateProject: (data: Partial<ProjectState>) => void;
    onNext: () => void;
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
  const [hasPexels, setHasPexels] = useState(false);
  const [hasPixabay, setHasPixabay] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  
  // Thumbnail State
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(projectData.thumbnails?.[0] || null);

  // Force check keys on mount
  useEffect(() => {
      setHasPexels(!!localStorage.getItem('pexels_api_key'));
      setHasPixabay(!!localStorage.getItem('pixabay_api_key'));
  }, []);

  useEffect(() => {
      if (projectData.script?.scenes && projectData.sceneAssets.length === 0) {
          const initialAssets: SceneAsset[] = projectData.script.scenes.map((scene, index) => ({
              sceneIndex: index,
              prompt: scene.visualCue,
              type: 'image', 
              source: 'gemini', 
              motion: (scene as any).suggestedMotion || 'none'
          }));
          setLocalScenes(initialAssets);
          onUpdateProject({ sceneAssets: initialAssets });
      } else if (projectData.sceneAssets.length > 0) {
          setLocalScenes(projectData.sceneAssets);
      }
      
      if(projectData.thumbnails && projectData.thumbnails.length > 0) {
          setThumbnailUrl(projectData.thumbnails[0]);
      }
  }, [projectData.script]);

  const updateSceneAsset = (index: number, updates: Partial<SceneAsset>) => {
      const newScenes = [...localScenes];
      newScenes[index] = { ...newScenes[index], ...updates };
      setLocalScenes(newScenes);
      onUpdateProject({ sceneAssets: newScenes });
  };

  const handleGenerateThumbnail = async () => {
      if (!projectData.script) return;
      setIsGeneratingThumbnail(true);
      try {
          const prompt = `YouTube Thumbnail for video titled "${projectData.script.title}". 
          Subject: ${projectData.script.hook}. 
          Style: High contrast, vibrant colors, 4k, hyper-realistic, catchy, viral style.`;
          
          const url = await generateThumbnail(prompt);
          if (url) {
              setThumbnailUrl(url);
              onUpdateProject({ thumbnails: [url] });
          } else {
              setErrorMsg("فشل توليد الصورة المصغرة");
          }
      } catch (e: any) {
          setErrorMsg(e.message);
      } finally {
          setIsGeneratingThumbnail(false);
      }
  };

  const downloadImage = (url: string, filename: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const urlToBase64 = async (url: string): Promise<string | null> => {
      try {
          const res = await fetch(url);
          const blob = await res.blob();
          return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
          });
      } catch { return null; }
  };

  const handleGenerateSingle = async (index: number, type: 'image' | 'video') => {
      setLoadingSceneIndex(index);
      setErrorMsg(null);
      const scene = localScenes[index];
      const source = scene.source || 'gemini';
      
      try {
          let url: string | null = null;
          let isFallback = false;
          
          if (type === 'video') {
              // Try Video Generation
              if (source === 'pexels') {
                  url = (await searchPexelsVideos(scene.prompt))[0];
                  if (!url) throw new Error("No video found on Pexels");
              } else if (source === 'pixabay') {
                  url = (await searchPixabayVideos(scene.prompt))[0];
                  if (!url) throw new Error("No video found on Pixabay");
              } else {
                  // Veo (or Fallback)
                  let imageBase64 = undefined;
                  if (scene.imageUrl) imageBase64 = await urlToBase64(scene.imageUrl) || undefined;
                  
                  const result = await generateVideo(scene.prompt, imageBase64);
                  url = result.url;
                  isFallback = result.isFallback;
              }
          } else {
              if (source === 'pexels') url = (await searchPexelsImages(scene.prompt))[0];
              else if (source === 'pixabay') url = (await searchPixabayImages(scene.prompt))[0];
              else if (source === 'google_search') url = (await searchImages(scene.prompt))[0];
              else url = await generateThumbnail(scene.prompt);
          }

          if (isFallback) {
              // If Veo failed, we keep the IMAGE but activate MOTION
              updateSceneAsset(index, { 
                  motion: 'zoom-in', // Default motion fallback
                  type: 'image'      // Keep as image so editor animates it via CSS
              });
              setErrorMsg("Veo غير متاح، تم تفعيل التحريك التلقائي (CSS Motion).");
          } else if (url) {
              updateSceneAsset(index, { 
                  imageUrl: url,
                  videoUrl: type === 'video' ? url : undefined,
                  type: type
              });
          } else {
              setErrorMsg(`فشل التوليد من ${source}`);
          }
      } catch (e: any) {
          setErrorMsg(e.message);
      } finally {
          setLoadingSceneIndex(null);
      }
  };

  // --- BATCH GENERATION LOGIC ---
  const handleBatchGenerate = async (targetType: 'image' | 'video') => {
      if (localScenes.length === 0) return;
      
      setIsBatchProcessing(true);
      onStartTask('VISUAL_BATCH', targetType === 'image' ? 'توليد جميع الصور' : 'تحريك جميع المشاهد');
      
      const newScenes = [...localScenes];
      let successCount = 0;

      for (let i = 0; i < newScenes.length; i++) {
          const scene = newScenes[i];
          // Skip if already correct
          if (targetType === 'image' && scene.imageUrl && scene.type === 'image') continue;
          if (targetType === 'video' && scene.videoUrl) continue;
          
          onUpdateTask(Math.round((i / newScenes.length) * 100), `جاري معالجة المشهد ${i+1}...`);
          
          try {
              let url: string | null = null;
              let isFallback = false;
              const source = scene.source || 'gemini';

              if (targetType === 'video') {
                  if (source === 'pexels') url = (await searchPexelsVideos(scene.prompt))[0];
                  else if (source === 'pixabay') url = (await searchPixabayVideos(scene.prompt))[0];
                  else {
                      let imageBase64 = undefined;
                      if (scene.imageUrl) imageBase64 = await urlToBase64(scene.imageUrl) || undefined;
                      const res = await generateVideo(scene.prompt, imageBase64);
                      url = res.url;
                      isFallback = res.isFallback;
                  }
              } else {
                  if (source === 'pexels') url = (await searchPexelsImages(scene.prompt))[0];
                  else if (source === 'pixabay') url = (await searchPixabayImages(scene.prompt))[0];
                  else if (source === 'google_search') url = (await searchImages(scene.prompt))[0];
                  else url = await generateThumbnail(scene.prompt);
              }

              if (isFallback) {
                  newScenes[i] = { ...scene, motion: 'zoom-in', type: 'image' };
                  successCount++;
              } else if (url) {
                  newScenes[i] = { 
                      ...scene, 
                      imageUrl: url, 
                      videoUrl: targetType === 'video' ? url : undefined, 
                      type: targetType 
                  };
                  successCount++;
              }
              
              setLocalScenes([...newScenes]); 
              onUpdateProject({ sceneAssets: newScenes });
              
              const isSearch = source === 'pexels' || source === 'pixabay' || source === 'google_search';
              const delay = isSearch ? 500 : (targetType === 'video' ? 5000 : 2000);
              await new Promise(r => setTimeout(r, delay));

          } catch (e) {
              console.error(`Failed scene ${i}`, e);
          }
      }

      onUpdateTask(100, `تمت العملية!`);
      onCompleteTask(true);
      setIsBatchProcessing(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col animate-fadeIn pb-32 relative">
      
      {/* THUMBNAIL GENERATOR SECTION */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-center shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-500 to-purple-600"></div>
          
          <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ImageIcon className="text-pink-500"/> الصورة المصغرة (Thumbnail)</h3>
              <p className="text-sm text-slate-400 mb-4">توليد صورة جذابة عالية الجودة (Clickbait) بناءً على عنوان الفيديو.</p>
              
              <div className="flex gap-3">
                  <button 
                      onClick={handleGenerateThumbnail}
                      disabled={isGeneratingThumbnail || !projectData.script}
                      className="bg-pink-600 hover:bg-pink-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-pink-900/20 transition disabled:opacity-50"
                  >
                      {isGeneratingThumbnail ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Wand2 className="w-5 h-5"/>}
                      توليد صورة مصغرة
                  </button>
                  {thumbnailUrl && (
                      <button 
                          onClick={() => downloadImage(thumbnailUrl!, 'thumbnail.png')}
                          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-600 transition"
                      >
                          <Download className="w-5 h-5"/> تحميل
                      </button>
                  )}
              </div>
          </div>

          <div className="w-full md:w-80 aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl relative group">
              {thumbnailUrl ? (
                  <img src={thumbnailUrl} className="w-full h-full object-cover" alt="Thumbnail" />
              ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">
                      <ImageIcon className="w-12 h-12 opacity-50"/>
                  </div>
              )}
              {isGeneratingThumbnail && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-pink-500 animate-spin"/>
                  </div>
              )}
          </div>
      </div>

      {/* Header & Batch Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Layers className="text-purple-500" /> مشاهد الفيديو
          </h2>
          <p className="text-slate-400 text-xs">تحكم كامل: Pexels, Pixabay, Gemini, Veo.</p>
        </div>
        
        <div className="flex gap-2 flex-wrap justify-center">
            <button 
                onClick={() => handleBatchGenerate('image')}
                disabled={isBatchProcessing}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition shadow-lg shadow-indigo-900/20"
            >
                {isBatchProcessing ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Layers className="w-3 h-3"/>} 
                توليد كل الصور
            </button>
            
            <button 
                onClick={() => handleBatchGenerate('video')}
                disabled={isBatchProcessing}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition shadow-lg shadow-purple-900/20"
            >
                {isBatchProcessing ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Film className="w-3 h-3"/>} 
                تحريك الكل (فيديو)
            </button>

            <div className="w-px h-8 bg-slate-700 mx-2 hidden md:block"></div>
            
            <button onClick={onNext} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition border border-slate-700 text-xs">
                التالي <ArrowLeft className="w-3 h-3" />
            </button>
        </div>
      </div>

      {errorMsg && <div className="bg-red-500/10 text-red-400 p-4 rounded mb-4 text-sm border border-red-500/20">{errorMsg}</div>}

      {/* Scenes Grid */}
      <div className="grid grid-cols-1 gap-6">
        {localScenes.map((scene, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col md:flex-row min-h-[300px] hover:border-slate-700 transition">
                {/* Preview Area */}
                <div className="w-full md:w-1/3 bg-black relative flex items-center justify-center border-l border-slate-800 group">
                    {loadingSceneIndex === idx ? (
                        <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                            <span className="text-xs text-purple-400 font-mono">Processing...</span>
                        </div>
                    ) : scene.imageUrl ? (
                        <>
                            {scene.type === 'video' ? (
                                <video src={scene.imageUrl} className="w-full h-full object-cover" autoPlay loop muted />
                            ) : (
                                <img src={scene.imageUrl} className="w-full h-full object-cover" alt={`Scene ${idx+1}`} />
                            )}
                            
                            {/* Download Button Overlay */}
                            <div className="absolute top-2 right-2 flex gap-2">
                                <button 
                                    onClick={() => downloadImage(scene.imageUrl!, `Scene_${idx+1}.${scene.type==='video'?'mp4':'png'}`)}
                                    className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg backdrop-blur border border-white/20 transition"
                                    title="Download"
                                >
                                    <Download className="w-3 h-3"/>
                                </button>
                                {scene.type === 'video' && <div className="bg-purple-600 px-2 py-1 rounded text-[8px] font-bold text-white flex items-center gap-1"><Video className="w-3 h-3"/> Veo</div>}
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-slate-700">
                            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <span className="text-xs">لا توجد ميديا</span>
                        </div>
                    )}
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-white border border-white/10">Scene {idx + 1}</div>
                </div>

                {/* Controls Area */}
                <div className="flex-1 p-6 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex justify-between items-start">
                            <h4 className="text-sm font-bold text-white">وصف المشهد (Prompt)</h4>
                            <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">مشهد {idx + 1}</span>
                        </div>
                        <textarea 
                            value={scene.prompt}
                            onChange={(e) => updateSceneAsset(idx, { prompt: e.target.value })}
                            className="w-full h-24 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 outline-none resize-none focus:border-indigo-500 transition"
                        />
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                            <label className="text-[10px] text-slate-500 block mb-1">المصدر</label>
                            <select 
                                value={scene.source || 'gemini'}
                                onChange={(e) => updateSceneAsset(idx, { source: e.target.value as AssetSource })}
                                className="w-full bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                            >
                                <option value="gemini" className="bg-slate-900">✨ Gemini AI</option>
                                <option value="google_search" className="bg-slate-900">🔎 Google Search</option>
                                {hasPexels && <option value="pexels" className="bg-slate-900">📸 Pexels Stock</option>}
                                {hasPixabay && <option value="pixabay" className="bg-slate-900">🖼️ Pixabay Stock</option>}
                            </select>
                        </div>
                    </div>
                    
                    {/* Individual Buttons */}
                    <div className="flex gap-3 mt-4 pt-4 border-t border-slate-800">
                        <button 
                            onClick={() => handleGenerateSingle(idx, 'image')}
                            disabled={loadingSceneIndex !== null}
                            className="flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow transition disabled:opacity-50"
                        >
                            {loadingSceneIndex === idx ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>} 
                            توليد صورة
                        </button>
                        <button 
                            onClick={() => handleGenerateSingle(idx, 'video')}
                            disabled={loadingSceneIndex !== null}
                            className="flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white shadow transition disabled:opacity-50"
                        >
                            {loadingSceneIndex === idx ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Video className="w-4 h-4"/>} 
                            تحريك (Veo)
                        </button>
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
