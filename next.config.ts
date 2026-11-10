import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false, // hide the floating "N" button in dev
  // `make install` asks for a copy of the app that runs without this repo's node_modules
  output: process.env.DATLAS_BUNDLE ? "standalone" : undefined,
};

export default nextConfig;
