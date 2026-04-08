import axios from "axios";
import dotenv from "dotenv";
import { GeminiService } from "./gemini_service.js";
import { WebService } from "./web_service.js";
import { YoutubeService } from "./youtube_service.js";

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!GEMINI_API_KEY || !YOUTUBE_API_KEY) {
  throw new Error(
    "One or more required API keys are not set in environment variables",
  );
}

export class SummarizeService {
  constructor(
    private webService: WebService,
    private youtubeService: YoutubeService,
    private geminiService: GeminiService,
  ) {}

  async conductSummarize(originalUrl: URL): Promise<string> {
    const isYoutube: boolean = [
      "youtube.com",
      "www.youtube.com",
      "youtu.be",
    ].some((e) => originalUrl.hostname.includes(e));

    try {
      const url = isYoutube
        ? originalUrl
        : `https://r.jina.ai/${originalUrl.href}`;
      return await this._getGenerateContent(url, isYoutube);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 451) {
        console.warn(
          "Warning: Security compromise error. We have not authority to access this site",
        );
        return await this._getGenerateContent(originalUrl.href, isYoutube);
      }
      throw e;
    }
  }

  async _getGenerateContent(
    url: URL | string,
    isYoutube: boolean,
  ): Promise<string> {
    if (isYoutube) {
      const targetUrl = typeof url === "string" ? new URL(url) : url;
      const videoInfo = await this.youtubeService.fetchYoutubeVideoInfo(
        targetUrl,
        YOUTUBE_API_KEY!,
      );
      return await this.geminiService.askGemini(
        videoInfo,
        true,
        GEMINI_API_KEY!,
      );
    } else {
      const contents = await this.webService.fetchWebContent(url);
      return await this.geminiService.askGemini(
        contents.data,
        false,
        GEMINI_API_KEY!,
      );
    }
  }
}
