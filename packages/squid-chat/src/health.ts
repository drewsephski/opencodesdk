import { get } from "http";

function httpGet(url: string): Promise<number> {
  return new Promise((resolve) => {
    const req = get(url, (res) => {
      res.resume();
      resolve(res.statusCode ?? 500);
    });
    req.on("error", () => resolve(500));
    req.setTimeout(3000, () => { req.destroy(); resolve(500); });
  });
}

export async function healthCheck(uiUrl: string, opencodeUrl?: string): Promise<boolean> {
  const uiHealthy = await httpGet(`${uiUrl}/api/health`);
  if (uiHealthy !== 200) return false;

  if (opencodeUrl) {
    const opencodeHealthy = await httpGet(`${opencodeUrl}/health`);
    if (opencodeHealthy !== 200) return false;
  }

  return true;
}
