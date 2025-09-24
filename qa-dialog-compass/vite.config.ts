import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const base = env.VITE_BASE_PATH || "/";
  const devHost = env.VITE_DEV_SERVER_HOST || "::";
  const devPort = Number(env.VITE_DEV_SERVER_PORT || 8080);
  const proxyTarget = env.VITE_DEV_API_PROXY_TARGET || "http://localhost:13886";
  const previewHost = env.VITE_PREVIEW_HOST || "0.0.0.0";
  const previewPort = Number(env.VITE_PREVIEW_PORT || 8080);

  return {
    base,
    server: {
      host: devHost,
      port: devPort,
      allowedHosts: ["autoqa.trieungoctam.site", "localhost", "127.0.0.1"],
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: previewHost,
      port: previewPort,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
