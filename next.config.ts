import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/map",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/aida-public/**",
      },
      {
        protocol: "http",
        hostname: "52.79.250.143",
        port: "8000",
        pathname: "/api/v1/images/**",
      },
      {
        protocol: "https",
        hostname: "www.lost112.go.kr",
        pathname: "/lostnfs/images/**",
      },
      {
        protocol: "https",
        hostname: "minwon24.police.go.kr",
        pathname: "/lost112/find/getOpenapiAttachFileImage/**",
      },
    ],
  },
};

export default nextConfig;
