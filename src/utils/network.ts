export function fetchImageAsDataUrl(url: string, timeoutMs: number): Promise<string> { // 将读取到的结果编码成Data URL字符串
  return fetchWithTimeout(url, timeoutMs)
    .then((response) => {
      if (!response.ok) {
        throw new Error("404 Not found");
      }
      if(!checkContentType(response, "image/")) {
        throw new Error("Invalid image");
      }
      return response.blob();
    })
    .then((blob) => new Promise<string>((resolve) => { // 编码
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    }),
    )
}

export function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }) // 计时器信号
    .catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new TimeoutError(`Request timed out: ${url}`);
      }
      throw error;
    })
    .finally(() => {
      window.clearTimeout(timer);
    });
}

export function checkContentType(response: Response, type: string): boolean {
  const contentType = response.headers.get("Content-Type");
  return !!contentType && contentType.startsWith(type);
}
  
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}