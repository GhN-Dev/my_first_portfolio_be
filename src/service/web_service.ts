import axios from "axios";

export class WebService {
  constructor() {}
  async fetchWebContent(url: URL | string) {
    const targetUrlString = typeof url === "string" ? url : url.href;
    return await axios.get(targetUrlString);
  }
}
