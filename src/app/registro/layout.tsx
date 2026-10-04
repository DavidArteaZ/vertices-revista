import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registro para el evento de lanzamiento · Vértices",
  description: "Registro para el evento de lanzamiento de Vértices.",
};

export default function RegistroLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
