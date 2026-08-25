import { setRequestLocale } from "next-intl/server";
import "./globals.css";
import "./movil.css";
import Portada from "@/components/landing/Portada";
import { cargaArticulos } from "@/lib/datos/cargar-articulos";
import { routing } from "@/i18n/rutas";

/**
 * La portada, ahora con los artículos leídos de la base (spec §5.5).
 *
 * Es un componente de servidor que sólo carga datos y se los pasa a `Portada`,
 * que es el archivo que había aquí antes. La página en sí no dibuja nada: así
 * el lienzo, el carrusel y el panel de descubrimiento siguen siendo
 * exactamente el mismo código que la compuerta visual ya aprobó.
 *
 * `revalidate` en lugar de renderizar en cada petición: la portada es lo más
 * visitado del sitio y su contenido cambia cuando el comité publica un número,
 * no cuando alguien la abre. Cinco minutos de desfase entre publicar y verlo
 * es un precio razonable por servir HTML estático.
 *
 * A cambio, el build necesita alcanzar la base para prerrenderizar. Es la
 * primera dependencia de ese tipo en el proyecto y conviene tenerla presente.
 */

export const revalidate = 300;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const articulos = await cargaArticulos();
  return <Portada articulos={articulos} />;
}
