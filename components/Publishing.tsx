
import React, { useState } from 'react';
import { UploadCloud, Calendar, Globe, CheckCircle, AlertCircle, Hash, Download, FileText, Image as ImageIcon } from 'lucide-react';

export const Publishing: React.FC = () => {
  const [projectState, setProjectState] = useState(() => {
      const raw = localStorage.getItem('autoTube_projectState');
      return raw ? JSON.parse(raw) : null;
  });

  if (!projectState) return <div className="p-10 text-center text-slate-500">لا يوجد مشروع</div>;

  const script = projectState.script || {};
  // Use scene assets as source of thumbnails if "thumbnails" array is empty
  const thumbnail = projectState.thumbnails?.[0] || projectState.sceneAssets?.[0]?.imageUrl || null;

  const handleDownloadPackage = () => {
      const report = `
# Project Report
Title: ${script.title || 'Untitled'}
Date: ${new Date().toLocaleDateString()}
Description:
${script.description || 'No description'}

## Tags
${(script.hashtags || []).join(', ')}

## Script Body
Hook: ${script.hook}

Scenes:
${(script.scenes || []).map((s: any, i: number) => `${i+1}. [${s.timestamp}] ${s.description}`).join('\n')}

Body:
${script.body || ''}
      `.trim();

      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project_${Date.now()}.txt`;
      a.click();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn">
       <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <UploadCloud className="text-sky-500" />
            منصة النشر (Publishing Hub)
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
                              {(script.hashtags || []).length === 0 && <span className="text-slate-600 text-sm">لا توجد وسوم</span>}
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <div className="space-y-6">
               {/* Thumbnail Preview */}
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
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <button className="bg-white text-black px-3 py-1 rounded text-xs font-bold">تغيير</button>
                      </div>
                  </div>
              </div>

              {/* Actions */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <button 
                    onClick={handleDownloadPackage}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition border border-slate-700 mb-4"
                  >
                      <Download className="w-5 h-5 text-green-400" />
                      تحميل تقرير المشروع (Manifest)
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
