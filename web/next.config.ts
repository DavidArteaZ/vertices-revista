import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Hay un package-lock.json suelto en el directorio padre, fuera del repo.
  // Sin esto, Turbopack lo detecta y advierte en cada build.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
