

import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  CheckCircle, 
  Key, 
  ImageIcon, 
  Zap, 
  Plus, 
  Trash2, 
  Music, 
  Search,
  Server,
  Youtube,
  Link,
  Activity,
  RefreshCw,
  Database,
  Cloud,
  Download,
  Upload,
  Save,
  HardDrive,
  Eye,
  EyeOff,
  AlertTriangle,
  XCircle,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  LifeBuoy
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Channel } from '../types';
import { getStoredToken, setStoredToken } from '../services/storageService';

const KNOWN_PROVIDERS = [
    { name: 'Pexels', type: 'Images & Video', icon: ImageIcon, storageKey: 'pexels_api_key', desc: 'مكتبة صور وفيديوهات مجانية ضخمة' },
    { name: 'Pixabay', type: 'Images & Video', icon: ImageIcon, storageKey: 'pixabay_api_key', desc: 'مكتبة شاملة للوسائط المتعددة' },
    { name: 'Unsplash', type: 'Images', icon: ImageIcon, storageKey: 'unsplash_api_key', desc: 'صور فوتوغرافية عالية الدقة' },
    { name: 'ElevenLabs', type: 'Audio/TTS', icon: Music, storageKey: 'elevenlabs_api_key', desc: 'توليد صوتي احترافي' },
    { name: 'Google Search', type: 'Search', icon: Search, storageKey: 'google_search_key', desc: 'بحث جوجل المتقدم (Programmable Search)' }
];

interface Integration {
    name: string;
    key: string;
    status: 'checking' | 'valid' | 'invalid' | 'none';
    storageKey: string;
    type: string;
    icon?: React.ElementType;
    verificationState?: 'idle' | 'loading' | 'success' | 'error';
    quotaMessage?: string;
}

interface SettingsProps {
    channels: Channel[];
    onAddChannel: (channel: Channel) => void;
    onRemoveChannel: (id: string) => void;
    onToggleChannel: (id: string) => void;
}

// Helper for deterministic pseudo-random numbers based on string (ONLY used if NO API key is provided)
const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; 
    }
    return Math.abs(hash);
};

export const Settings: React.FC<SettingsProps> = ({ 
    channels = [], 
    onAddChannel, 
    onRemoveChannel, 
    onToggleChannel 
}) => {
  const [activeTab, setActiveTab] = useState<'keys' | 'channels' | 'data'>('keys');

  // Master Keys State
  const [googleKey, setGoogleKey] = useState(localStorage.getItem('google_api_key') || '');
  const [googleStatus, setGoogleStatus] = useState<'checking' | 'valid' | 'invalid' | 'none'>('none');
  
  const [youtubeDataKey, setYoutubeDataKey] = useState(localStorage.getItem('youtube_data_api_key') || '');
  const [youtubeStatus, setYoutubeStatus] = useState<'checking' | 'valid' | 'invalid' | 'none'>('none');
  const [youtubeErrorDetail, setYoutubeErrorDetail] = useState<string>('');
  const [showYoutubeGuide, setShowYoutubeGuide] = useState(false);

  // Dynamic Integrations State
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  
  // Add New Key Form State
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newAPIKey, setNewAPIKey] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<typeof KNOWN_PROVIDERS[0] | null>(null);

  // Channel Form State
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [manualChannelName, setManualChannelName] = useState(''); 
  const [isSearchingChannel, setIsSearchingChannel] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  
  // Quick Link State (in Keys tab)
  const [quickLinkInput, setQuickLinkInput] = useState('');

  // Data & Cloud State
  const [accessToken, setAccessToken] = useState(getStoredToken());
  const [showToken, setShowToken] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'uploading' | 'downloading' | 'success' | 'error'>('idle');
  const [cloudMsg, setCloudMsg] = useState('');
  const [showGuide, setShowGuide] = useState(true);
  
  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  // Auto-Save Access Token (Strictly Cleaned)
  useEffect(() => {
      const cleanToken = accessToken.trim();
      setStoredToken(cleanToken);
  }, [accessToken]);

  const loadIntegrations = () => {
      const loaded: Integration[] = [];
      KNOWN_PROVIDERS.forEach(provider => {
          const val = localStorage.getItem(provider.storageKey);
          if (val) {
              loaded.push({
                  name: provider.name,
                  key: val,
                  status: 'valid',
                  storageKey: provider.storageKey,
                  type: provider.type,
                  icon: provider.icon,
                  verificationState: 'idle'
              });
          }
      });
      
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('custom_')) {
              const val = localStorage.getItem(key);
              const name = key.replace('custom_', '').replace('_key', '').replace(/_/g, ' ');
              const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
              loaded.push({
                  name: formattedName,
                  key: val || '',
                  status: 'valid',
                  storageKey: key,
                  type: 'Custom Integration',
                  icon: Server,
                  verificationState: 'idle'
              });
          }
      }
      setIntegrations(loaded);
  };

  useEffect(() => {
      const normalizedInput = newProviderName.trim().toLowerCase();
      const match = KNOWN_PROVIDERS.find(p => p.name.toLowerCase() === normalizedInput);
      setDetectedProvider(match || null);
  }, [newProviderName]);

  const saveKey = (keyName: string, value: string) => {
      if (value !== null && value !== undefined) {
          localStorage.setItem(keyName, value.trim());
      } else {
          localStorage.removeItem(keyName);
      }
  };

  const checkGoogleKey = async (key: string) => {
    if (!key) return;
    const cleanKey = key.trim();
    setGoogleStatus('checking');
    try {
      const ai = new GoogleGenAI({ apiKey: cleanKey });
      await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'Test',
      });
      setGoogleStatus('valid');
      saveKey('google_api_key', cleanKey);
    } catch (e) {
      console.error(e);
      setGoogleStatus('invalid');
      saveKey('google_api_key', cleanKey);
    }
  };

  const checkYoutubeKey = async (key: string) => {
      if (!key) return;
      const cleanKey = key.trim();
      setYoutubeStatus('checking');
      setYoutubeErrorDetail('');
      try {
          const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${cleanKey}`);
          const data = await res.json();
          
          if (data.error) {
              setYoutubeStatus('invalid');
              let msg = data.error.message || 'Invalid API Key';
              if (data.error.code === 403) {
                  msg = 'المفتاح صحيح لكن خدمة YouTube Data API v3 غير مفعلة في Google Cloud Console.';
              }
              setYoutubeErrorDetail(msg);
          } else {
              setYoutubeStatus('valid');
              saveKey('youtube_data_api_key', cleanKey);
          }
      } catch (e: any) {
          setYoutubeStatus('invalid');
          setYoutubeErrorDetail(e.message || 'Network Error');
      }
  };

  const handleSaveIntegration = () => {
      if (!newProviderName || !newAPIKey) return;
      const storageKey = detectedProvider ? detectedProvider.storageKey : `custom_${newProviderName.replace(/\s+/g, '_').toLowerCase()}_key`;
      saveKey(storageKey, newAPIKey);
      loadIntegrations();
      setIsAddingMode(false);
      setNewProviderName('');
      setNewAPIKey('');
      setDetectedProvider(null);
  };

  const removeIntegration = (storageKey: string) => {
      if(confirm('هل أنت متأكد من حذف هذا المفتاح؟')) {
          localStorage.removeItem(storageKey);
          loadIntegrations();
      }
  };

  const parseChannelUrl = (input: string) => {
      let id = '';
      let handle = '';
      const cleanInput = input.trim();
      try {
          if (cleanInput.includes('youtube.com') || cleanInput.includes('youtu.be')) {
              const url = new URL(cleanInput.startsWith('http') ? cleanInput : `https://${cleanInput}`);
              const parts = url.pathname.split('/').filter(p => p.length > 0);
              if (parts[0] === 'channel' && parts[1]) { id = parts[1]; } 
              else if (parts[0].startsWith('@')) { handle = parts[0]; } 
              else if ((parts[0] === 'c' || parts[0] === 'user') && parts[1]) { handle = parts[1]; } 
              else if (parts[0]) { if (!['watch', 'shorts', 'feed', 'results'].includes(parts[0])) { handle = parts[0]; } }
          } else {
              if (cleanInput.startsWith('UC') && cleanInput.length === 24) { id = cleanInput; } 
              else if (cleanInput.startsWith('@')) { handle = cleanInput; } 
              else { handle = cleanInput; }
          }
      } catch (e) { handle = cleanInput; }
      return { id, handle };
  };

  const formatNumber = (numStr: string) => {
      const num = parseInt(numStr);
      if (isNaN(num)) return '---';
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
  };

  const handleConnectChannel = async (inputUrl: string) => {
      if (!inputUrl) return;
      setIsSearchingChannel(true);
      setChannelError(null);

      const { id: parsedId, handle: parsedHandle } = parseChannelUrl(inputUrl);
      
      let finalId = parsedId;
      let finalName = manualChannelName || "YouTube Channel";
      let finalAvatar = "";
      let finalSubs = "---";
      let finalViews = "---";
      let finalVideoCount = "0";
      let finalDescription = "";
      let finalPublishedAt = "";
      let finalCountry = "";
      let isVerified = false;
      let finalHandleDisplay = parsedHandle || '';

      if (youtubeDataKey) {
          try {
              let apiUrl = '';
              let performSearch = false;
              if (finalId && finalId.startsWith('UC')) {
                  apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${finalId}&key=${youtubeDataKey}`;
              } else if (parsedHandle && parsedHandle.startsWith('@')) {
                  apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(parsedHandle)}&key=${youtubeDataKey}`;
              } else { performSearch = true; }

              if (performSearch) {
                  const query = parsedHandle || inputUrl;
                  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${youtubeDataKey}`;
                  const searchRes = await fetch(searchUrl);
                  const searchData = await searchRes.json();
                  if (searchData.error) throw new Error(searchData.error.message);
                  if (!searchData.items || searchData.items.length === 0) { throw new Error(`لم يتم العثور على أي قناة مطابقة للبحث: "${query}"`); }
                  finalId = searchData.items[0].id.channelId;
                  apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${finalId}&key=${youtubeDataKey}`;
              }

              const res = await fetch(apiUrl);
              const data = await res.json();
              if (data.error) throw new Error(data.error.message);

              if (data.items && data.items.length > 0) {
                  const item = data.items[0];
                  finalId = item.id;
                  finalName = item.snippet.title;
                  finalHandleDisplay = item.snippet.customUrl || parsedHandle || finalName;
                  finalAvatar = item.snippet.thumbnails.medium.url;
                  finalSubs = formatNumber(item.statistics.subscriberCount);
                  finalViews = formatNumber(item.statistics.viewCount);
                  finalVideoCount = formatNumber(item.statistics.videoCount);
                  finalDescription = item.snippet.description || "لا يوجد وصف";
                  finalPublishedAt = item.snippet.publishedAt;
                  finalCountry = item.snippet.country || "غير محدد";
                  isVerified = true;
              } else { throw new Error("القناة غير موجودة. تأكد من المعرف أو الرابط."); }
          } catch (e: any) {
              console.error("Strict Mode Error:", e);
              setIsSearchingChannel(false);
              setChannelError(`فشل الربط (API Error): ${e.message}`);
              return; 
          }
      } else {
          const seed = getHash(finalId || inputUrl);
          const subBase = (seed % 900) + 50;
          finalSubs = `${subBase}K`;
          finalViews = `${(seed % 50) + 1}M`;
          finalVideoCount = "150";
          if (!finalAvatar) finalAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=ff0000&color=fff&size=128&bold=true`;
          finalDescription = "بيانات توضيحية (لم يتم استخدام API)";
          finalCountry = "Global";
          finalPublishedAt = new Date().toISOString();
          if (!finalId) finalId = `mock-${Date.now()}`;
      }

      const newChannel: Channel = {
          id: finalId,
          name: finalName,
          handle: finalHandleDisplay || `@${finalName.replace(/\s+/g, '')}`,
          avatar: finalAvatar,
          subscribers: finalSubs,
          views: finalViews,
          videoCount: finalVideoCount, 
          description: finalDescription,
          publishedAt: finalPublishedAt,
          country: finalCountry,
          isActive: true,
          isVerified: isVerified
      };

      onAddChannel(newChannel);
      setIsSearchingChannel(false);
      setIsAddingChannel(false);
      setChannelInput('');
      setQuickLinkInput('');
      setManualChannelName('');
      if(inputUrl === quickLinkInput) { setActiveTab('channels'); }
  };

  const verifyIntegration = (integration: Integration) => {
      setIntegrations(prev => prev.map(i => i.storageKey === integration.storageKey ? { ...i, verificationState: 'success', quotaMessage: 'Active' } : i));
  };

  const handleBackupToDrive = async () => {
      setCloudStatus('uploading');
      setCloudMsg('جاري الرفع إلى Google Drive...');
      try {
          const { gatherFullState, uploadToDrive } = await import('../services/storageService');
          const projectRaw = localStorage.getItem('autoTube_projectState');
          const channelsRaw = localStorage.getItem('autoTube_channels');
          if(!projectRaw) throw new Error("No project state found.");
          
          const backup = await gatherFullState(JSON.parse(projectRaw), JSON.parse(channelsRaw || '[]'));
          
          // PASS TOKEN EXPLICITLY
          await uploadToDrive(backup, accessToken);
          
          setCloudStatus('success');
          setCloudMsg('تم النسخ الاحتياطي بنجاح!');
      } catch (e: any) {
          setCloudStatus('error');
          setCloudMsg(`فشل الرفع: ${e.message}`);
      }
  };

  const handleRestoreFromDrive = async () => {
      setCloudStatus('downloading');
      setCloudMsg('جاري البحث عن النسخة الاحتياطية...');
      try {
          const { restoreFromDrive, restoreLocalSettings } = await import('../services/storageService');
          
          // PASS TOKEN EXPLICITLY
          const backup = await restoreFromDrive(accessToken);
          
          if(backup) {
              localStorage.setItem('autoTube_projectState', JSON.stringify(backup.project));
              localStorage.setItem('autoTube_channels', JSON.stringify(backup.channels));
              restoreLocalSettings(backup.settings);
              setCloudStatus('success');
              setCloudMsg('تمت الاستعادة! قم بتحديث الصفحة.');
              setTimeout(() => window.location.reload(), 2000);
          }
      } catch (e: any) {
          setCloudStatus('error');
          setCloudMsg(`فشل الاستعادة: ${e.message}`);
      }
  };

  const handleLocalExport = async () => {
       const { gatherFullState, downloadBackupFile } = await import('../services/storageService');
       const projectRaw = localStorage.getItem('autoTube_projectState');
       const channelsRaw = localStorage.getItem('autoTube_channels');
       if(projectRaw) {
           const backup = await gatherFullState(JSON.parse(projectRaw), JSON.parse(channelsRaw || '[]'));
           downloadBackupFile(backup);
       }
  };
  
  const handleLocalImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const content = e.target?.result as string;
              let backup;
              try {
                  backup = JSON.parse(content);
              } catch {
                  throw new Error("الملف ليس بتنسيق JSON صحيح.");
              }
              
              if (!backup || typeof backup !== 'object') throw new Error("الملف تالف أو فارغ.");
              if (!backup.project || typeof backup.project !== 'object') throw new Error("هيكل المشروع غير موجود في الملف.");
              
              if (!backup.channels || !Array.isArray(backup.channels)) {
                  console.warn("Channels missing/invalid in backup. Resetting to empty.");
                  backup.channels = [];
              }

              const { restoreLocalSettings } = await import('../services/storageService');
              localStorage.setItem('autoTube_projectState', JSON.stringify(backup.project));
              localStorage.setItem('autoTube_channels', JSON.stringify(backup.channels));
              
              if(backup.settings && typeof backup.settings === 'object') {
                  restoreLocalSettings(backup.settings);
              }
              
              if (confirm("تم التحقق من الملف بنجاح. هل تريد إعادة تشغيل التطبيق لتطبيق البيانات؟")) {
                  window.location.reload();
              }
          } catch (err: any) {
              alert(`خطأ في استيراد الملف: ${err.message}`);
              console.error(err);
          } finally {
              if(fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const handleHardRescue = () => {
      if(confirm("هل أنت متأكد؟ سيتم استبدال البيانات الحالية بالنسخة الاحتياطية المخفية.")) {
          const backup = localStorage.getItem('autoTube_channels_BACKUP');
          if(backup) {
              localStorage.setItem('autoTube_channels', backup);
              window.location.reload();
          } else {
              alert("لا توجد نسخة احتياطية مخفية.");
          }
      }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fadeIn pb-32">
        <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-slate-400" />
            الإعدادات وقاعدة البيانات
        </h2>

        <div className="flex gap-4 border-b border-slate-800 mb-8">
            <button onClick={() => setActiveTab('keys')} className={`pb-3 px-2 font-bold text-sm transition ${activeTab === 'keys' ? 'text-sky-500 border-b-2 border-sky-500' : 'text-slate-500 hover:text-white'}`}>
                المفاتيح والربط
            </button>
            <button onClick={() => setActiveTab('channels')} className={`pb-3 px-2 font-bold text-sm transition ${activeTab === 'channels' ? 'text-red-500 border-b-2 border-red-500' : 'text-slate-500 hover:text-white'}`}>
                إدارة القنوات
            </button>
            <button onClick={() => setActiveTab('data')} className={`pb-3 px-2 font-bold text-sm transition ${activeTab === 'data' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-white'}`}>
                البيانات والسحابة (Cloud)
            </button>
        </div>

        {activeTab === 'keys' && (
            <div className="space-y-8 animate-fadeIn">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Key className="text-yellow-500" />
                        المفاتيح الأساسية
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs text-slate-400 block mb-2 font-bold">Google Gemini API</label>
                            <div className="relative">
                                <input 
                                    type="password"
                                    value={googleKey}
                                    onChange={(e) => { setGoogleKey(e.target.value); setGoogleStatus('none'); saveKey('google_api_key', e.target.value); }}
                                    className={`w-full bg-slate-950 border rounded-xl py-3 px-4 pl-10 text-white outline-none font-mono text-sm ${googleStatus === 'valid' ? 'border-emerald-500' : 'border-slate-700'}`}
                                    placeholder="AIzaSy..."
                                />
                                <div className="absolute top-3.5 left-3">
                                    {googleStatus === 'valid' ? <CheckCircle className="w-4 h-4 text-emerald-500"/> : <Zap className="w-4 h-4 text-slate-500"/>}
                                </div>
                                <button onClick={() => checkGoogleKey(googleKey)} className="absolute top-2 right-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg">فحص</button>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-slate-400 font-bold">YouTube Data API (بيانات حقيقية)</label>
                                <button onClick={() => setShowYoutubeGuide(!showYoutubeGuide)} className="text-[10px] text-sky-400 underline hover:text-sky-300">
                                    كيف أحصل على المفتاح؟
                                </button>
                            </div>
                             {showYoutubeGuide && (
                                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg mb-2 text-[10px] text-slate-400">
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>اذهب إلى <b>Google Cloud Console</b>.</li>
                                        <li>أنشئ مشروعاً جديداً.</li>
                                        <li>ابحث عن <b>YouTube Data API v3</b> واضغط Enable.</li>
                                        <li>اذهب إلى Credentials وأنشئ <b>API Key</b>.</li>
                                        <li>انسخ المفتاح وضعه في الأسفل.</li>
                                    </ol>
                                </div>
                            )}
                            <div className="relative">
                                <input 
                                    type="password"
                                    value={youtubeDataKey}
                                    onChange={(e) => { setYoutubeDataKey(e.target.value); setYoutubeStatus('none'); saveKey('youtube_data_api_key', e.target.value); }}
                                    onBlur={(e) => saveKey('youtube_data_api_key', e.target.value)}
                                    className={`w-full bg-slate-950 border rounded-xl py-3 px-4 pl-10 text-white outline-none font-mono text-sm ${youtubeStatus === 'valid' ? 'border-emerald-500' : youtubeStatus === 'invalid' ? 'border-red-500' : 'border-slate-700'}`}
                                    placeholder="AIzaSy..."
                                />
                                <div className="absolute top-3.5 left-3"><Youtube className="w-4 h-4 text-red-500"/></div>
                                <button onClick={() => checkYoutubeKey(youtubeDataKey)} className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg">فحص</button>
                            </div>
                            {youtubeErrorDetail && <p className="text-xs text-red-400 mt-1">{youtubeErrorDetail}</p>}
                            
                             {youtubeStatus === 'valid' && (
                                <div className="mt-3 bg-red-900/10 border border-red-500/20 p-3 rounded-xl animate-fadeIn">
                                    <p className="text-xs text-red-300 mb-2 font-bold flex items-center gap-1">
                                        <Link className="w-3 h-3"/> ربط القناة فوراً باستخدام هذا المفتاح:
                                    </p>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={quickLinkInput}
                                            onChange={(e) => setQuickLinkInput(e.target.value)}
                                            placeholder="رابط القناة (youtube.com/channel/...)" 
                                            className="flex-1 bg-slate-950 border border-red-500/30 rounded-lg px-2 py-1 text-xs text-white"
                                        />
                                        <button 
                                            onClick={() => handleConnectChannel(quickLinkInput)}
                                            disabled={isSearchingChannel || !quickLinkInput}
                                            className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded-lg disabled:opacity-50"
                                        >
                                            {isSearchingChannel ? 'جاري الربط...' : 'ربط'}
                                        </button>
                                    </div>
                                    {channelError && <p className="text-xs text-red-400 mt-2">{channelError}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'channels' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-fadeIn">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><Youtube className="text-red-500" /> إدارة القنوات</h3>
                    <button onClick={() => setIsAddingChannel(!isAddingChannel)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-red-900/20"><Plus className="w-4 h-4" /> إضافة قناة</button>
                </div>

                {isAddingChannel && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 mb-6 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs text-slate-500 block mb-2 font-bold">رابط القناة (مثل: youtube.com/channel/UC...)</label>
                                <input type="text" value={channelInput} onChange={(e) => setChannelInput(e.target.value)} placeholder="https://www.youtube.com/channel/..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-red-500 dir-ltr"/>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-2 font-bold">اسم مخصص (اختياري)</label>
                                <input type="text" value={manualChannelName} onChange={(e) => setManualChannelName(e.target.value)} placeholder="اسم القناة" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none"/>
                            </div>
                        </div>
                        {channelError && <p className="text-xs text-red-400 mb-2">{channelError}</p>}
                        <div className="flex justify-end"><button onClick={() => handleConnectChannel(channelInput)} disabled={!channelInput || isSearchingChannel} className="bg-white text-slate-900 px-6 py-2 rounded-xl font-bold flex items-center gap-2">{isSearchingChannel ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Link className="w-4 h-4" />} ربط</button></div>
                    </div>
                )}

                <div className="space-y-3">
                    {channels.length === 0 ? <div className="text-center py-8 text-slate-500">لا توجد قنوات.</div> : channels.map(channel => (
                        <div key={channel.id} className={`flex items-center justify-between p-4 rounded-xl border ${channel.isActive ? 'bg-slate-950 border-slate-700' : 'bg-slate-950/50 border-slate-800 opacity-60'}`}>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <img src={channel.avatar} alt="" className="w-10 h-10 rounded-full bg-slate-800" />
                                    {channel.isVerified && <CheckCircle className="w-3 h-3 text-sky-400 absolute -bottom-0.5 -right-0.5 bg-slate-900 rounded-full"/>}
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm flex items-center gap-1">{channel.name}</h4>
                                    <p className="text-slate-500 text-xs font-mono">{channel.subscribers} Subs • {channel.views} Views</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => onToggleChannel(channel.id)} className="p-2 rounded-lg bg-slate-900 hover:text-white text-slate-500"><Activity className="w-4 h-4"/></button>
                                <button onClick={() => onRemoveChannel(channel.id)} className="p-2 rounded-lg bg-slate-900 hover:text-red-500 text-slate-500"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'data' && (
            <div className="space-y-8 animate-fadeIn">
                 <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg relative overflow-hidden">
                     <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 relative z-10"><Database className="text-emerald-500" /> نظام قاعدة البيانات (Strict Mode)</h3>
                     <p className="text-slate-400 text-sm mb-6 max-w-2xl relative z-10">يتم حفظ البيانات تلقائياً. يمكنك الرفع إلى Google Drive.</p>

                     <div className="mb-6 p-4 bg-orange-900/10 border border-orange-500/20 rounded-xl relative z-10">
                         <h4 className="text-orange-400 font-bold text-sm flex items-center gap-2 mb-2"><LifeBuoy className="w-4 h-4" /> إنقاذ البيانات (Data Rescue)</h4>
                         <button onClick={handleHardRescue} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2"><RefreshCw className="w-3 h-3" /> استعادة الطوارئ</button>
                     </div>

                     <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl mb-6 relative z-10">
                         <div className="flex items-center gap-2 mb-4"><Cloud className="text-blue-500 w-5 h-5" /><h4 className="text-white font-bold">Google Drive Cloud</h4></div>
                         
                         <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mb-6">
                            <h5 className="text-blue-400 font-bold text-sm mb-2">كيف أحصل على رمز الوصول؟</h5>
                            {showGuide && (
                                <ol className="list-decimal list-inside text-xs text-slate-300 space-y-2 mb-3 px-2">
                                    <li>اضغط <a href="https://developers.google.com/oauthplayground/#step1&apisSelect=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file&url=https%3A%2F%2F&content_type=application%2Fjson&http_method=GET&useDefaultOauthCred=unchecked" target="_blank" className="text-white underline font-bold">هنا لفتح OAuth Playground</a>.</li>
                                    <li>اضغط <b>Authorize APIs</b>. وافق على الصلاحيات.</li>
                                    <li>اضغط <b>Exchange authorization code for tokens</b>.</li>
                                    <li>انسخ <b>Access Token</b> (وليس Refresh Token).</li>
                                </ol>
                            )}
                        </div>

                         <div className="mb-4">
                             <label className="text-xs text-slate-500 block mb-2">Google Access Token (تأكد من عدم وجود مسافات)</label>
                             <div className="relative">
                                 <input 
                                     type={showToken ? "text" : "password"} 
                                     value={accessToken}
                                     onChange={(e) => setAccessToken(e.target.value)}
                                     placeholder="ya29.a0..." 
                                     className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 pr-10 text-white font-mono text-sm transition-all focus:border-blue-500"
                                 />
                                 <button onClick={() => setShowToken(!showToken)} className="absolute right-2 top-2 text-slate-500 hover:text-white">{showToken ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button>
                             </div>
                         </div>

                         <div className="flex gap-4">
                             <button onClick={handleBackupToDrive} disabled={!accessToken || cloudStatus === 'uploading'} className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                                 {cloudStatus === 'uploading' ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4 text-emerald-400"/>} Backup to Drive
                             </button>
                             <button onClick={handleRestoreFromDrive} disabled={!accessToken || cloudStatus === 'downloading'} className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                                 {cloudStatus === 'downloading' ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4 text-blue-400"/>} Restore from Drive
                             </button>
                         </div>
                         {cloudMsg && <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${cloudStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' : cloudStatus === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-300'}`}><Activity className="w-4 h-4"/> {cloudMsg}</div>}
                     </div>

                     <div className="flex flex-col md:flex-row gap-4 relative z-10">
                         <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleLocalImport} />
                         <button onClick={() => fileInputRef.current?.click()} className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition flex-1"><Upload className="w-4 h-4" /> استيراد ملف (JSON)</button>
                         <button onClick={handleLocalExport} className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition flex-1"><HardDrive className="w-4 h-4" /> تصدير قاعدة البيانات</button>
                     </div>
                 </div>
            </div>
        )}
    </div>
  );
};
