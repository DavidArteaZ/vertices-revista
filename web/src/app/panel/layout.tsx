import type { Metadata } from "next";
import "./panel.css";

/**
 * El panel vive fuera de /[locale] a propósito.
 *
 * Es interno, lo usa un comité que trabaja en español, y meterlo en el
 * enrutado por idioma significaría varios cientos de cadenas nuevas sin
 * traducción en cinco idiomas —exactamente el respaldo al español que la etapa
 * 2 acepta para 94 cadenas de la revista, multiplicado por cinco—. Fuera del
 * enrutado, además, no toca en absoluto lo que mide la compuerta visual.
 *
 * La guardia de autenticación NO está aquí sino en cada página, vía
 * `exigePersonal()`. Un layout de Next no se vuelve a ejecutar en cada
 * navegación de cliente, así que confiar la autorización a un layout es
 * confiarla a algo que puede no correr.
 */

export const metadata: Metadata = {
  title: "Panel editorial · Vértices",
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preload" href="/fonts/NeueMontreal-Medium.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Garet-Book.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
