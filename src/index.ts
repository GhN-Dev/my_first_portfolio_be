import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import { SummarizeRequest } from "./interface/summarize.js";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.post("/summarize", async (req, res) => {
  const body = req.body as SummarizeRequest;
  const { url } = body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "URL is invalid or null" });
    return;
  }

  try {
    const processedUrl = new URL(url);
    await _conductSummarize(processedUrl, res);
  } catch {
    res.status(400).json({ error: "Invalid URL, please enter valid URL" });
    return;
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on : http://localhost:${PORT}`);
});

async function _conductSummarize(url: URL, response: any): Promise<void> {
  try {
    const jinaUrl = `https://r.jina.ai/${url.href}`;
    const result = await _getGenerateContentWithWeb(jinaUrl);
    response.json({ result });
  } catch (e) {
    // if 451 error occurred, use normal url
    if (axios.isAxiosError(e) && e.response?.status === 451) {
      try {
        const result = await _getGenerateContentWithWeb(url.href);
        console.warn(
          "Warning: Security compromise error. We have not authority to access this site",
        );
        return response.json({ result });
      } catch (e) {
        console.error(e);
        response.status(500).json({ error: "Failed to summarize" });
      }
    }
    console.error(e);
    response.status(500).json({ error: "Failed to summarize" });
  }
}

async function _getGenerateContentWithYoutube(url: string): Promise<string> {
  const response = await axios.get(url);
  const prompt = `
  以下のYouTube動画の字幕データから、動画の内容を日本語で要約してください。
 【出力構成】
  1. 一言でいうと：動画のメインテーマを30文字以内で
  2. 重要なポイント：箇条書きで3〜5点
  3. まとめ：どういう内容なのか

 【字幕データ】
 ${response}
 `;
  return (await model.generateContent(prompt)).response.text();
}

async function _getGenerateContentWithWeb(url: string): Promise<string> {
  const response = await axios.get(url);
  const prompt = `
  以下のWebサイトの内容を、重要なポイントを逃さず日本語で要約してください。

 【出力のルール】
 ・最初に「この記事が何を伝えているか」を1文で説明してください。
 ・次に、重要な詳細を箇条書きで3つ程度にまとめてください。
 ・AIの事前知識は使わず、以下の【提供された情報】のみをもとに記述してください。

 【提供された情報】:
 ${response.data}
 `;
  return (await model.generateContent(prompt)).response.text();
}
