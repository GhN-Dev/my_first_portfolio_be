import express, { type Response as ExpressResponse } from "express";
import { SummarizeRequest } from "./interface/summarize.js";
import cors from "cors";
import { WebService } from "./service/web_service.js";
import { YoutubeService } from "./service/youtube_service.js";
import { GeminiService } from "./service/gemini_service.js";
import { SummarizeService } from "./service/summarize_service.js";

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
    const summarizeService = new SummarizeService(
      new WebService(),
      new YoutubeService(),
      new GeminiService(),
    );
    const result = await summarizeService.conductSummarize(new URL(url));
    return res.json({ result });
  } catch (e: any) {
    const statusCode = e.name === "ValidationError" ? 422 : 500;
    return res.status(statusCode).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on : http://localhost:${PORT}`);
});
