
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Type, 
  FileText, 
  List, 
  Copy, 
  RefreshCw, 
  Save,
  PlayCircle,
  Globe,
  Clock,
  BrainCircuit,
  Link,
  Search,
  Download,
  Lightbulb,
  TrendingUp,
  ArrowRight,
  Flame,
  Flag,
  CheckCircle,
  Eye
} from 'lucide-react';
import { generateScript, analyzeTopicDuration, analyzeTrends, analyzeRegionalTrends } from '../services/geminiService';
import { ScriptData, VideoDuration, GlobalTask, ProjectState } from '../types';

interface ContentEngineProps {
  projectData: ProjectState;
  onUpdateProject: (data: Partial<ProjectState>) => void;
  onSaveScript: (script: ScriptData) => void;
  // Task Props
  onStartTask: (type: GlobalTask['type'], title: string) => void;
  onUpdateTask: (progress: number, log?: string) => void;
  onCompleteTask: (success: boolean) => void;
}

export const ContentEngine: React.FC<ContentEngineProps> = ({ 
    projectData,
    onUpdateProject,
    onSaveScript,
    onStartTask,
    onUpdateTask,
    onCompleteTask
}) => {
  // Local state initialized from projectData for immediate feedback
  const [topic, setTopic] = useState(projectData.topic || '');
  const [tone, setTone] = useState(projectData.tone || 'درامي');
  const [language, setLanguage] = useState<'ar' | 'en'>(projectData.language || 'ar');
  const [duration, setDuration] = useState<VideoDuration>(projectData.duration || 'medium');
  const [customDuration, setCustomDuration] = useState<number | undefined>(projectData.customDuration);
  const [generatedContent, setGeneratedContent] = useState<ScriptData | null>(projectData.script);
  
  // Duration Analysis State
  const [isAnalyzingDuration, setIsAnalyzingDuration] = useState(false);
  const [suggestedDuration, setSuggestedDuration] = useState<{recommended: VideoDuration, reason: string} | null>(null);

  // Trend Scout State
  const [trendQuery, setTrendQuery] = useState('');
  const [suggestedTrends, setSuggestedTrends] = useState<any[]>([]);
  const [isSearchingTrends, setIsSearchingTrends] = useState(false);
  const [activeTrendTab, setActiveTrendTab] = useState<'search' | 'arab' | 'usa'>('arab');

  // AI Advisor State
  const [advice, setAdvice] = useState<string[]>([]);

  // Sync from props
  useEffect(() => {
     if(projectData.topic !== topic) setTopic(projectData.topic);
     if(projectData.tone !== tone) setTone(projectData.tone || 'درامي');
     if(projectData.language !== language) setLanguage(projectData.language);
     if(projectData.duration !== duration) setDuration(projectData.duration);
     if(projectData.customDuration !== customDuration) setCustomDuration(projectData.customDuration);
     if(projectData.script !== generatedContent) setGeneratedContent(projectData.script);
  }, [projectData]);

  // Real-time Persistence
  useEffect(() => {
     const timeoutId = setTimeout(() => {
         onUpdateProject({
             topic,
             tone,
             language,
             duration,
             customDuration
         });
     }, 500); 
     return () => clearTimeout(timeoutId);
  }, [topic, tone, language, duration, customDuration]);

  // Real-time AI Advisor Logic
  useEffect(() => {
      const newAdvice: string[] = [];
      if (!topic) {
          newAdvice.push("ابدأ بكتابة موضوع مثير للاهتمام لتفعيل الاقتراحات.");
      } else if (topic.length < 10) {
          newAdvice.push("حاول إضافة المزيد من التفاصيل للموضوع للحصول على نتائج أدق.");
      }

      if (generatedContent) {
           if (generatedContent.scenes.length < 5) newAdvice.push("عدد المشاهد قليل نسبياً. قد يكون الفيديو قصيراً جداً.");
           if (!generatedContent.hook.includes("?")) newAdvice.push("حاول جعل المقدمة (Hook) بصيغة سؤال لإثارة الفضول.");
           if (duration === 'long' && generatedContent.scenes.length < 15) newAdvice.push("المدة المختارة طويلة لكن عدد المشاهد قليل، قد يمل المشاهد.");
      }

      setAdvice(newAdvice);
  }, [topic, generatedContent, duration]);

  // Initial Load of Regional Trends
  useEffect(() => {
      if (activeTrendTab === 'arab' && suggestedTrends.length === 0) {
          handleRegionalTrends('arab');
      }
  }, [activeTrendTab]);

  const handleAnalyzeDuration = async () => {
      if (!topic) return;
      setIsAnalyzingDuration(true);
      const result = await analyzeTopicDuration(topic, language);
      setSuggestedDuration(result);
      setDuration(result.recommended);
      setCustomDuration(undefined); // Reset custom if using suggestion
      setIsAnalyzingDuration(false);
  };

  const handleSearchTrends = async () => {
      if (!trendQuery) return;
      setIsSearchingTrends(true);
      try {
          const res = await analyzeTrends(trendQuery);
          const parsed = JSON.parse(res);
          setSuggestedTrends(parsed);
      } catch (e) {
          console.error(e);
      } finally {
          setIsSearchingTrends(false);
      }
  };

  const handleRegionalTrends = async (region: 'arab' | 'usa') => {
      setIsSearchingTrends(true);
      setSuggestedTrends([]); // clear current
      try {
          const results = await analyzeRegionalTrends(region);
          setSuggestedTrends(results);
      } catch(e) {
          console.error(e);
      } finally {
          setIsSearchingTrends(false);
      }
  };

  const handleGenerate = async () => {
    if (!topic) return;
    
    // Start Global Task
    onStartTask('CONTENT_GEN', `توليد سيناريو: ${topic.substring(0, 20)}...`);
    onUpdateTask(10, "بدء جلسة Gemini AI وتحليل الموضوع...");

    try {
      setTimeout(() => onUpdateTask(30, `البحث عن مصادر موثوقة (${language === 'ar' ? 'العربية' : 'الإنجليزية'})...`), 1500);
      setTimeout(() => onUpdateTask(50, "هيكلة القصة وتقسيم المشاهد..."), 3000);
      setTimeout(() => onUpdateTask(70, "كتابة الحوار واقتراح المؤثرات البصرية..."), 4500);

      // Actual API Call (Pass Custom Duration if set)
      const result = await generateScript(topic, tone, language, duration, customDuration);
      const parsed = JSON.parse(result);
      
      onUpdateTask(90, "مراجعة النصوص وتحسين SEO...");
      onUpdateTask(100, "تم الانتهاء بنجاح!");
      
      const contentWithTone = { ...parsed, tone };
      setGeneratedContent(contentWithTone);
      onUpdateProject({ script: contentWithTone });
      onCompleteTask(true);

    } catch (error) {
      console.error("Gen Error", error);
      onUpdateTask(100, "حدث خطأ أثناء التوليد. جاري تفعيل وضع الاستعادة...");
      onCompleteTask(false);
    }
  };

  const handleExportToVisual = () => {
    if (generatedContent) {
        onSaveScript({ ...generatedContent, tone });
    }
  };

  const handleDownloadTxt = () => {
      if (!generatedContent) return;
      const text = `
Title: ${generatedContent.title}
Hook: ${generatedContent.hook}

Scenes:
${generatedContent.scenes.map((s, i) => `[${s.timestamp}] Scene ${i+1}: ${s.narration || s.description} (Visual: ${s.visualCue})`).join('\n')}

Body:
${generatedContent.body}
      `.trim();
      
      const element = document.createElement("a");
      const file = new Blob([text], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `${generatedContent.title}.txt`;
      document.body.appendChild(element);
      element.click();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn relative pb-32">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Sparkles className="text-indigo-500" />
            محرك توليد المحتوى المتقدم
          </h2>
          <p className="text-slate-400">توليد سيناريوهات، عناوين، ووصف محسن بالاعتماد على البحث والمصادر.</p>
        </div>
        
        <div className="flex items-center gap-4">
             <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'ar' | 'en')}
                    className="bg-transparent text-white font-bold outline-none cursor-pointer text-sm"
                  >
                      <option value="ar" className="bg-slate-900">العربية</option>
                      <option value="en" className="bg-slate-900">English</option>
                  </select>
             </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-4">
            
            {/* Trend Scout Box (UPDATED) */}
            <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-4 rounded-xl border border-indigo-500/20 mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        اكتشاف الترندات
                    </h3>
                    <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800">
                        <button 
                            onClick={() => { setActiveTrendTab('arab'); handleRegionalTrends('arab'); }} 
                            className={`p-1.5 rounded text-[10px] font-bold ${activeTrendTab === 'arab' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`} 
                            title="ترندات العرب"
                        >🔥 عرب</button>
                        <button 
                            onClick={() => { setActiveTrendTab('usa'); handleRegionalTrends('usa'); }}
                            className={`p-1.5 rounded text-[10px] font-bold ${activeTrendTab === 'usa' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                            title="USA Trends"
                        >🇺🇸 USA</button>
                        <button 
                            onClick={() => setActiveTrendTab('search')}
                            className={`p-1.5 rounded text-[10px] font-bold ${activeTrendTab === 'search' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                        ><Search className="w-3 h-3"/></button>
                    </div>
                </div>

                {activeTrendTab === 'search' && (
                    <div className="flex gap-2 mb-2">
                        <input 
                            type="text" 
                            value={trendQuery}
                            onChange={(e) => setTrendQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchTrends()}
                            placeholder="كلمة مفتاحية..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                        <button 
                            onClick={handleSearchTrends}
                            disabled={!trendQuery || isSearchingTrends}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded-lg disabled:opacity-50"
                        >
                            {isSearchingTrends ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
                        </button>
                    </div>
                )}
                
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {isSearchingTrends ? (
                         <div className="flex items-center justify-center py-4 text-xs text-slate-500"><RefreshCw className="w-3 h-3 animate-spin mr-1"/> جاري البحث في جوجل...</div>
                    ) : suggestedTrends.length > 0 ? (
                        suggestedTrends.map((t, idx) => (
                            <button 
                                key={idx}
                                onClick={() => setTopic(t.suggestion)}
                                className="w-full text-right text-xs text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded transition flex justify-between group"
                            >
                                <span className="truncate">{t.topic}</span>
                                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                            </button>
                        ))
                    ) : (
                        <div className="text-center text-[10px] text-slate-600 py-2">اختر منطقة لجلب الترندات</div>
                    )}
                </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">إعدادات القصة</h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">موضوع الفيديو</label>
                <div className="relative">
                    <textarea 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onBlur={() => { if(topic && !suggestedDuration) handleAnalyzeDuration() }} 
                    placeholder="عن ماذا تدور القصة؟"
                    className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none transition"
                    />
                    {/* Always visible suggest button if topic exists */}
                    {topic.length > 3 && (
                         <button 
                            onClick={handleAnalyzeDuration}
                            className="absolute bottom-2 left-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1 transition z-10"
                         >
                             {isAnalyzingDuration ? <RefreshCw className="w-3 h-3 animate-spin"/> : <BrainCircuit className="w-3 h-3" />}
                             اقترح المدة
                         </button>
                    )}
                </div>
              </div>

              {/* Suggestion Box */}
              {suggestedDuration && (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-xl flex items-start gap-2 animate-fadeIn">
                      <BrainCircuit className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                          <p className="text-xs font-bold text-indigo-300 mb-1">اقتراح الذكاء الاصطناعي:</p>
                          <p className="text-xs text-slate-300 mb-1">"{suggestedDuration.reason}"</p>
                          <p className="text-xs text-indigo-400 font-bold">ينصح بـ: {suggestedDuration.recommended === 'short' ? 'قصير' : suggestedDuration.recommended === 'medium' ? 'متوسط' : 'طويل'}</p>
                      </div>
                  </div>
              )}

              {/* AI Advisor Panel */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2 text-yellow-500">
                      <Lightbulb className="w-4 h-4" />
                      <span className="text-sm font-bold">المستشار الذكي</span>
                  </div>
                  {advice.length > 0 ? (
                      <ul className="space-y-2">
                          {advice.map((tip, i) => (
                              <li key={i} className="text-xs text-slate-400 flex gap-2">
                                  <span className="text-yellow-500/50">•</span> {tip}
                              </li>
                          ))}
                      </ul>
                  ) : (
                      <p className="text-xs text-slate-600">كل شيء يبدو ممتازاً حتى الآن.</p>
                  )}
              </div>

              {/* Duration Selection (UPDATED with Custom Input) */}
              <div>
                 <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    مدة الفيديو
                 </label>
                 <div className="flex flex-col gap-2">
                     <div className="grid grid-cols-3 gap-2">
                        <button 
                            onClick={() => { setDuration('short'); setCustomDuration(undefined); }}
                            className={`p-2 rounded-lg text-xs font-bold border transition flex flex-col items-center gap-1 ${duration === 'short' && !customDuration ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-indigo-500/50'}`}
                        >
                            <span>قصير</span>
                            <span className="opacity-70 font-normal text-[10px]">5-10 دقيقة</span>
                        </button>
                        <button 
                            onClick={() => { setDuration('medium'); setCustomDuration(undefined); }}
                            className={`p-2 rounded-lg text-xs font-bold border transition flex flex-col items-center gap-1 ${duration === 'medium' && !customDuration ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-indigo-500/50'}`}
                        >
                            <span>متوسط</span>
                            <span className="opacity-70 font-normal text-[10px]">10-15 دقيقة</span>
                        </button>
                        <button 
                            onClick={() => { setDuration('long'); setCustomDuration(undefined); }}
                            className={`p-2 rounded-lg text-xs font-bold border transition flex flex-col items-center gap-1 ${duration === 'long' && !customDuration ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-indigo-500/50'}`}
                        >
                            <span>طويل</span>
                            <span className="opacity-70 font-normal text-[10px]">15-18 دقيقة</span>
                        </button>
                     </div>
                     
                     {/* Custom Duration Input */}
                     <div className={`flex items-center bg-slate-950 border rounded-lg px-3 py-2 transition ${customDuration ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-slate-800'}`}>
                         <div className="flex-1 text-xs text-slate-400">مدة مخصصة:</div>
                         <input 
                            type="number" 
                            min="1" 
                            max="60"
                            placeholder="__"
                            value={customDuration || ''}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setCustomDuration(isNaN(val) ? undefined : val);
                            }}
                            className="w-16 bg-transparent text-center font-bold text-white outline-none border-b border-slate-700 focus:border-indigo-500 mx-2"
                         />
                         <span className="text-xs text-slate-500">دقيقة</span>
                         {customDuration && <CheckCircle className="w-4 h-4 text-emerald-500 ml-2 animate-bounceIn"/>}
                     </div>
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">نبرة السرد</label>
                <div className="grid grid-cols-2 gap-2">
                  {['درامي', 'تحقيقي', 'غامض', 'تعليمي', 'تحفيزي', 'ساخر'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                        tone === t 
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/50' 
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!topic}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
                  !topic
                    ? 'bg-indigo-600/50 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-900/30 border border-indigo-500/50'
                }`}
              >
                  <Sparkles className="w-5 h-5" />
                  توليد السيناريو
              </button>
            </div>
          </div>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-8 space-y-6">
          {!generatedContent ? (
            <div className="h-full min-h-[400px] bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">في انتظار البيانات...</h3>
              <p className="text-slate-500 max-w-sm">أدخل الموضوع، اختر اللغة والمدة، وسيقوم الذكاء الاصطناعي بالبحث، الكتابة، وتجهيز العناوين. يتم حفظ عملك تلقائياً.</p>
            </div>
          ) : (
            <>
              {/* Smart Titles */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-white">
                        <Type className="w-5 h-5 text-purple-500" />
                        <h3 className="font-bold">تحليل العناوين</h3>
                    </div>
                </div>
                <div className="space-y-3">
                  {generatedContent.alternatives.map((alt, idx) => (
                    <div key={idx} className="flex gap-4 items-center p-3 bg-slate-950 border border-slate-800 rounded-xl group hover:border-indigo-500/50 transition cursor-pointer">
                       <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center border ${alt.score >= 90 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'}`}>
                           <span className="text-xs font-bold">CTR</span>
                           <span className="font-black text-sm">{alt.score}%</span>
                       </div>
                       <p className="text-slate-200 flex-1 text-sm font-medium group-hover:text-white transition">{alt.title}</p>
                       <button className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition"><Copy className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sources Section - NEW */}
              {generatedContent.sources && generatedContent.sources.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <div className="flex items-center gap-2 text-white mb-4">
                          <Search className="w-5 h-5 text-blue-400" />
                          <h3 className="font-bold">المصادر التي تم الاستناد إليها</h3>
                      </div>
                      <div className="space-y-2">
                          {generatedContent.sources.map((source, i) => (
                              <a key={i} href={source.uri} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:underline p-2 bg-slate-950 rounded border border-slate-800">
                                  <Link className="w-3 h-3" />
                                  {source.title || source.uri}
                              </a>
                          ))}
                      </div>
                  </div>
              )}

              {/* Script & Structure */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-2 text-white">
                    <List className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-bold">
                        الهيكل السردي 
                        <span className="text-slate-500 text-xs ml-2">
                            ({customDuration ? `${customDuration} دقيقة` : duration === 'short' ? 'قصير' : duration === 'medium' ? 'متوسط' : 'طويل'})
                        </span>
                    </h3>
                  </div>
                  <div className="flex gap-2">
                      <button 
                        onClick={handleDownloadTxt}
                        className="flex items-center gap-2 text-sm bg-slate-800 text-white px-3 py-2 rounded-lg hover:bg-slate-700 transition font-bold"
                      >
                        <Download className="w-4 h-4" /> 
                        تحميل
                      </button>
                      <button 
                        onClick={handleExportToVisual}
                        className="flex items-center gap-2 text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20 font-bold animate-pulse"
                      >
                        <Save className="w-4 h-4" /> 
                        تصدير للاستوديو المرئي
                      </button>
                  </div>
                </div>
                
                <div className="space-y-4 relative">
                  <div className="absolute top-4 bottom-4 right-[19px] w-0.5 bg-slate-800 z-0"></div>

                  {generatedContent.scenes && generatedContent.scenes.map((scene, i) => (
                     <div key={i} className="relative z-10 flex gap-4">
                         <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono text-indigo-400 shrink-0 shadow-md">
                             {scene.timestamp}
                         </div>
                         <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-slate-600 transition">
                             <div className="flex justify-between mb-2">
                                <h4 className="text-sm font-bold text-white">{scene.narration || scene.description}</h4>
                                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">مشهد {i + 1}</span>
                             </div>
                             
                             <div className="flex gap-2 items-center p-2 bg-slate-900 rounded-lg border border-slate-800/50 mt-2">
                                <Eye className="w-3 h-3 text-emerald-500" />
                                <p className="text-xs text-slate-400 italic">Visual Cue: {scene.visualCue}</p>
                             </div>
                         </div>
                     </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
