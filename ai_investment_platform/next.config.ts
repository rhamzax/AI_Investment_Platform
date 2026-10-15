import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack to this folder — otherwise it picks the repo root and
  // watches backend/venv and testing_scripts too.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
