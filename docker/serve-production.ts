import app from "./dist/server/server.js";

const ASSET_PREFIX = "/assets/";
const CLIENT_DIR = new URL("./dist/client/", import.meta.url);

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function contentTypeFor(pathname: string): string {
  const dot = pathname.lastIndexOf(".");
  const ext = dot >= 0 ? pathname.slice(dot).toLowerCase() : "";
  return contentTypes[ext] ?? "application/octet-stream";
}

function clientAssetUrl(pathname: string): URL | null {
  if (!pathname.startsWith(ASSET_PREFIX)) return null;

  const relativePath = decodeURIComponent(pathname.slice(1));
  if (relativePath.includes("..") || relativePath.startsWith("/")) return null;

  return new URL(relativePath, CLIENT_DIR);
}

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

Bun.serve({
  port,
  hostname,
  async fetch(request, server) {
    const url = new URL(request.url);
    const assetUrl = clientAssetUrl(url.pathname);

    if (assetUrl) {
      const file = Bun.file(assetUrl);
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
            "content-type": contentTypeFor(url.pathname),
          },
        });
      }
    }

    return app.fetch(request, { server }, {});
  },
});

console.log(`Started server: http://localhost:${port}`);
