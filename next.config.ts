import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const conIntl = createNextIntlPlugin("./src/i18n/peticion.ts");

const nextConfig: NextConfig = {
  // El dictamen puede adjuntar PDF/DOCX de hasta 20 MB. Server Actions limita
  // el body a 1 MB por defecto, así que dejamos margen para multipart.
  experimental: {
    serverActions: { bodySizeLimit: "21mb" },
  },

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

export default conIntl(nextConfig);
