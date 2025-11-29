
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Key, 
  ImageIcon, 
  Plus, 
  Trash2, 
  Music, 
  Search,
  Server,
  Edit2,
  Save,
  CheckCircle,
  Zap,
  Youtube
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Channel } from '../types';

const KNOWN_PROVIDERS = [
    { name: 'Pexels', type: 'Images & Video', icon: ImageIcon, storageKey: 'pexels_api_key' },
    { name: 'Pixabay', type: 'Images & Video', icon: ImageIcon, storageKey: 'pixabay_api_key' },
    { name: 'Unsplash', type: 'Images', icon: ImageIcon, storageKey: 'unsplash_api_key' },
    { name: 'ElevenLabs', type: 'Audio/TTS', icon: Music, storageKey: 'elevenlabs_api_key' },
    { name: 'Google Search', type: 'Search', icon: Search, storageKey: 'google_search_key' }
];

interface Integration {
    name: string;
    key: string;
    status: 'valid' | 'invalid' | 'none';
    storageKey: string;
    type: string;
    icon?: React.ElementType;
}

interface SettingsProps {
    channels: Channel[];
    onAddChannel: (channel: Channel) => void;
    onRemoveChannel: (id: string) => void;
    onToggleChannel: (id: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
    channels = [], 
    onAddChannel, 
    onRemoveChannel, 
    onToggleChannel 
}) => {
  const [activeTab, setActiveTab] = useState<'keys' | 'channels'>('keys');
  const [googleKey, setGoogleKey] = useState(localStorage.getItem('google_api_key') || '');
  const [youtubeDataKey, setYoutubeDataKey] = useState(localStorage.getItem('youtube_data_api_key') || '');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [providerName, setProviderName] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => { loadIntegrations(); }, []);

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
                  icon: provider.icon
              });
          }
      });
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('custom_')) {
              const val = localStorage.getItem(key);
              const name = key.replace('custom_', '').replace('_key', '').replace(/_/g, ' ');
              loaded.push({
                  name: name,
                  key: val || '',
                  status: 'valid',
                  storageKey: key,
                  type: 'Custom',
                  icon: Server
              });
          }
      }
      setIntegrations(loaded);
  };

  const handleSaveIntegration = () => {
      if (!providerName || !apiKeyInput) return;
      let storageKey = '';
      const known = KNOWN_PROVIDERS.find(p => p.name.toLowerCase() === providerName.trim().toLowerCase());
      if (known) storageKey = known.storageKey;
      else if (editingKey) storageKey = editingKey;
      else storageKey = `custom_${providerName.replace(/\s+/g, '_').toLowerCase()}_key`;

      localStorage.setItem(storageKey, apiKeyInput.trim());
      loadIntegrations();
      setIsAddingMode(false);
      setEditingKey(null);
      setProviderName('');
      setApiKeyInput('');
  };

  const startEdit = (item: Integration) => {
      setEditingKey(item.storageKey);
      setProviderName(item.name);
      setApiKeyInput(item.key);
      setIsAddingMode(true);
  };

  const removeIntegration = (storageKey: string) => {
      if(confirm('هل أنت متأكد من حذف هذا المفتاح نهائياً؟')) {
          localStorage.removeItem(storageKey);
          setIntegrations(prev => prev.filter(item => item.storageKey !== storageKey));
      }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fadeIn pb-32">
        <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-slate-400" /> الإعدادات
        </h2>

        <div className="space-y-8 animate-fadeIn">
            {/* Master Keys */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Key className="text-yellow-500" /> المفاتيح الأساسية</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-xs text-slate-400 block mb-2 font-bold">Google Gemini API</label>
                        <input type="password" value={googleKey} onChange={(e) => {setGoogleKey(e.target.value); localStorage.setItem('google_api_key', e.target.value);}} className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white"/>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-2 font-bold">YouTube Data API</label>
                        <input type="password" value={youtubeDataKey} onChange={(e) => {setYoutubeDataKey(e.target.value); localStorage.setItem('youtube_data_api_key', e.target.value);}} className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white"/>
                    </div>
                </div>
            </div>

            {/* Integrations */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><Server className="text-blue-500" /> التكاملات الخارجية</h3>
                    <button 
                        onClick={() => { setIsAddingMode(!isAddingMode); setEditingKey(null); setProviderName(''); setApiKeyInput(''); }} 
                        className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> إضافة مفتاح
                    </button>
                </div>

                {isAddingMode && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6">
                        <h4 className="text-white font-bold mb-4 text-sm">{editingKey ? 'تعديل المفتاح' : 'إضافة مفتاح جديد'}</h4>
                        <input type="text" value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="اسم الخدمة (Pexels, etc.)" className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm w-full mb-2" disabled={!!editingKey && KNOWN_PROVIDERS.some(p => p.storageKey === editingKey)} />
                        <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="API Key" className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm w-full mb-2" />
                        <div className="flex gap-2">
                            <button onClick={handleSaveIntegration} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><Save className="w-4 h-4"/> حفظ</button>
                            <button onClick={() => setIsAddingMode(false)} className="flex-1 bg-slate-800 text-white py-2 rounded-lg text-sm font-bold">إلغاء</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {integrations.map((item) => (
                        <div key={item.storageKey} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between group hover:border-slate-600 transition">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                                    {item.icon ? <item.icon className="w-5 h-5 text-slate-400" /> : <Key className="w-5 h-5 text-slate-400" />}
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm">{item.name}</h4>
                                    <p className="text-[10px] text-slate-500 font-mono">••••••••••</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startEdit(item)} className="text-slate-600 hover:text-blue-500 p-2"><Edit2 className="w-4 h-4"/></button>
                                <button onClick={() => removeIntegration(item.storageKey)} className="text-slate-600 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};
