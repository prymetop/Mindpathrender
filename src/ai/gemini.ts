import type { AIProvider, ChatTurn, Env } from "../types";
import { buildSystemPrompt } from "../core/prompt";

export class GeminiProvider implements AIProvider {
  constructor(private readonly env: Env) {}

  async generate(input: {
    history: ChatTurn[];
    firstName: string;
    userText?: string;
    image?: { mimeType: string; dataBase64: string };
  }): Promise<string> {
    if (!this.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");

    const model = this.env.GEMINI_MODEL || "gemini-3.6-flash";
    const contents = input.history.map(turn => ({
      role: turn.role,
      parts: turn.parts
    }));

    const parts: Array<Record<string, unknown>> = [];
    if (input.userText) parts.push({ text: input.userText });
    if (input.image) {
      parts.push({
        inline_data: {
          mime_type: input.image.mimeType,
          data: input.image.dataBase64
        }
      });
    }
    if (parts.length) contents.push({ role: "user", parts });

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(input.firstName) }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API ${response.status}: ${(await response.text()).slice(0, 1000)}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    };

    const text = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? "")
      .join("")
      .trim();

    if (!text) throw new Error("Gemini returned no text.");
    return text;
  }
}
