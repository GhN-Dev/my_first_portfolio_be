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
    return res.status(400).json({ error: "URL is invalid or null" });
  }

  try {
    const processedUrl = new URL(url);
    await _conductSummarize(processedUrl, res);
  } catch (e) {
    return res
      .status(400)
      .json({ error: "Invalid URL, please enter valid URL" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on : http://localhost:${PORT}`);
});

async function _conductSummarize(
  originalUrl: URL,
  response: ExpressResponse,
): Promise<void> {
  const isYoutube: boolean = [
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
  ].some((e) => originalUrl.hostname.includes(e));

  try {
    const url = isYoutube
      ? originalUrl
      : `https://r.jina.ai/${originalUrl.href}`;
    const result = await _getGenerateContent(url, isYoutube);
    response.json({ result });
  } catch (e) {
    // if 451 error occurred, use normal url
    if (axios.isAxiosError(e) && e.response?.status === 451) {
      try {
        const result = await _getGenerateContent(originalUrl.href, isYoutube);
        console.warn(
          "Warning: Security compromise error. We have not authority to access this site",
        );
        response.json({ result });
        return;
      } catch (e) {
        console.error(e);
        response.status(500).json({ error: "Failed to summarize" });
        return;
      }
    }
    console.error(e);
    response.status(500).json({ error: "Failed to summarize" });
    return;
  }
}

async function _getGenerateContent(
  url: any,
  isYoutube: boolean,
): Promise<string> {
  if (isYoutube) {
    const videoId = url.searchParams.get("v") || url.pathname.slice(1);
    if (!videoId || videoId === "watch") {
      throw new Error("Invalid Youtube URL");
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
    const apiResponse = await axios.get(apiUrl);
    const item = apiResponse.data.items[0];
    if (!item) {
      throw new Error("Video not found please check the URL");
    }
    const snippet = item.snippet;
    const info = `
    動画タイトル: ${snippet.title}
    チャンネル名: ${snippet.channelTitle}
    動画の説明文: ${snippet.description}
  `;

    return await _askGemini(info, true);
  } else {
    const contents = await axios.get(url);
    return await _askGemini(contents.data);
  }
}

async function _askGemini(
  contents: string,
  isYoutube: boolean = false,
): Promise<string> {
  const subInfo = isYoutube ? "動画" : "サイト";
  const prompt = `以下の情報をもとに${subInfo}の内容を、わかりやすく要約してください
【内容】
${contents}
`;
  return (await model.generateContent(prompt)).response.text();
}
