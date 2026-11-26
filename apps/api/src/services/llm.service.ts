import { GoogleGenAI } from "@google/genai";

export interface LlmGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export class LlmService {
  private static getGeminiClient(): GoogleGenAI | null {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    try {
      return new GoogleGenAI({ apiKey: key });
    } catch {
      return null;
    }
  }

  /**
   * Generates text using the best available LLM provider in cascade:
   * 1. Google GenAI (gemini-3.8-flash / gemma-4-26b-a4b-it)
   * 2. OpenRouter (nvidia/nemotron-3-ultra-550b-a55b:free)
   * 3. Hugging Face Router
   */
  public static async generateCompletion(
    prompt: string,
    options: LlmGenerationOptions = {}
  ): Promise<string> {
    const gemini = this.getGeminiClient();
    const systemInstruction = options.systemPrompt || "You are TracePilot AI, an elite software reliability and automated website QA engineer.";

    // 1. Google GenAI Provider
    if (gemini) {
      const geminiModels = [
        process.env.GEMINI_MODEL || "gemini-3.8-flash",
        "gemma-4-26b-a4b-it",
        process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash"
      ];

      for (const model of geminiModels) {
        try {
          console.log(`[LlmService] Trying Google GenAI (${model})...`);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout calling ${model}`)), 8000)
          );

          const response = await Promise.race([
            gemini.models.generateContent({
              model,
              contents: `${systemInstruction}\n\n${prompt}`
            }),
            timeoutPromise
          ]);

          if (response?.text) {
            console.log(`[LlmService] Successfully generated completion with Google GenAI (${model})`);
            return response.text.trim();
          }
        } catch (err: any) {
          console.warn(`[LlmService] Google GenAI (${model}) failed: ${err.message?.slice(0, 100)}`);
          if (err.message?.includes("429") || err.message?.includes("quota")) {
            console.warn("[LlmService] Google GenAI quota reached, immediately switching to OpenRouter");
            break;
          }
        }
      }
    }

    // 2. OpenRouter Provider
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      const orModels = [
        process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free",
        "nvidia/nemotron-3-ultra-550b-a55b:free"
      ];

      for (const orModel of orModels) {
        try {
          console.log(`[LlmService] Trying OpenRouter (${orModel})...`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openRouterKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://tracepilot.dev",
              "X-Title": "TracePilot"
            },
            body: JSON.stringify({
              model: orModel,
              messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
              ]
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const content = data?.choices?.[0]?.message?.content;
            if (content) {
              console.log(`[LlmService] Successfully generated completion with OpenRouter (${orModel})`);
              return content.trim();
            }
          }
        } catch (orErr: any) {
          console.warn(`[LlmService] OpenRouter (${orModel}) failed: ${orErr.message}`);
        }
      }
    }

    // 3. Hugging Face Router Provider
    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (hfToken) {
      const hfModel = process.env.HF_MODEL || "deepseek-ai/DeepSeek-V4.1-Flash-1017:novita";
      try {
        console.log(`[LlmService] Trying Hugging Face Router (${hfModel})...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: hfModel,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: prompt }
            ]
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            console.log(`[LlmService] Successfully generated completion with Hugging Face (${hfModel})`);
            return content.trim();
          }
        }
      } catch (hfErr: any) {
        console.warn(`[LlmService] Hugging Face failed: ${hfErr.message}`);
      }
    }

    throw new Error("All configured LLM providers failed or are unavailable.");
  }

  /**
   * Generates a strongly typed JSON object using the LLM.
   */
  public static async generateJson<T>(
    prompt: string,
    schemaDescription: string
  ): Promise<T | null> {
    const jsonPrompt = `${prompt}

IMPORTANT: You MUST respond ONLY with a single valid JSON object satisfying this structure:
${schemaDescription}
Do NOT include markdown formatting, backticks, or preamble text outside the JSON object.`;

    try {
      const raw = await this.generateCompletion(jsonPrompt, {
        systemPrompt: "You are an automated code and reliability analyzer. Always return strictly valid JSON."
      });

      // Extract JSON if wrapped in markdown code fence
      let clean = raw.trim();
      if (clean.startsWith("```json")) {
        clean = clean.slice(7);
      } else if (clean.startsWith("```")) {
        clean = clean.slice(3);
      }
      if (clean.endsWith("```")) {
        clean = clean.slice(0, -3);
      }
      clean = clean.trim();

      return JSON.parse(clean) as T;
    } catch (err: any) {
      console.warn(`[LlmService] JSON generation failed: ${err.message}`);
      return null;
    }
  }
}
