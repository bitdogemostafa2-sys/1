
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Eye, 
  Video, 
  Youtube,
  PlusCircle,
  Activity,
  Info,
  Globe,
  Calendar,
  Radio,
  Zap
} from 'lucide-react';
import { Channel } from '../types';

interface DashboardProps {
    onNewVideo: () => void;
    channels: Channel[];
    onLinkChannel: () => void;
    onUpdateChannel?: (id: string, updates: Partial<Channel>) => void; // New Prop for Live Updates
}

export const Dashboard: React.FC<DashboardProps> = ({ onNewVideo, channels = [], onLinkChannel, onUpdateChannel }) => {
  const activeChannels = channels.filter(c => c.isActive);
  const hasChannels = activeChannels.length > 0;
  const channel = hasChannels ? activeChannels[0] : null;

  // Live Polling State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [growthAlert, setGrowthAlert] = useState<string | null>(null);

  // STRICT MODE: Real Data Only
  const totalViews = channel ? channel.views : '---';
  const totalSubs = channel ? channel.subscribers : '---';
  const totalVideos = channel ? channel.videoCount || '---' : '---';
  const mainChannelName = channel ? channel.name : 'لا توجد قناة';

  // Live Polling Effect
  useEffect(() => {
      let interval: any;
      if (isLiveMode && channel && channel.isVerified && onUpdateChannel) {
          interval = setInterval(async () => {
              try {
                  const key = localStorage.getItem('youtube_data_api_key');
                  if (!key) return;

                  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channel.id}&key=${key}`);
                  const data = await res.json();
                  if (data.items && data.items.length > 0) {
                      const stats = data.items[0].statistics;
                      const newSubs = formatAvg(stats.subscriberCount); // Keep format consistent
                      const newViews = formatAvg(stats.viewCount);

                      // Check for growth
                      if (stats.subscriberCount > (parseInt(channel.subscribers.replace(/[^0-9]/g, '')) || 0)) {
                           setGrowthAlert(`مبروك! زاد عدد المشتركين: ${newSubs}`);
                           setTimeout(() => setGrowthAlert(null), 5000);
                      }

                      // UPDATE GLOBAL STATE (Persists to LocalStorage via App.tsx)
                      onUpdateChannel(channel.id, {
                          subscribers: newSubs,
                          views: newViews,
                          videoCount: stats.videoCount
                      });
                      setLastCheck(new Date());
                  }
              } catch (e) {
                  console.error("Live Poll Error", e);
              }
          }, 30000); // Check every 30s
      }
      return () => clearInterval(interval);
  }, [isLiveMode, channel, onUpdateChannel]);

  const parseMetric = (val: string) => {
      if(!val || val === '---') return 0;
      let num = parseFloat(val);
      if (val.toUpperCase().includes('M')) num *= 1000000;
      else if (val.toUpperCase().includes('K')) num *= 1000;
      return num;
  };
  
  const v = parseMetric(totalViews);
  const vidCount = parseMetric(totalVideos);
  const avgViews = (v > 0 && vidCount > 0) ? (v / vidCount).toFixed(0) : '---';

  const formatAvg = (val: string | number) => {
      if(val === '---' || val === undefined) return '---';
      const num = Number(val);
      if(isNaN(num)) return val.toString();
      if(num >= 1000000) return (num/1000000).toFixed(1) + 'M';
      if(num >= 1000) return (num/1000).toFixed(1) + 'K';
      return num.toString();
  };

  const formatDate = (isoString?: string) => {
      if(!isoString) return '---';
      try {
          return new Date(isoString).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch {
          return isoString;
      }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto relative">
      {/* Growth Alert Overlay */}
      {growthAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl animate-bounceIn flex items-center gap-3 border border-emerald-400">
              <TrendingUp className="w-8 h-8 text-white" />
              <span className="text-xl font-bold">{growthAlert}</span>
          </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">نظرة عامة (Strict Mode)</h2>
          {hasChannels ? (
            <div className="flex items-center gap-2">
                <img src={channel?.avatar} alt="" className="w-6 h-6 rounded-full" />
                <p className="text-slate-400">قناة <span className="text-white font-bold">{mainChannelName}</span></p>
                {channel?.isVerified && <div className="bg-sky-500/20 text-sky-400 text-[10px] px-2 py-0.5 rounded-full border border-sky-500/30">Verified</div>}
            </div>
          ) : (
            <p className="text-slate-400">يرجى ربط قناة يوتيوب من الإعدادات لعرض البيانات الحقيقية.</p>
          )}
        </div>
        
        <div className="flex gap-3 items-center">
          {hasChannels && channel?.isVerified && (
              <button 
                onClick={() => setIsLiveMode(!isLiveMode)}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition border ${
                    isLiveMode 
                    ? 'bg-red-600/20 border-red-500 text-red-500 animate-pulse' 
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                  {isLiveMode ? <Radio className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  {isLiveMode ? 'بث مباشر (Live)' : 'تفعيل البث المباشر'}
              </button>
          )}

          <button 
            onClick={onNewVideo}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-indigo-900/20 text-sm font-medium transition flex items-center gap-2"
          >
            <Video className="w-4 h-4" />
            فيديو جديد
          </button>
        </div>
      </div>

      {!hasChannels ? (
          <div className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
                  <Youtube className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">لم يتم ربط أي قناة</h3>
              <p className="text-slate-400 mb-6 max-w-md">قم بربط قناتك (يتطلب API Key للبيانات الحقيقية) لعرض الإحصائيات الفعلية.</p>
              
              <button 
                onClick={onLinkChannel}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-red-900/20"
              >
                  <PlusCircle className="w-4 h-4" /> ربط القناة الآن
              </button>
          </div>
      ) : (
        <>
            {/* Live Stats Status */}
            {isLiveMode && (
                <div className="flex justify-end text-[10px] text-slate-500 gap-2 mb-2">
                    <span className="flex items-center gap-1 text-red-500"><Radio className="w-3 h-3 animate-ping"/> Live Connected</span>
                    {lastCheck && <span>Last Update: {lastCheck.toLocaleTimeString()}</span>}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                { label: 'إجمالي المشاهدات', value: totalViews, icon: Eye, color: 'text-blue-500' },
                { label: 'المشتركين', value: totalSubs, icon: Users, color: 'text-purple-500' },
                { label: 'إجمالي الفيديوهات', value: totalVideos, icon: Video, color: 'text-orange-500' },
                { label: 'متوسط المشاهدات', value: formatAvg(avgViews), icon: Activity, color: 'text-emerald-500' },
                ].map((stat, idx) => (
                <div key={idx} className="bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 rounded-2xl hover:bg-slate-800 transition group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className={`p-3 rounded-xl bg-slate-900/50 ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-1 relative z-10">{stat.value}</h3>
                    <p className="text-slate-400 text-sm relative z-10">{stat.label}</p>
                    {isLiveMode && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>}
                </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Channel Details Card */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                    <div className="flex justify-between items-start mb-6">
                         <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Info className="w-5 h-5 text-sky-500" />
                                تفاصيل القناة (Real Metadata)
                            </h3>
                            <p className="text-slate-500 text-xs mt-1">بيانات تم سحبها من YouTube API v3</p>
                         </div>
                         <div className="flex gap-2">
                            {channel?.country && (
                                <div className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-2 text-xs text-slate-300">
                                    <Globe className="w-3 h-3" /> {channel.country}
                                </div>
                            )}
                            <div className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-2 text-xs text-slate-300">
                                <Calendar className="w-3 h-3" /> {formatDate(channel?.publishedAt)}
                            </div>
                         </div>
                    </div>

                    <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                        <label className="text-xs text-slate-500 font-bold block mb-2 uppercase tracking-widest">نبذة عن القناة</label>
                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                            {channel?.description || "لا يوجد وصف لهذه القناة."}
                        </p>
                    </div>

                    <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
                         <div className={`w-2 h-2 rounded-full ${isLiveMode ? 'bg-red-500 animate-ping' : 'bg-emerald-500'} `}></div>
                         {isLiveMode ? 'متصل بالسيرفر (تحديث مباشر)' : 'البيانات محفوظة محلياً'}
                    </div>
                </div>

                {/* Alerts / System Status */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-6">حالة النظام</h3>
                    <div className="space-y-4">
                         <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3">
                            <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0" />
                            <div>
                                <h4 className="text-sm font-bold text-emerald-500 mb-1">الوضع الصارم: مفعل</h4>
                                <p className="text-xs text-slate-400">تم إزالة جميع المخططات البيانية الوهمية. يتم عرض البيانات التي توفرها API فقط.</p>
                            </div>
                        </div>
                        {isLiveMode && (
                             <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 animate-pulse">
                                <Radio className="w-5 h-5 text-red-500 shrink-0" />
                                <div>
                                    <h4 className="text-sm font-bold text-red-500 mb-1">رادار المشتركين</h4>
                                    <p className="text-xs text-slate-400">يقوم النظام بفحص القناة كل 30 ثانية لاكتشاف المشتركين الجدد.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
};
