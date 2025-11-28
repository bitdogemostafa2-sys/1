
import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  BrainCircuit, 
  PenTool, 
  Image as ImageIcon, 
  UploadCloud, 
  BarChart2, 
  Settings,
  Zap,
  Mic2,
  Scissors,
  PlusCircle,
  ChevronDown,
  Check,
  Plus,
  Save
} from 'lucide-react';
import { ViewState, Channel } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onNewProject: () => void; 
  channels: Channel[];
  onSwitchChannel: (id: string) => void;
  onManageChannels: () => void;
  onManualSave: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, 
    onChangeView, 
    onNewProject,
    channels = [],
    onSwitchChannel,
    onManageChannels,
    onManualSave
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Guard against null/undefined channels prop
  const safeChannels = Array.isArray(channels) ? channels : [];
  const activeChannel = safeChannels.find(c => c.isActive);

  const menuItems = [
    { id: ViewState.DASHBOARD, label: 'لوحة القيادة', icon: LayoutDashboard },
    { id: ViewState.STRATEGY, label: 'الاستراتيجية الذكية', icon: BrainCircuit },
    { id: ViewState.CONTENT_GENERATOR, label: 'محرك المحتوى', icon: PenTool },
    { id: ViewState.VISUAL_STUDIO, label: 'الاستوديو المرئي', icon: ImageIcon },
    { id: ViewState.AUDIO_STUDIO, label: 'الاستوديو الصوتي', icon: Mic2 },
    { id: ViewState.SMART_EDITOR, label: 'المحرر الذكي', icon: Scissors },
    { id: ViewState.PUBLISHING, label: 'النشر والجدولة', icon: UploadCloud },
    { id: ViewState.ANALYTICS, label: 'التحليلات والنمو', icon: BarChart2 },
    { id: ViewState.SETTINGS, label: 'الإعدادات و API', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-l border-slate-800 h-screen fixed right-0 top-0 flex flex-col z-50 text-slate-300 shadow-2xl">
      
      {/* Channel Switcher / Header */}
      <div className="p-4 border-b border-slate-800 relative select-none">
        <div 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 cursor-pointer hover:bg-slate-900 p-2 rounded-xl transition duration-200 border border-transparent hover:border-slate-800 group"
        >
            {activeChannel ? (
                <>
                    <img src={activeChannel.avatar} className="w-10 h-10 rounded-full border border-slate-700 shadow-sm" alt="Channel" />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition">{activeChannel.name}</h3>
                        <p className="text-[10px] text-slate-500 truncate">{activeChannel.subscribers} مشترك</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </>
            ) : (
                <>
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-900/50">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-lg font-black text-white tracking-tight">AutoTube AI</h1>
                    </div>
                    {safeChannels.length > 0 && <ChevronDown className="w-4 h-4 text-slate-500" />}
                </>
            )}
        </div>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
            <div className="absolute top-[80px] left-2 right-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn backdrop-blur-md">
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {safeChannels.length > 0 ? safeChannels.map(channel => (
                        <div 
                            key={channel.id}
                            onClick={() => { onSwitchChannel(channel.id); setIsDropdownOpen(false); }}
                            className={`flex items-center gap-3 p-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800/50 last:border-0 ${channel.isActive ? 'bg-slate-800/50' : ''}`}
                        >
                            <img src={channel.avatar} className="w-8 h-8 rounded-full" alt="" />
                            <div className="flex-1 truncate">
                                <div className={`text-sm font-medium ${channel.isActive ? 'text-white' : 'text-slate-400'}`}>{channel.name}</div>
                            </div>
                            {channel.isActive && <Check className="w-4 h-4 text-emerald-500" />}
                        </div>
                    )) : (
                        <div className="p-4 text-center text-xs text-slate-500">لا توجد قنوات مرتبطة</div>
                    )}
                </div>
                <button 
                    onClick={() => { onManageChannels(); setIsDropdownOpen(false); }}
                    className="w-full p-3 bg-slate-950/80 hover:bg-indigo-600 hover:text-white text-xs font-bold text-indigo-400 flex items-center justify-center gap-2 transition border-t border-slate-800"
                >
                    <Plus className="w-3 h-3" /> إدارة / إضافة قناة
                </button>
            </div>
        )}
      </div>

      <div className="p-4 pb-0">
          <button 
            onClick={onNewProject}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30 transition-all hover:scale-[1.02]"
          >
              <PlusCircle className="w-5 h-5" />
              مشروع جديد
          </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-slate-800 text-white shadow-inner border border-slate-700' 
                  : 'hover:bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span className={`font-medium ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
          <button 
            onClick={onManualSave}
            className="w-full bg-slate-900 hover:bg-emerald-900/30 border border-slate-800 hover:border-emerald-500/50 text-slate-400 hover:text-emerald-400 p-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition mb-3 text-sm group"
          >
              <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
              حفظ النظام يدوياً
          </button>

        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 relative overflow-hidden group">
            <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition"></div>
          <div className="flex justify-between text-xs mb-2 relative z-10">
            <span className="text-slate-400">رصيد API</span>
            <span className="text-emerald-400 font-bold">نشط</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 relative z-10">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full animate-pulse" style={{ width: '72%' }}></div>
          </div>
        </div>
      </div>
    </aside>
  );
};
