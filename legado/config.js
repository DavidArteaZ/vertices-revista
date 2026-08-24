/* Configuración por despliegue del sitio Vértices.
   VERTICES_API: URL del backend del registro (https, sin diagonal final).
   Vacío = el sitio decide solo: localhost usa el servidor de pruebas y en
   internet queda en modo maqueta, salvo que la URL traiga ?api=https://...
   (ver la resolución de API_BASE en index.html). */
window.VERTICES_API = "https://vertices-registro.vertices.workers.dev";

/* VERTICES_W3F: llave de acceso de Web3Forms (web3forms.com) asociada al buzón
   que vigila el flujo de Power Automate. Con la llave puesta, cuando la API no
   responde el registro viaja como correo estructurado [REGISTRO-VERTICES] y el
   flujo escribe la fila en el Excel y manda el folio al autor. La llave está
   diseñada para ser pública (vive en el navegador), no es un secreto. */
window.VERTICES_W3F = "";
