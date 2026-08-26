# Traducciones de la revista

Aquí vive el texto traducido que mantiene el comité. Un archivo por idioma:
`en.json`, `fr.json`, `it.json`, `pt.json`, `ru.json`. El español no lleva
archivo — es el original, y vive en `../claves.json`.

## Por qué existe esta carpeta

Las traducciones del sitio viejo están en `legado/`, que no se toca: es la
referencia contra la que se compara que el sitio nuevo se vea igual. Eso dejaba
sin salida a cualquier frase escrita después: no había dónde traducirla, así que
salía en español en los seis idiomas para siempre.

Esta carpeta es esa salida. Lo que esté aquí gana al legado, así que también
sirve para corregir una traducción heredada que esté mal.

## Cómo traducir una frase

1. Busca su clave en `../claves.json`. Se ve así:

   ```json
   "camposarchivosenvio": {
     "foto_suya": "Foto suya *"
   }
   ```

   La clave completa es el espacio y el nombre juntos: `camposarchivosenvio.foto_suya`.

2. Añádela al archivo del idioma, con el texto traducido:

   ```json
   {
     "camposarchivosenvio.foto_suya": "Votre photo *"
   }
   ```

3. Corre `npm run i18n:generar` y luego `npm test`.

Lo que no esté aquí sigue saliendo en español. No hace falta traducir un idioma
entero de una vez: se puede ir frase por frase.

## Las tres cosas que se rompen y cómo evitarlas

**Los `{…}` son huecos, no texto.** En `{n} palabras`, el `{n}` es un número que
pone el programa. Tiene que aparecer igual en la traducción: `{n} words`. Si se
pierde, el número desaparece de la pantalla. `npm test` lo caza.

**Los plurales tienen su propia forma.** Una frase así:

```
{n, plural, one {# palabra} other {# palabras}}
```

significa «si es uno, *palabra*; si no, *palabras*», y el `#` es el número.
Español e inglés tienen dos formas, pero **el ruso tiene tres** (`one`, `few`,
`other`) y hay lenguas con más. Al traducir al ruso hay que escribir las que esa
lengua necesite, no copiar las dos del español.

**Si alguien reescribe la frase en español, su clave cambia.** La clave se
calcula a partir del texto, así que «Foto suya \*» y «Tu foto \*» son claves
distintas. La traducción vieja se queda colgando de una clave que ya no existe;
`npm test` la señala como *sobra*. Cuando pase: mover la traducción a la clave
nueva y revisar que siga diciendo lo mismo, porque el original cambió.

## Cómo saber cuánto falta

`npm run i18n:generar` lo dice al terminar, idioma por idioma:

```
en: 618 claves, 61 de traducciones/, 105 en español por falta de traducción
```
