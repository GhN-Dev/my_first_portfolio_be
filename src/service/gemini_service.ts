import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
  constructor() {}
  async askGemini(
    contents: string,
    isYoutube: boolean = false,
    GEMINI_API_KEY: string,
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = isYoutube
      ? `以下のYouTube動画のメタデータ（タイトルと概要欄）から、動画の【主旨】と【重要なポイント】を3〜5行で要約してください。宣伝やリンクは無視してください。\n\n${contents}`
      : `以下のWeb記事のテキストから、重要な情報を抽出し、見出しをつけて分かりやすく構造化して要約してください。400文字程度で。\n\n${contents}`;
    return (await model.generateContent(prompt)).response.text();
  }
}
