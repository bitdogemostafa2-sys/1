
import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  Search, 
  TrendingUp, 
  ArrowUp,
  Target,
  Lightbulb,
  Users,
  Globe,
  RefreshCw
} from 'lucide-react';
import { analyzeTrends } from '../services/geminiService';
import { Trend, Channel } from '../types';

interface StrategyHubProps {
  onAdoptTopic: (topic: string, language: 'ar' | 'en') => void;
  activeChannel?: Channel;
}

export const StrategyHub: React.FC<StrategyHubProps> = ({ onAdoptTopic, activeChannel }) => {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'trends' | 'competitors'>('trends');
  const [trends, setTrends] = useState<Trend[]>([]);
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');

  // Auto-fill Niche based on Channel Name/Data if available
  useEffect(() => {
      if (activeChannel && !niche) {
          // Simple heuristic: Use the channel name as a starting point for niche
          setNiche(activeChannel.name);
      }
  }, [activeChannel]);

  const handleAnalyze = async () => {
    if (!niche) return;
    setLoading(true);
    setTrends([]);
    try {
      const res = await analyzeTrends(niche);
      setTrends(JSON.parse(res));
    } catch (error) {
       console.error(error);
       // Error is handled in service with fallback, but safe to clear loading
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                <BrainCircuit className="text-emerald-500" />
                الاستراتيجية الذكية (Google Trends)
            </h2>
            <p className="text-slate-400">تحليل المنافسين والترندات باستخدام بحث جوجل المباشر لاكتشاف الفرص الذهبية.</p>
          </div>
          
          <div className="flex gap-4 items-center">
               <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center">
                  <Globe className="w-4 h-4 text-slate-400 mx-2" />
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'ar' | 'en')}
                    className="bg-transparent text-white text-sm font-bold p-2 outline-none cursor-pointer"
                  >
                      <option value="ar" className="bg-slate-900">اللغة: العربية</option>
                      <option value="en" className="bg-slate-900">Language: English</option>
                  </select>
               </div>

              <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex">
                <button 
                    onClick={() => setActiveTab('trends')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'trends' ? 'bg-slate-800 text-white shadow border border-slate-700' : 'text-slate-500 hover:text-white'}`}
                >
                    الترندات
                </button>
                <button 
                    onClick={() => setActiveTab('competitors')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'competitors' ? 'bg-slate-800 text-white shadow border border-slate-700' : 'text-slate-500 hover:text-white'}`}
                >
                    المنافسين
                </button>
              </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-slate-900 border border-slate-800 p-2 rounded-2xl flex gap-2 mb-8 shadow-xl">
            <input 
                type="text" 
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="أدخل مجال قناتك للبحث في جوجل (مثال: تقنية، جريمة، طبخ)..."
                className="flex-1 bg-transparent border-none outline-none text-white px-4 placeholder-slate-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button 
                onClick={handleAnalyze}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? <><RefreshCw className="w-5 h-5 animate-spin"/> جاري البحث في الويب...</> : <><Search className="w-5 h-5" /> تحليل السوق</>}
            </button>
        </div>

        {/* Content Area */}
        {activeTab === 'trends' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trends.map((trend, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 transition duration-300 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-slate-950 p-3 rounded-xl text-emerald-400 shadow-inner">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                                {trend.relevance}% توافق
                            </span>
                        </div>
                        
                        <h3 className="text-xl font-bold text-white mb-2">{trend.topic}</h3>
                        
                        <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                            <ArrowUp className="w-4 h-4 text-emerald-500" />
                            نمو: <span className="text-white">{trend.growth}</span>
                        </div>
                        
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 group-hover:border-emerald-500/20 transition">
                            <div className="flex items-center gap-2 text-xs text-indigo-400 mb-1">
                                <Lightbulb className="w-3 h-3" />
                                فكرة فيديو مقترحة
                            </div>
                            <p className="text-sm text-slate-200 font-medium leading-relaxed">
                                "{trend.suggestion}"
                            </p>
                        </div>
                        
                        <button 
                            onClick={() => onAdoptTopic(trend.suggestion, language)}
                            className="w-full mt-4 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 py-2 rounded-lg text-sm transition flex items-center justify-center gap-2 border border-slate-700 hover:border-emerald-500"
                        >
                            <Target className="w-4 h-4" />
                            اعتماد وبدء المشروع
                        </button>
                    </div>
                ))}
                {trends.length === 0 && !loading && (
                     <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
                        <Target className="w-16 h-16 mb-4 text-slate-600" />
                        <p className="text-xl text-slate-400">ابدأ البحث لاكتشاف أفكار فيروسية من محرك بحث جوجل</p>
                        {activeChannel && (
                            <p className="text-sm text-emerald-500 mt-2">نصيحة: تم الكشف عن القناة "{activeChannel.name}"، جرب البحث عن مواضيع مشابهة.</p>
                        )}
                    </div>
                )}
            </div>
        ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex gap-4 items-start">
                         <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                             <Users className="w-8 h-8 text-slate-600" />
                         </div>
                         <div className="flex-1">
                             <div className="flex justify-between items-start">
                                 <h3 className="text-white font-bold text-lg">منافس #{i}</h3>
                                 <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">1.2M مشترك</span>
                             </div>
                             <p className="text-sm text-slate-400 mt-1 mb-3">نشر 3 فيديوهات هذا الأسبوع عن نفس الموضوع.</p>
                             <div className="flex gap-2">
                                 <div className="text-xs bg-emerald-900/20 text-emerald-400 px-2 py-1 rounded border border-emerald-900/30">فجوة محتوى</div>
                             </div>
                         </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};
