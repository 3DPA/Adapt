import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface GeneratedScene {
  visual: string;
  narration: string;
}

export async function generateStoryboard(prompt: string, sceneCount: number): Promise<GeneratedScene[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a ${sceneCount}-scene storyboard for the following prompt: "${prompt}". 
    For each scene, provide a visual description and a narration/script.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            visual: { type: Type.STRING, description: "Description of the visual scene" },
            narration: { type: Type.STRING, description: "Narration or script for the scene" },
          },
          required: ["visual", "narration"],
        },
      },
    },
  });

  return JSON.parse(response.text);
}

export async function refineScene(currentVisual: string, currentNarration: string, instruction: string): Promise<GeneratedScene> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Refine this storyboard scene based on the instruction: "${instruction}".
    Current Visual: ${currentVisual}
    Current Narration: ${currentNarration}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          visual: { type: Type.STRING },
          narration: { type: Type.STRING },
        },
        required: ["visual", "narration"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function generateSingleScene(prompt: string): Promise<GeneratedScene> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a single storyboard scene (visual description and narration) for the following prompt: "${prompt}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          visual: { type: Type.STRING },
          narration: { type: Type.STRING },
        },
        required: ["visual", "narration"],
      },
    },
  });

  return JSON.parse(response.text);
}
