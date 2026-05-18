import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker production 이미지를 위해 standalone 출력을 활성화한다.
  // next build 가 .next/standalone 디렉터리에 node server.js + 최소 node_modules 를 모은다.
  output: "standalone",
};

export default nextConfig;
