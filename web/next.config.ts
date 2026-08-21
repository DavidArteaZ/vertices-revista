import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Hay un package-lock.json suelto en el directorio padre, fuera del repo.
  // Sin esto, Turbopack lo detecta y advierte en cada build.
  turbopack: { root: path.resolve(__dirname) },

  // Todas las rutas cambian al pasar al App Router. mision-ds y vision-ds son
  // hoy stubs con <meta refresh> y deben seguir funcionando.
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/lineamientos.html", destination: "/lineamientos", permanent: true },
      { source: "/quienes-somos.html", destination: "/quienes-somos", permanent: true },
      { source: "/equipo-ds.html", destination: "/equipo", permanent: true },
      { source: "/mision-ds.html", destination: "/quienes-somos#mision", permanent: true },
      { source: "/vision-ds.html", destination: "/quienes-somos#vision", permanent: true },
    ];
  },
};

export default nextConfig;
