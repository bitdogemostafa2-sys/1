
import React, { useState } from 'react';
import { UploadCloud, Download, Image as ImageIcon, FolderArchive } from 'lucide-react';

export const Publishing: React.FC = () => {
  const [projectState, setProjectState] = useState(() => {
      const raw = localStorage.getItem('autoTube_projectState');
      return raw ? JSON.parse(raw) : null;
  });

  if (!projectState) return <div className="p-10 text-center text-slate-500">لا يوجد مشروع</div>;

  const script = projectState.script || {};
  const thumbnail = projectState.thumbnails?.[0] || projectState.sceneAssets?.[0]?.imageUrl || null;

  const downloadAsset = (url: string, filename: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const handleDownloadAllAssets = async () => {
      if(!confirm("سيقوم المتصفح بتحميل عدة ملفات (صور، صوتيات، سكريبت). هل تريد المتابعة؟")) return;

      // 1. Download Manifest
      const report = `Title: ${script.title}\nDescription: ${script.description}\n\nScenes:\n${(script.scenes || []).map((s: any, i: number) => `${i+1}. ${s.description}`).join('\n')}`;
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      downloadAsset(URL.createObjectURL(blob), 'Project_Manifest.txt');

      // 2. Download Thumbnail
      if(thumbnail) downloadAsset(thumbnail, 'Thumbnail.png');

      // 3. Download Scene Assets (Images)
      if(projectState.sceneAssets) {
          projectState.sceneAssets.forEach((scene: any, i: number) => {
              if(scene.imageUrl) {
                  // Small delay to prevent browser blocking
                  setTimeout(() => downloadAsset(scene.imageUrl, `Scene_${i+1}_Visual.png`), i * 500);
              }
          });
      }

      // 4. Download Audio Tracks
      if(projectState.audioTracks) {
          projectState.audioTracks.forEach((track: any, i: number) => {
              if(track.url) {
                  setTimeout(() => downloadAsset(track.url, `Audio_${track.type}_${i+1}.wav`), (i * 500) + 2000);
              }
          });
      }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn">
       <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <UploadCloud className="text-sky-500" /> منصة النشر (Publishing Hub)
          </h2>
          <p className="text-slate-400">البيانات النهائية جاهزة للنشر على يوتيوب.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">بيانات الفيديو (Metadata)</h3>
                  <div className="space-y-4">
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <label className="text-xs text-slate-500 block mb-2 font-bold uppercase">العنوان النهائي (من السكريبت)</label>
                          <input type="text" readOnly value={script.title || "لم يتم توليد عنوان"} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-bold outline-none focus:border-sky-500" />
                      </div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <label className="text-xs text-slate-500 block mb-2 font-bold uppercase">الوصف (SEO Optimized)</label>
                          <textarea readOnly value={script.description || "لم يتم توليد وصف"} className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 outline-none focus:border-sky-500 resize-none custom-scrollbar" />
                      </div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <label className="text-xs text-slate-500 block mb-2 font-bold uppercase">الكلمات المفتاحية</label>
                          <div className="flex flex-wrap gap-2">
                              {(script.hashtags || []).map((tag: string, i: number) => (
                                  <span key={i} className="bg-sky-900/20 text-sky-400 px-2 py-1 rounded text-xs border border-sky-500/20">{tag}</span>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <div className="space-y-6">
               <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> الصورة المصغرة</h3>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 relative group">
                      {thumbnail ? (
                          <img src={thumbnail} className="w-full h-full object-cover" alt="Thumbnail" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <span className="text-xs">لم يتم اختيار صورة</span>
                          </div>
                      )}
                  </div>
                  {thumbnail && (
                      <button onClick={() => downloadAsset(thumbnail, 'Thumbnail.png')} className="w-full mt-4 bg-slate-800 text-white px-3 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-700">
                          <Download className="w-3 h-3"/> تحميل الصورة
                      </button>
                  )}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <button 
                    onClick={handleDownloadAllAssets}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition border border-slate-700 mb-4"
                  >
                      <FolderArchive className="w-5 h-5 text-yellow-400" />
                      تحميل جميع الملفات (Assets)
                  </button>
                  <button className="w-full bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-sky-900/20 transition">
                      نشر الفيديو الآن
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};
