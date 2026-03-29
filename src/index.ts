import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import express, { type Response as ExpressResponse } from "express";
import axios from "axios";
import { SummarizeRequest } from "./interface/summarize.js";
import cors from "cors";

dotenv.config();
const API_KEY = process.env.GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY || !YOUTUBE_API_KEY) {
  throw new Error(
    "One or more required API keys are not set in environment variables",
  );
}
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.post("/summarize", async (req, res) => {
  const body = req.body as SummarizeRequest;
  const { url } = body;

  if (!url || typeof url !== "string") {
    return res
      .status(422)
      .json({ error: "Invalid input", details: "URL must be a string" });
  }

  try {
    const processedUrl = new URL(url);
    const result = await _conductSummarize(processedUrl);
    return res.json({ result });
  } catch (e: any) {
    const statusCode = e.name === "ValidationError" ? 422 : 500;
    return res.status(statusCode).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on : http://localhost:${PORT}`);
});

async function _conductSummarize(originalUrl: URL): Promise<string> {
  const isYoutube: boolean = [
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
  ].some((e) => originalUrl.hostname.includes(e));

  try {
    const url = isYoutube
      ? originalUrl
      : `https://r.jina.ai/${originalUrl.href}`;
    return await _getGenerateContent(url, isYoutube);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 451) {
      console.warn(
        "Warning: Security compromise error. We have not authority to access this site",
      );
      return await _getGenerateContent(originalUrl.href, isYoutube);
    }
    throw e;
  }
}

async function _getGenerateContent(
  url: URL | string,
  isYoutube: boolean,
): Promise<string> {
  if (isYoutube) {
    const targetUrl = typeof url === "string" ? new URL(url) : url;
    const videoInfo = await _extractYoutubeVideoInfo(targetUrl);
    return await _askGemini(videoInfo, true);
  } else {
    const targetUrlString = typeof url === "string" ? url : url.href;
    const contents = await axios.get(targetUrlString);
    return await _askGemini(contents.data);
  }
}

async function _extractYoutubeVideoInfo(url: URL): Promise<string> {
  const vParam = url.searchParams.get("v");
  const match = url.pathname.match(
    /(?:^\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{11})(?:$|\/|\?)/,
  );
  const videoId = vParam ? vParam : match ? match[1] : null;

  if (!videoId)
    throw new Error(
      "動画IDが見つかりません。有効なYouTube URLを入力してください。",
    );

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`;
  try {
    const apiResponse = await axios.get(apiUrl, {
      headers: {
        "X-Goog-Api-Key": YOUTUBE_API_KEY,
      },
    });

    const item = apiResponse.data.items[0];
    if (!item) throw new Error("Video not found please check the URL");

    const snippet = item.snippet;
    return `
    動画タイトル: ${snippet.title}
    チャンネル名: ${snippet.channelTitle}
    動画の説明文: ${snippet.description}
  `;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      switch (e.response?.status) {
        case 403:
          throw new Error(
            "You reached the Youtube Data API quota limit. Please try again later or check your API key",
          );
        case 404:
          throw new Error("Video not found. Please check the URL");
      }
    }
    throw new Error(
      `Error occurred while requesting YouTube Data API: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function _askGemini(
  contents: string,
  isYoutube: boolean = false,
): Promise<string> {
  const prompt = isYoutube
    ? `以下のYouTube動画のメタデータ（タイトルと概要欄）から、動画の【主旨】と【重要なポイント】を3〜5行で要約してください。宣伝やリンクは無視してください。\n\n${contents}`
    : `以下のWeb記事のテキストから、重要な情報を抽出し、見出しをつけて分かりやすく構造化して要約してください。400文字程度で。\n\n${contents}`;
  return (await model.generateContent(prompt)).response.text();
}
