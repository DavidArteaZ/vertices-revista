# Manual: cambiar el sitio sin saber programar

Este documento es para quien mantenga la revista y no sea programador. Explica
cómo pedirle cambios al sitio a **Claude Code**, cómo revisarlos antes de que
los vea nadie, y cómo deshacerlos si salieron mal.

No hace falta entender el código. Sí hace falta entender tres cosas: **pedir**,
**revisar** y **deshacer**. Este manual va de esas tres.

Para el traspaso de cuentas, ver `docs/traspaso.md`. Para las claves y la
vigilancia diaria, `docs/operacion.md`.

---

## 1. Qué es esto y qué no es

Claude Code es un programa que se abre en una terminal, dentro de la carpeta del
proyecto, y al que se le habla en español. Lee el código de la revista, hace los
cambios que se le piden y los explica.

**No es magia y no adivina.** Cuanto más concreto el encargo, mejor sale:

> Mal: «mejora la página de equipo»
> Bien: «en la página de equipo, cambia el correo de la editora a
> editora@revista.mx y quita a la persona que ya no está en el comité»

**No publica solo.** Los cambios se quedan en tu computadora hasta que alguien
decide publicarlos. Hay un paso explícito para eso.

---

## 2. Instalación, una sola vez

Hace falta tener [Node.js](https://nodejs.org) instalado. Después, en una
terminal:

```sh
npm install -g @anthropic-ai/claude-code
```

Para trabajar, se abre la terminal en la carpeta del proyecto y se escribe:

```sh
claude
```

A partir de ahí se escribe en español y ya. Para salir, `Ctrl+C` dos veces.

La primera vez pide iniciar sesión con una cuenta de Claude. **Que sea la cuenta
institucional de la revista**, por la misma razón que todo lo demás
(`docs/traspaso.md §0`).

---

## 3. Lo que vas a querer cambiar

En cada caso, lo que va después de la flecha es literalmente lo que se escribe.

### Textos del sitio

Los textos están en seis idiomas y se generan a partir de un solo archivo. No
hay que saber cuál: se pide el cambio y Claude sabe dónde tocar y qué volver a
generar.

> «cambia el texto del botón de la portada de "Enviar artículo" a "Postular un
> artículo", en todos los idiomas»

Si solo se sabe el texto en español, se dice así y Claude avisa de qué idiomas
quedarán en español hasta que alguien traduzca.

### Contenido de una página

Quiénes somos, lineamientos, equipo:

> «en la página de lineamientos, añade un párrafo al final que diga que la
> extensión máxima es de 8.000 palabras»

### Artículos publicados

Los artículos viven en la base de datos, no en el código. **Se administran desde
el panel del comité, no desde Claude.** Publicar, despublicar y borrar son
botones del panel.

### Fechas, convocatorias, avisos

> «pon el aviso de la convocatoria abierta en la portada, con fecha límite del
> 30 de noviembre, y que desaparezca solo después de esa fecha»

### Texto de los correos automáticos

> «enséñame el texto del correo de acuse de recibo que le llega al autor»

y luego, ya viéndolo:

> «cámbialo para que también le diga que la respuesta tarda hasta ocho semanas»

### Las rúbricas de dictamen

**Aquí hay que tener cuidado.** Los ocho instrumentos de dictamen se sacaron del
Excel editorial con sus pesos y sus umbrales exactos. Cambiar una rúbrica cambia
veredictos editoriales.

Se puede hacer, pero pidiendo primero ver lo que hay:

> «enséñame las dimensiones y los pesos de la rúbrica de artículo de
> investigación, sin cambiar nada»

Y solo después decidir. Si el cambio es de fondo, que lo apruebe el comité antes
de tocarlo.

---

## 4. Revisar antes de publicar

Tres redes, de la más barata a la más lenta. Vale la pena usar las tres.

### 4.1 Las pruebas automáticas

Después de cualquier cambio:

> «corre las pruebas y dime si pasó todo»

Si algo falla, **no se publica**. Se le dice a Claude que lo arregle y se
vuelven a correr.

### 4.2 Verlo con tus propios ojos

> «levanta el sitio en local y ábrelo para que yo lo vea»

Abre el sitio en `http://localhost:3100` en tu navegador. Es tu computadora: no
lo ve nadie más.

Si tienes instalada la extensión **Claude en Chrome** (§5), Claude puede
abrirlo, navegarlo y describirte qué ve — útil para revisar los seis idiomas o
para comprobar que algo se ve bien en pantalla chica:

> «abre el sitio en el navegador, cambia a francés y dime si el menú se
> desborda»

### 4.3 La vista previa de Vercel

Cuando el cambio ya está subido, Vercel genera una dirección temporal, distinta
de la del sitio real, con el cambio aplicado. Sirve para enseñárselo al comité
antes de publicarlo.

> «sube el cambio y dame el enlace de vista previa»

---

## 5. Las conexiones (MCP)

Un MCP es un enchufe que le da a Claude acceso directo a un servicio. Sin ellos
Claude solo ve el código; con ellos ve también la base de datos, el navegador y
los despliegues.

| Conexión | Para qué sirve | Estado |
|---|---|---|
| **Supabase** | Consultar la base de datos, ver errores, revisar avisos de seguridad | Ya configurado en `.mcp.json`. Pide iniciar sesión la primera vez. |
| **Claude en Chrome** | Abrir el sitio, navegarlo y revisarlo visualmente | Se instala como extensión de Chrome. |
| **Vercel** | Ver si el despliegue salió bien y leer los errores de producción | Se añade cuando se necesite. |

Con el de Supabase conectado se pueden hacer preguntas directas, sin tocar nada:

> «¿cuántos envíos hay sin dictaminar y desde cuándo?»

> «revisa si Supabase reporta algún aviso de seguridad en la base»

Si el proyecto de Supabase se transfirió (no se creó de cero), el archivo
`.mcp.json` sigue siendo válido tal cual: el identificador del proyecto no
cambia con la transferencia.

---

## 6. Reglas de oro

1. **Un cambio a la vez.** Pedir cinco cosas juntas hace imposible saber cuál
   rompió qué.
2. **Leer lo que Claude dice que va a hacer** antes de decir que sí. Si menciona
   *borrar*, *migración* o *base de datos*, parar y preguntar por qué.
3. **Las pruebas verdes no son opcional.** Rojo es no publicar.
4. **Nada de tocar la base de datos a mano.** Los cambios en el código se
   deshacen; los de la base, no.
5. **Las claves no se pegan en un chat, ni en un correo, ni en WhatsApp.** Viven
   en Vercel y en `.env`, y en ningún otro lado.
6. **Si algo se ve raro en producción, primero volver atrás** (§7) y después
   averiguar qué pasó. En ese orden.

---

## 7. Deshacer

### El sitio publicado está mal, ahora mismo

En Vercel → *Deployments* → el despliegue anterior, el que sí servía →
**Instant Rollback**. El sitio vuelve a como estaba en segundos, sin tocar nada
de código.

Es el botón más importante de todo este manual. Vale la pena localizarlo un día
tranquilo, antes de necesitarlo.

### Un cambio en el código está mal

> «deshaz el último cambio»

Y si ya se publicó, después del rollback:

> «el cambio del aviso de convocatoria rompió la portada, deshazlo y sube la
> corrección»

### Se rompió algo y no sabes qué

> «algo dejó de funcionar en el panel. Investiga qué cambió desde ayer y
> explícamelo sin tecnicismos, sin arreglar nada todavía»

---

## 8. Cuándo llamar a alguien que sepa

Claude resuelve casi todo lo de este manual. Estas cosas piden a alguien
técnico:

- El sitio entero está caído y el rollback no lo arregla.
- Supabase avisa de que se acaba el espacio (500 MB de base, 1 GB de archivos).
- Hay que cambiar de dominio, o el certificado dejó de ser válido.
- Los correos dejaron de llegar y en Resend aparecen como rebotados.
- Alguien pide un cambio que toca cómo se guardan o se protegen los envíos.

---

## 9. Vocabulario mínimo

| Palabra | Qué es aquí |
|---|---|
| **repositorio / repo** | La carpeta con todo el código, e histórico de cada cambio. |
| **commit** | Un cambio guardado, con su explicación. |
| **desplegar / deploy** | Publicar una versión en internet. |
| **vista previa / preview** | Una dirección temporal con el cambio, que no es el sitio real. |
| **producción** | El sitio real, el que ve el público. |
| **rollback** | Volver a una versión anterior ya publicada. |
| **migración** | Un cambio en la estructura de la base de datos. Serio. |
| **variable de entorno** | Una clave o dirección que el sitio necesita y que no está en el código. |
| **cron** | Una tarea que corre sola a una hora fija. Aquí hay dos. |
| **MCP** | Un enchufe que conecta a Claude con un servicio (§5). |
