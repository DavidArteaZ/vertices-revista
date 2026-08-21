import type { Metadata } from "next";
import "./globals.css";

// Emblema de Vértices en línea, igual que en el sitio original (index.html:10)
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg fill='none' stroke='%232d232e' stroke-width='1.6'%3E%3Cpath d='M16 4 L28 26 L4 26 Z'/%3E%3Cpath d='M16 4 L17 18.5 M4 26 L17 18.5 M28 26 L17 18.5' opacity='.55'/%3E%3C/g%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Vértices · Revista académica de economía · Sistema de diseño",
  description:
    "Vértices es la revista académica de economía creada por la comunidad estudiantil de la Licenciatura en Economía del Tec de Monterrey, Campus Ciudad de México. Rigurosa en evidencia y amable en lectura. Explora por tema y sección, y publica tu trabajo.",
  openGraph: {
    title: "Vértices · Revista académica de economía",
    description:
      "El punto donde las ideas se conectan. Explora la revista y publica tu trabajo.",
  },
  icons: { icon: FAVICON },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <link rel="preload" href="/fonts/NeueMontreal-Medium.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/NeueMontreal-Bold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Garet-Book.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
