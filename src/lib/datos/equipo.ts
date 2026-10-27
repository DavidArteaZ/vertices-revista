/**
 * Quién hace la revista. Transcrito de directorio.csv, el que mantiene el
 * comité; los nombres de archivo de las fotos son los de esa misma carpeta,
 * recortadas al rostro y servidas desde public/equipo/.
 *
 * El orden de `areas` importa: la primera da el color de la burbuja y la
 * segunda, el anillo. Las áreas son claves y no texto porque su nombre se
 * traduce (espacio `equipo` de claves.json).
 *
 * Los correos se publican a sabiendas: el comité confirmó que pueden salir
 * las matrículas.
 */

export type AreaId = "dir" | "con" | "ced" | "dis" | "cyd" | "fot";

export type Integrante = {
  nombre: string;
  foto: string;
  areas: AreaId[];
  linkedin?: string;
  correo?: string;
  /** cuenta de Instagram que hace de portafolio */
  portafolio?: string;
};

export const INTEGRANTES: Integrante[] = [
  { nombre: "Paola Gil", foto: "paola", areas: ["dir", "dis"], linkedin: "https://www.linkedin.com/in/paola-gil-s%C3%A1nchez-a67b672b5/", correo: "A01663011@tec.mx" },
  { nombre: "Yun Muñoz", foto: "yunuen", areas: ["dir"], linkedin: "https://www.linkedin.com/in/yunu%C3%A9n-mu%C3%B1oz-matias-a7211b38b/", correo: "A01663978@tec.mx" },
  { nombre: "Elías Mota", foto: "elias", areas: ["dir", "con"], linkedin: "https://www.linkedin.com/in/eliasmota/", correo: "A01660245@tec.mx" },
  { nombre: "David Arteaga", foto: "david", areas: ["dir", "ced"], linkedin: "https://www.linkedin.com/in/davidarteaz/", correo: "A01067617@tec.mx" },
  { nombre: "Andrés Felipe Gutiérrez", foto: "andres_felipe", areas: ["dir", "con"], linkedin: "https://www.linkedin.com/in/afgutierrezj/", correo: "A01710308@tec.mx" },
  { nombre: "Zoe Mendoza", foto: "zoe", areas: ["cyd", "fot"], linkedin: "https://www.linkedin.com/in/ximena-zoe-camacho-mendoza-304a27388/", correo: "A01799101@tec.mx" },
  { nombre: "Mau Berdón", foto: "mau", areas: ["fot"], linkedin: "https://www.linkedin.com/in/mauricio-berd%C3%B3n-garc%C3%ADa-b51a29356/", correo: "a01660836@tec.mx" },
  { nombre: "Rebeca Hernández", foto: "rebeca", areas: ["ced"], linkedin: "https://www.linkedin.com/in/rebeca-hernandez-j", correo: "A01751725@tec.mx" },
  { nombre: "Jaime Alonso Chagoya", foto: "jaime_alonso", areas: ["ced"], correo: "A01661630@tec.mx" },
  { nombre: "Nemecio Aguirre", foto: "nemecio", areas: ["con", "ced"], linkedin: "https://www.linkedin.com/in/luis-nemecio-aguirre-flores/", correo: "A01705560@tec.mx" },
  { nombre: "Rafa Moreno", foto: "rafa", areas: ["dis"], correo: "A01663045@tec.mx", portafolio: "https://www.instagram.com/flamingdesiretobgay/" },
  { nombre: "Dulce Arciniega", foto: "dulce", areas: ["dis"], linkedin: "https://www.linkedin.com/in/dulce-estefan%C3%ADa-arciniega-bustos-461064388/", correo: "a01661976@tec.mx" },
  { nombre: "Daniela Martínez", foto: "daniela", areas: ["cyd", "dis"], linkedin: "https://www.linkedin.com/in/daniela-mart%C3%ADnez-arechiga-262692442", correo: "A01661132@tec.mx" },
  { nombre: "Ana Pau Armendáriz", foto: "ana_pau", areas: ["dis"], linkedin: "https://www.linkedin.com/in/ana-paula-a-1a4aa8301", correo: "A01659442@tec.mx", portafolio: "https://www.instagram.com/aahotline/" },
];

/** El asesor va aparte: no pertenece a un área y no se une a nada. */
export const ASESOR: Integrante = {
  nombre: "Marco Méndez",
  foto: "marco",
  areas: [],
  linkedin: "https://www.linkedin.com/in/marcomna/",
  correo: "marco.mendez@tec.mx",
};
