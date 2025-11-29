
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VideoDuration, ScriptData, Overlay, OverlayType, Trend } from "../types";

const getAI = () => {
    const customKey = localStorage.getItem('google_api_key');
    const sanitizedKey = customKey ? customKey.trim() : (process.env.API_KEY || '');
    if (!sanitizedKey) throw new Error("Google API Key is missing. Please set it in Settings.");
    return new GoogleGenAI({ apiKey: sanitizedKey });
};

// Enhanced Retry Logic
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (e: any) {
        if (retries > 0) {
            let isQuota = false;
            const errStr = e.toString().toLowerCase();
            const message = e.message?.toLowerCase() || '';
            const apiError = e.error || {};

            if (
                errStr.includes('429') || 
                e.status === 429 || 
                e.code === 429 ||
                apiError.code === 429 || 
                apiError.status === 'RESOURCE_EXHAUSTED' ||
                message.includes('quota') ||
                message.includes('exhausted') ||
                message.includes('limit') ||
                errStr.includes('resource_exhausted')
            ) {
                isQuota = true;
            }

            const waitTime = isQuota ? delay * 3 : delay; 
            console.warn(`[GeminiService] Error detected (${isQuota ? 'Quota' : 'General'}). Retrying in ${waitTime}ms... Attempts left: ${retries}`);
            await new Promise(r => setTimeout(r, waitTime));
            return withRetry(fn, retries - 1, waitTime);
        }
        throw e;
    }
}

function cleanJsonText(text: string): string {
    if (!text) return "[]";
    let content = text.replace(/```json\n?|```\n?/g, "");
    const arrayStart = content.indexOf('[');
    const arrayEnd = content.lastIndexOf(']');
    const objStart = content.indexOf('{');
    const objEnd = content.lastIndexOf('}');
    
    if (arrayStart !== -1 && arrayEnd !== -1 && (objStart === -1 || arrayStart < objStart)) {
        return content.substring(arrayStart, arrayEnd + 1);
    }
    if (objStart !== -1 && objEnd !== -1) {
        return content.substring(objStart, objEnd + 1);
    }
    return content.trim();
}

// --- Trends ---
export const analyzeTrends = async (query: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const prompt = `Analyze current market trends related to "${query}". Identify 3-5 high-potential topics. STRICTLY return a JSON array of objects: { topic, relevance, growth, suggestion }.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        });
        return cleanJsonText(response.text || "[]");
    }, 3, 3000);
};

export const analyzeRegionalTrends = async (region: 'arab' | 'usa'): Promise<any[]> => {
    return withRetry(async () => {
        const ai = getAI();
        const context = region === 'arab' ? "in the Arab world (Middle East & North Africa)" : "in the USA";
        const prompt = `Find the top 5 trending YouTube video topics ${context} right now. STRICTLY return a raw JSON array of objects: { topic, relevance, growth, suggestion }.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        });
        return JSON.parse(cleanJsonText(response.text || "[]"));
    }, 3, 3000);
};

export const analyzeTopicDuration = async (topic: string, language: string): Promise<{recommended: VideoDuration, reason: string}> => {
    return withRetry(async () => {
        const ai = getAI();
        const prompt = `For a YouTube video about "${topic}" in ${language}, what is the optimal duration? Return JSON: { "recommended": "short" | "medium" | "long", "reason": "explanation" }`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || '{"recommended":"medium","reason":"Default"}');
    }, 2, 2000);
};

// --- Script Generation ---

export const generateScript = async (topic: string, tone: string, language: string, duration: string, customDuration?: number): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const durText = customDuration ? `${customDuration} minutes` : duration;
        
        const hasPexels = !!localStorage.getItem('pexels_api_key');
        const hasPixabay = !!localStorage.getItem('pixabay_api_key');
        const hasExternalMedia = hasPexels || hasPixabay;

        const mediaContext = hasExternalMedia 
            ? "The user has Pexels/Pixabay keys. Write 'visualCue' as concise, English search terms for stock footage (e.g., 'drone shot city night', 'happy woman typing'). Avoid abstract artsy prompts."
            : "The user uses AI Generation. Write 'visualCue' as highly descriptive, artistic English text-to-image prompts.";

        const musicLib = `
            Available Music IDs:
            - mus_epic (Epic/Action)
            - mus_dramatic (Sad/Deep)
            - mus_happy (Upbeat/Vlog)
            - mus_rock (Intense/Sport)
            - mus_romance (Love/Soft)
            - mus_horror (Scary/Dark)
        `;

        const prompt = `
            Create a YouTube script about "${topic}".
            Language: ${language === 'ar' ? 'Arabic' : 'English'}.
            Tone: ${tone}.
            Duration: ${durText}.
            
            ${mediaContext}
            ${musicLib}
            
            Return JSON:
            {
                title: string;
                alternatives: Array<{title: string, score: number}>;
                hook: string;
                body: string;
                callToAction: string;
                hashtags: string[];
                description: string;
                scenes: Array<{
                    timestamp: string;
                    narration: string; // Spoken text ONLY
                    visualCue: string; // English Search/Prompt
                    description: string;
                    suggestedMotion: "none"|"zoom-in"|"zoom-out"|"pan-left"|"pan-right";
                    sfxCue?: string;
                }>;
                sources?: Array<{title: string, uri: string}>;
                musicMood?: string; // Epic, Dramatic, etc.
                selectedMusicTrackId?: string; // MUST be one of the IDs above (e.g., 'mus_epic')
                mixingSettings?: { voice: number; music: number; };
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        });

        let finalText = cleanJsonText(response.text || "{}");
        try {
            const json = JSON.parse(finalText);
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (chunks) {
                json.sources = chunks.map((c: any) => c.web ? { title: c.web.title, uri: c.web.uri } : null).filter(Boolean);
            }
            finalText = JSON.stringify(json);
        } catch (e) { }

        return finalText;
    }, 3, 5000);
};

// --- Assets ---

export const generateThumbnail = async (prompt: string): Promise<string | null> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: { parts: [{ text: prompt }] }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        return null;
    }, 5, 10000).catch(() => null);
};

// --- ROBUST VEO GENERATION WITH FALLBACK ---
export const generateVideo = async (prompt: string, imageBase64?: string): Promise<{ url: string | null, isFallback: boolean }> => {
    const apiKey = localStorage.getItem('google_api_key') || process.env.API_KEY;
    if(!apiKey) throw new Error("API Key Missing");

    try {
        const ai = getAI();
        console.log("Starting Veo Generation...");
        
        let operation;
        
        if (imageBase64) {
            // Image-to-Video
            operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                image: {
                    imageBytes: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
                    mimeType: 'image/png' // Assuming PNG/JPEG logic handled elsewhere, defaulting safe
                },
                config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
            });
        } else {
            // Text-to-Video
            operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
            });
        }

        let attempts = 0;
        while (!operation.done && attempts < 15) { // 75 seconds timeout
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
            attempts++;
        }

        if(!operation.done) throw new Error("Timeout");

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("No URI returned");

        const res = await fetch(`${videoUri}&key=${apiKey}`);
        if (!res.ok) throw new Error("Download failed");
        
        const blob = await res.blob();
        return { url: URL.createObjectURL(blob), isFallback: false };

    } catch (e: any) {
        console.warn("Veo failed, using fallback motion strategy:", e.message);
        // Fallback: Return null url but flag isFallback as true
        // The component will interpret this as "Use CSS Animation"
        return { url: null, isFallback: true };
    }
};

// --- Audio ---

function pcmToWavBlob(samplesBase64: string, sampleRate = 24000): Blob {
    const binaryString = atob(samplesBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    const buffer = new ArrayBuffer(44 + bytes.length);
    const view = new DataView(buffer);
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + bytes.length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, bytes.length, true);
    const payload = new Uint8Array(buffer, 44);
    payload.set(bytes);
    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

export const generateVoiceover = async (text: string, voiceName: string = 'Kore'): Promise<string | null> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
            }
        });
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioData) return URL.createObjectURL(pcmToWavBlob(audioData));
        return null;
    }, 3, 2000).catch(() => null);
};

export const suggestSFX = async (desc: string): Promise<string> => {
    return withRetry(async () => {
        try {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Suggest a single sound effect name for: "${desc}". Return JUST the name (e.g. Whoosh, Typing).`,
            });
            return response.text?.trim() || 'None';
        } catch { return 'None'; }
    }, 2, 2000);
};

// --- External Image & Video Search ---

export const searchImages = async (query: string): Promise<string[]> => {
    const searchKey = localStorage.getItem('google_search_key');
    const cx = localStorage.getItem('google_search_cx') || 'YOUR_CX_ID';
    if (searchKey) {
        try {
            const res = await fetch(`https://customsearch.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&key=${searchKey}&cx=${cx}&num=3`);
            const data = await res.json();
            if (data.items) return data.items.map((item: any) => item.link);
        } catch { }
    }
    return [];
};

export const searchPexelsImages = async (query: string): Promise<string[]> => {
    const key = localStorage.getItem('pexels_api_key');
    if (!key) return [];
    try {
        const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3`, {
            headers: { Authorization: key }
        });
        const data = await res.json();
        return data.photos?.map((p: any) => p.src.medium) || [];
    } catch { return []; }
};

export const searchPexelsVideos = async (query: string): Promise<string[]> => {
    const key = localStorage.getItem('pexels_api_key');
    if (!key) return [];
    try {
        const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=3`, {
            headers: { Authorization: key }
        });
        const data = await res.json();
        // Return first video file link (SD/HD)
        return data.videos?.map((v: any) => v.video_files[0]?.link) || [];
    } catch { return []; }
};

export const searchPixabayImages = async (query: string): Promise<string[]> => {
    const key = localStorage.getItem('pixabay_api_key');
    if (!key) return [];
    try {
        const res = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3`);
        const data = await res.json();
        return data.hits?.map((h: any) => h.webformatURL) || [];
    } catch { return []; }
};

export const searchPixabayVideos = async (query: string): Promise<string[]> => {
    const key = localStorage.getItem('pixabay_api_key');
    if (!key) return [];
    try {
        const res = await fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(query)}&per_page=3`);
        const data = await res.json();
        return data.hits?.map((h: any) => h.videos.medium.url) || [];
    } catch { return []; }
};

export const generateAIIcons = async (script: ScriptData): Promise<Overlay[]> => {
    return withRetry(async () => {
        try {
            const ai = getAI();
            const prompt = `Suggest 3 visual icons/stickers for this script. Available: like, subscribe, notification, text. Script: ${script.body.substring(0, 500)}... Return JSON Array: {type, startTime, iconName}.`;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { 
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, startTime: { type: Type.NUMBER }, iconName: { type: Type.STRING } } }
                    }
                }
            });
            const suggestions = JSON.parse(response.text || "[]");
            return suggestions.map((s: any, i: number) => ({
                id: `ai-icon-${Date.now()}-${i}`,
                type: s.type,
                url: s.iconName === 'money' ? 'https://cdn-icons-png.flaticon.com/512/2474/2474450.png' : 'https://cdn-icons-png.flaticon.com/512/1077/1077035.png',
                startTime: s.startTime || 5,
                duration: 3,
                position: { x: 80, y: 20 }
            }));
        } catch { return []; }
    }, 2, 3000);
};
