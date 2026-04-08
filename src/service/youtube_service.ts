import axios from "axios";

export class YoutubeService {
  constructor() {}
  async fetchYoutubeVideoInfo(
    url: URL,
    YOUTUBE_API_KEY: string,
  ): Promise<string> {
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
          timeout: 5000, // 5 seconds timeout
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
}
