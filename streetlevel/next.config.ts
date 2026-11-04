import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        // The JSON API feeds the pages; it is not a page. `robots.txt` asks
        // crawlers not to fetch it, and this keeps any API URL that gets
        // linked from elsewhere out of the index regardless.
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
