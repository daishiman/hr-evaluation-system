import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
};

export default nextConfig;

// 開発時に .wrangler のローカルD1バインディングを Next dev から使えるようにする
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
