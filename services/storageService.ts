
import { FullBackup, ProjectState, Channel } from "../types";

const TOKEN_KEY = 'google_access_token';

// --- IndexedDB Configuration ---
const IDB_NAME = 'AutoTubeDB';
const IDB_VERSION = 1;
const STORE_PROJECT = 'project_store';
const STORE_BACKUP = 'backup_store';

// Helper: Open Database
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_PROJECT)) {
                db.createObjectStore(STORE_PROJECT);
            }
            if (!db.objectStoreNames.contains(STORE_BACKUP)) {
                db.createObjectStore(STORE_BACKUP);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// --- Project State Management (Heavy Data) ---

export const saveProjectToDB = async (state: ProjectState) => {
    try {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_PROJECT, 'readwrite');
            const store = tx.objectStore(STORE_PROJECT);
            const req = store.put(state, 'currentProject');
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("IDB Save Error", e);
    }
};

export const loadProjectFromDB = async (): Promise<ProjectState | null> => {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_PROJECT, 'readonly');
            const store = tx.objectStore(STORE_PROJECT);
            const req = store.get('currentProject');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        console.error("IDB Load Error", e);
        return null;
    }
};

// --- Local Storage Helpers (Light Data) ---

export const getStoredToken = (): string => {
    const t = localStorage.getItem(TOKEN_KEY) || '';
    return t.trim(); 
};

export const setStoredToken = (token: string) => {
    if(token) {
        localStorage.setItem(TOKEN_KEY, token.trim());
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
};

// --- Full Backup Logic ---

export const gatherFullState = async (project: ProjectState, channels: Channel[]): Promise<FullBackup> => {
    // Collect settings
    const settings: {[key: string]: string | null} = {};
    const keysToSave = [
        'google_api_key', 'youtube_data_api_key', 
        'pexels_api_key', 'pixabay_api_key', 'unsplash_api_key', 'elevenlabs_api_key', 'google_search_key',
        TOKEN_KEY
    ];

    keysToSave.forEach(k => {
        const val = localStorage.getItem(k);
        if (val) settings[k] = val;
    });

    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('custom_')) {
            settings[k] = localStorage.getItem(k);
        }
    }

    return {
        version: 1,
        timestamp: Date.now(),
        project,
        channels,
        settings
    };
};

export const saveLocalBackup = async (backup: FullBackup) => {
    try {
        // Try IndexedDB first for the full backup (it's huge)
        const db = await openDB();
        const tx = db.transaction(STORE_BACKUP, 'readwrite');
        const store = tx.objectStore(STORE_BACKUP);
        store.put(backup, 'latest_backup');
        
        console.log(`[AutoSave] Full Backup saved to IndexedDB at ${new Date(backup.timestamp).toLocaleTimeString()}`);
    } catch (e) {
        console.error("IDB Backup Error", e);
    }
};

export const restoreLocalSettings = (settings: {[key: string]: string | null}) => {
    Object.entries(settings).forEach(([key, value]) => {
        if (value) localStorage.setItem(key, value);
    });
};

// --- Google Drive API ---

export const uploadToDrive = async (backup: FullBackup, manualToken?: string): Promise<boolean> => {
    const rawToken = manualToken || getStoredToken();
    const token = rawToken.trim();

    if (!token) throw new Error("رمز الوصول (Access Token) مفقود. يرجى إدخاله في الإعدادات.");

    const fileContent = JSON.stringify(backup, null, 2);
    const fileMetadata = {
        name: 'autotube_backup.json',
        mimeType: 'application/json'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileContent], { type: 'application/json' }));

    try {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': `Bearer ${token}` }),
            body: form
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            
            if (response.status === 401) {
                throw new Error("رمز الوصول (Token) غير صالح أو منتهي الصلاحية.");
            }
            if (response.status === 403) {
                 throw new Error("لا توجد صلاحيات كافية (403). تأكد من اختيار 'drive.file' في الـ Scopes.");
            }
            throw new Error(err.error?.message || `Upload Failed (${response.status})`);
        }
        return true;
    } catch (error) {
        console.error("Drive Upload Critical Error", error);
        throw error;
    }
};

export const restoreFromDrive = async (manualToken?: string): Promise<FullBackup | null> => {
    const rawToken = manualToken || getStoredToken();
    const token = rawToken.trim();
    
    if (!token) throw new Error("No Access Token provided");

    try {
        const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='autotube_backup.json'&spaces=drive", {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!searchRes.ok) throw new Error("فشل البحث في Drive.");

        const searchData = await searchRes.json();
        
        if (!searchData.files || searchData.files.length === 0) {
            throw new Error("لم يتم العثور على ملف 'autotube_backup.json'.");
        }

        const fileId = searchData.files[0].id;

        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const backupData: FullBackup = await fileRes.json();
        return backupData;

    } catch (error) {
        console.error("Drive Restore Error", error);
        throw error;
    }
};

// --- File System Helpers ---

export const downloadBackupFile = (backup: FullBackup) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "autotube_db_" + new Date().toISOString() + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};
