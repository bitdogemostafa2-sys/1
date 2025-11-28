
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VideoDuration, ScriptData, Overlay, OverlayType, Trend } from "../types";

const getAI = () => {
    const customKey = localStorage.getItem('google_api_key');
    const sanitizedKey = customKey ? customKey.trim() : (process.env.API_KEY || '');
    if (!sanitizedKey) throw new Error("Google API Key is missing. Please set it in Settings.");
    return new GoogleGenAI({ apiKey: sanitizedKey });
};

// Enhanced Retry Logic for Quota Handling
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (e: any) {
        if (retries > 0) {
            let isQuota = false;
            
            // Check strings
            const errStr = e.toString().toLowerCase();
            const message = e.message?.toLowerCase() || '';
            
            // Check specific Google API Error JSON structure
            // The error often looks like: { error: { code: 429, message: "...", status: "RESOURCE_EXHAUSTED" } }
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

            // Exponential backoff: Wait longer if it's a quota error
            // If it's a quota error, we triple the delay to be safe
            const waitTime = isQuota ? delay * 3 : delay; 
            
            console.warn(`[GeminiService] Error detected (${isQuota ? 'Quota' : 'General'}). Retrying in ${waitTime}ms... Attempts left: ${retries}`);
            
            await new Promise(r => setTimeout(r, waitTime));
            return withRetry(fn, retries - 1, waitTime); // Pass the increased wait time for next retry
        }
        throw e;
    }
}

// Helper to extract JSON from potentially chatty responses
function cleanJsonText(text: string): string {
    if (!text) return "[]";
    
    // 1. Remove markdown code blocks
    let content = text.replace(/```json\n?|```\n?/g, "");
    
    // 2. Find the bounds of the JSON structure (Array or Object)
    const arrayStart = content.indexOf('[');
    const arrayEnd = content.lastIndexOf(']');
    const objStart = content.indexOf('{');
    const objEnd = content.lastIndexOf('}');
    
    // If it looks like an array is the primary content
    if (arrayStart !== -1 && arrayEnd !== -1 && (objStart === -1 || arrayStart < objStart)) {
        return content.substring(arrayStart, arrayEnd + 1);
    }
    
    // If it looks like an object
    if (objStart !== -1 && objEnd !== -1) {
        return content.substring(objStart, objEnd + 1);
    }

    // Fallback: return trimmed content and hope it's valid
    return content.trim();
}

// --- Trends & Strategy ---

export const analyzeTrends = async (query: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const prompt = `Analyze current market trends related to "${query}". 
        Identify 3-5 high-potential topics with growth potential.
        STRICTLY return a JSON array (no text before/after) of objects with these properties:
        - topic: string
        - relevance: number (0-100)
        - growth: string (e.g. "+50%")
        - suggestion: string (video idea)
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }] // Use Grounding
            }
        });

        return cleanJsonText(response.text || "[]");
    }, 3, 3000);
};

export const analyzeRegionalTrends = async (region: 'arab' | 'usa'): Promise<any[]> => {
    return withRetry(async () => {
        const ai = getAI();
        const context = region === 'arab' ? "in the Arab world (Middle East & North Africa)" : "in the USA";
        const prompt = `Find the top 5 trending YouTube video topics ${context} right now.
        STRICTLY return a raw JSON array (no markdown, no conversational text) of objects: { topic, relevance, growth, suggestion }.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        const cleaned = cleanJsonText(response.text || "[]");
        return JSON.parse(cleaned);
    }, 3, 3000);
};

export const analyzeTopicDuration = async (topic: string, language: string): Promise<{recommended: VideoDuration, reason: string}> => {
    return withRetry(async () => {
        const ai = getAI();
        const prompt = `For a YouTube video about "${topic}" in ${language}, what is the optimal duration strategy?
        Return JSON: { "recommended": "short" | "medium" | "long", "reason": "explanation" }`;

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
    // Heavy operation: Start with higher delay
    return withRetry(async () => {
        const ai = getAI();
        const durText = customDuration ? `${customDuration} minutes` : duration;
        
        const prompt = `
            Create a detailed YouTube video script about "${topic}".
            Language: ${language === 'ar' ? 'Arabic' : 'English'}.
            Tone: ${tone}.
            Target Duration: ${durText}.
            
            Structure the response as valid JSON matching this interface:
            {
                title: string;
                alternatives: Array<{title: string, score: number}>; // 3 catchy alternatives
                hook: string; // First 30 seconds
                body: string; // Main content
                callToAction: string;
                hashtags: string[];
                description: string; // YouTube video description
                scenes: Array<{
                    timestamp: string; // e.g. "00:00"
                    narration: string; // Voiceover text ONLY. DO NOT include visual descriptions here.
                    visualCue: string; // Prompt for image generation. ENGLISH ONLY.
                    description: string; // Scene details
                    suggestedMotion: "none" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right";
                    sfxCue?: string; // e.g. "Whoosh", "Typing", "Nature"
                }>;
                sources?: Array<{title: string, uri: string}>;
                musicMood?: string; // One of: Epic, Dramatic, Happy, Rock, Romance, Horror
                selectedMusicTrackId?: string; // If you can, select a specific track ID from known library
                mixingSettings?: { 
                    voice: number; // 0.8 - 1.0
                    music: number; // 0.1 - 0.4
                };
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                tools: [{ googleSearch: {} }] // Use Grounding for facts
            }
        });

        let finalText = cleanJsonText(response.text || "{}");
        
        // Inject sources if available from grounding
        try {
            const json = JSON.parse(finalText);
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (chunks) {
                json.sources = chunks
                    .map((c: any) => c.web ? { title: c.web.title, uri: c.web.uri } : null)
                    .filter(Boolean);
            }
            finalText = JSON.stringify(json);
        } catch (e) {
            // ignore parsing error if text is not valid json yet
        }

        return finalText;
    }, 3, 5000); // 5s initial delay for script gen to be safe
};

// --- Visual Assets ---

export const generateThumbnail = async (prompt: string): Promise<string | null> => {
    // Retry up to 5 times (increased from 3), starting with a 10 second delay (increased from 4)
    // Image generation limits are strict.
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: {
                parts: [{ text: prompt }]
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        return null;
    }, 5, 10000).catch(err => {
        console.error("generateThumbnail final error", err);
        return null;
    });
};

export const generateVideo = async (prompt: string): Promise<string | null> => {
    try {
        const ai = getAI();
        // Start generation
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) return null;

        // Fetch the actual video bytes using the API Key
        const apiKey = localStorage.getItem('google_api_key') || process.env.API_KEY;
        const res = await fetch(`${videoUri}&key=${apiKey}`);
        if (!res.ok) throw new Error("Failed to download video");
        
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error("generateVideo error", error);
        return null;
    }
};

// --- Audio Assets ---

// Helper to add WAV header to raw PCM
function pcmToWavBlob(samplesBase64: string, sampleRate = 24000): Blob {
    const binaryString = atob(samplesBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const buffer = new ArrayBuffer(44 + bytes.length);
    const view = new DataView(buffer);

    // RIFF
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + bytes.length, true);
    writeString(view, 8, 'WAVE');
    // fmt
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    // data
    writeString(view, 36, 'data');
    view.setUint32(40, bytes.length, true);

    const payload = new Uint8Array(buffer, 44);
    payload.set(bytes);

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

export const generateVoiceover = async (text: string, voiceName: string = 'Kore'): Promise<string | null> => {
    // Use Retry for Voice as well
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName }
                    }
                }
            }
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            const blob = pcmToWavBlob(audioData);
            return URL.createObjectURL(blob);
        }
        return null;
    }, 3, 2000).catch(err => {
        console.error("generateVoiceover final error", err);
        return null;
    });
};

export const suggestSFX = async (sceneDescription: string): Promise<string> => {
    return withRetry(async () => {
        try {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Suggest a single sound effect name for this scene: "${sceneDescription}". Return JUST the name (e.g. "Whoosh", "City Ambience", "Typing").`,
            });
            return response.text?.trim() || 'None';
        } catch {
            return 'None';
        }
    }, 2, 2000);
};

// --- Search & External APIs ---

export const searchImages = async (query: string): Promise<string[]> => {
    // 1. Try Google Programmable Search if key exists
    const searchKey = localStorage.getItem('google_search_key');
    const cx = localStorage.getItem('google_search_cx') || 'YOUR_CX_ID'; // Fallback or assume user configured
    if (searchKey) {
        try {
            const res = await fetch(`https://customsearch.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&key=${searchKey}&cx=${cx}&num=3`);
            const data = await res.json();
            if (data.items) return data.items.map((item: any) => item.link);
        } catch (e) {
            console.error("Google Search API failed", e);
        }
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
    } catch {
        return [];
    }
};

export const searchPixabayImages = async (query: string): Promise<string[]> => {
    const key = localStorage.getItem('pixabay_api_key');
    if (!key) return [];
    try {
        const res = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3`);
        const data = await res.json();
        return data.hits?.map((h: any) => h.webformatURL) || [];
    } catch {
        return [];
    }
};

// --- Icons ---

export const generateAIIcons = async (script: ScriptData): Promise<Overlay[]> => {
    return withRetry(async () => {
        try {
            const ai = getAI();
            const prompt = `
                Analyze this script scenes and suggest 3-5 visual icons/stickers (Overlays) to appear at specific times.
                Available Types: 'like', 'subscribe', 'notification', 'text' (use 'text' for warning/money/idea icons).
                Script Body: ${script.body.substring(0, 1000)}...
                
                Return JSON Array of objects with: type, startTime, iconName.
            `;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { 
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING },
                                startTime: { type: Type.NUMBER },
                                iconName: { type: Type.STRING }
                            }
                        }
                    }
                }
            });
            
            const suggestions = JSON.parse(response.text || "[]");
            
            return suggestions.map((s: any, i: number) => ({
                id: `ai-icon-${Date.now()}-${i}`,
                type: s.type,
                url: s.iconName === 'money' ? 'https://cdn-icons-png.flaticon.com/512/2474/2474450.png' :
                     s.iconName === 'warning' ? 'https://cdn-icons-png.flaticon.com/512/564/564619.png' :
                     'https://cdn-icons-png.flaticon.com/512/1077/1077035.png',
                startTime: s.startTime || 5,
                duration: 3,
                position: { x: 80, y: 20 }
            }));
        } catch {
            return [];
        }
    }, 2, 3000);
};
