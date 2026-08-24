/**
 * Tipos de la base, generados con
 *
 *     mcp supabase generate_typescript_types
 *
 * Se versionan y no se generan en el build porque el build no debe depender de
 * que la base esté alcanzable. Regenerar al añadir una migración.
 *
 * Está podado a mano en dos sitios: los bloques `Relationships` quedan vacíos,
 * porque supabase-js sólo los usa para inferir `select` anidados y aquí no se
 * usan; y los ayudantes genéricos `Tables<>`/`TablesInsert<>` se sustituyen por
 * los tres de abajo. Lo que queda —Row, Insert, Update y Functions— es lo que
 * da tipo a las consultas.
 *
 * Si alguna etapa siguiente necesita `select("envios(*, envios_autoria(*))")`,
 * hay que volver a generar el archivo completo con sus Relationships: con la
 * lista vacía el tipo del join es `never` y se nota enseguida.
 */

export type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

type Fila<R, I = R, U = Partial<R>> = {
  Row: R;
  Insert: I;
  Update: U;
  Relationships: [];
};

/**
 * Insert con las columnas que la base rellena sola marcadas como opcionales:
 * identidades, `default now()` y demás. Sin esto, insertar una asignación
 * exigiría inventarse un `id` y un `asignado_at`.
 */
type Auto<R, K extends keyof R> = Omit<R, K> & Partial<Pick<R, K>>;

export type Database = {
  public: {
    Tables: {
      secciones: Fila<{
        id: number;
        numero: number | null;
        nombre_canonico: string;
        nombre_display: string;
        slug: string;
        nivel: string | null;
        descripcion: string | null;
        orden: number;
        es_asignable: boolean;
        publica: boolean;
      }>;
      temas: Fila<{ id: number; nombre: string; slug: string; orden: number }>;
      tipos_pieza: Fila<{ id: number; nombre: string; orden: number }>;
      usuarios: Fila<
        {
          id: string;
          nombre: string;
          email: string;
          activo: boolean;
          created_at: string;
          invitada_en: string | null;
          clave_fijada_en: string | null;
          invitacion_email_id: string | null;
          invitacion_estado: string | null;
        },
        Auto<
          {
            id: string;
            nombre: string;
            email: string;
            activo: boolean;
            created_at: string;
            invitada_en: string | null;
            clave_fijada_en: string | null;
            invitacion_email_id: string | null;
            invitacion_estado: string | null;
          },
          | "activo"
          | "created_at"
          | "invitada_en"
          | "clave_fijada_en"
          | "invitacion_email_id"
          | "invitacion_estado"
        >
      >;
      usuario_correos: Fila<
        { id: number; usuario_id: string; correo: string },
        Auto<{ id: number; usuario_id: string; correo: string }, "id">
      >;
      rubrica_versiones: Fila<{
        id: number;
        seccion_id: number;
        version: number;
        vigente: boolean;
        etiqueta_falla_puerta: string;
        etiqueta_falla_critico: string;
        etiqueta_pendiente: string;
        creada_at: string;
      }>;
      rubrica_puertas: Fila<{
        id: number;
        rubrica_version_id: number;
        orden: number;
        etiqueta: string;
        es_eliminatoria: boolean;
      }>;
      rubrica_dimensiones: Fila<{
        id: number;
        rubrica_version_id: number;
        orden: number;
        etiqueta: string;
        peso: number;
        es_critica: boolean;
        permite_na: boolean;
      }>;
      decisiones: Fila<{
        id: number;
        rubrica_version_id: number;
        orden: number;
        etiqueta: string;
        es_aceptante: boolean;
        es_falla: boolean;
      }>;
      bandas_decision: Fila<{
        id: number;
        rubrica_version_id: number;
        variante: number;
        min_puntaje: number;
        decision_id: number;
      }>;
      envio_folios: Fila<{ anio: number; ultimo: number }>;
      envios: Fila<{
        id: string;
        folio: string;
        titulo: string;
        tipo_pieza_id: number | null;
        seccion_id: number;
        tema_id: number | null;
        resumen: string;
        palabras_clave: string[];
        es_investigacion: boolean;
        uso_ia: string | null;
        locale: string;
        extension: string | null;
        antiplagio: string | null;
        anonimizacion_revisada_por: string | null;
        anonimizacion_revisada_at: string | null;
        nivel: string | null;
        seccion_dictamen_id: number | null;
        estado: string;
        decision_id: number | null;
        decision_final_por: string | null;
        decision_final_at: string | null;
        revision_de_envio_id: string | null;
        declaraciones: Json;
        declaraciones_at: string;
        archivado_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      envios_autoria: Fila<{
        envio_id: string;
        nombre: string;
        correo: string;
        afiliacion: string | null;
        coautores: string | null;
        genero: string | null;
        notas_internas: string | null;
      }>;
      envio_archivos: Fila<{
        id: string;
        envio_id: string;
        storage_path: string;
        nombre_publico: string;
        mime: string;
        bytes: number;
        version: number;
        es_principal: boolean;
        created_at: string;
      }>;
      envio_archivo_nombres: Fila<{ archivo_id: string; nombre_original: string }>;
      asignaciones: Fila<
        {
          id: number;
          envio_id: string;
          revisor_id: string;
          asignado_por: string | null;
          asignado_at: string;
        },
        Auto<
          {
            id: number;
            envio_id: string;
            revisor_id: string;
            asignado_por: string | null;
            asignado_at: string;
          },
          "id" | "asignado_at" | "asignado_por"
        >
      >;
      dictamenes: Fila<
        {
        id: string;
        envio_id: string;
        revisor_id: string;
        rubrica_version_id: number;
        estado: string;
        sin_conflicto: boolean;
        comentarios: string | null;
        puntaje: number | null;
        maximo: number | null;
        puertas_ok: boolean | null;
        criticos_ok: boolean | null;
        decision_sugerida_id: number | null;
        enviado_at: string | null;
        created_at: string;
        updated_at: string;
        },
        {
          id?: string;
          envio_id: string;
          revisor_id: string;
          rubrica_version_id: number;
          estado?: string;
          sin_conflicto?: boolean;
          comentarios?: string | null;
          puntaje?: number | null;
          maximo?: number | null;
          puertas_ok?: boolean | null;
          criticos_ok?: boolean | null;
          decision_sugerida_id?: number | null;
          enviado_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      dictamen_puertas: Fila<{
        dictamen_id: string;
        puerta_id: number;
        valor: boolean | null;
      }>;
      dictamen_puntajes: Fila<{
        dictamen_id: string;
        dimension_id: number;
        valor: number | null;
      }>;
      ediciones: Fila<
        {
          id: number;
          numero: number;
          titulo: string;
          estado: string;
          publicada_at: string | null;
          created_at: string;
        },
        {
          id?: number;
          numero: number;
          titulo: string;
          estado?: string;
          publicada_at?: string | null;
          created_at?: string;
        }
      >;
      articulos: Fila<
        {
        id: number;
        envio_id: string | null;
        edicion_id: number | null;
        titulo: string;
        autor: string;
        seccion_id: number;
        minutos_lectura: number | null;
        destacado: boolean;
        slug: string;
        pdf_publico_path: string | null;
        es_placeholder: boolean;
        orden: number | null;
        created_at: string;
        },
        {
          id?: number;
          envio_id?: string | null;
          edicion_id?: number | null;
          titulo: string;
          autor: string;
          seccion_id: number;
          minutos_lectura?: number | null;
          destacado?: boolean;
          slug: string;
          pdf_publico_path?: string | null;
          es_placeholder?: boolean;
          orden?: number | null;
          created_at?: string;
        }
      >;
      articulo_temas: Fila<{ articulo_id: number; tema_id: number }>;
      envio_eventos: Fila<
        {
          id: number;
          envio_id: string | null;
          actor_id: string | null;
          tipo: string;
          payload: Json;
          at: string;
        },
        {
          id?: never;
          envio_id?: string | null;
          actor_id?: string | null;
          tipo: string;
          payload?: Json;
          at?: string;
        }
      >;
    };
    Views: Record<never, never>;
    Functions: {
      consultar_estado: {
        Args: { p_folio: string; p_correo: string; p_ip_hash: string };
        Returns: Json;
      };
      crear_envio: { Args: { p: Json }; Returns: Json };
      limitar: {
        Args: { p_clave: string; p_segundos: number; p_max: number };
        Returns: boolean;
      };
      preparar_subida: { Args: { p_mime: string; p_ip_hash: string }; Returns: Json };
      subidas_huerfanas: {
        Args: { p_antiguedad?: string };
        Returns: { storage_path: string; at: string }[];
      };
      olvidar_subida: { Args: { p_path: string }; Returns: undefined };
      candidatos_asignacion: {
        Args: { p_envio: string };
        Returns: { id: string; nombre: string }[];
      };
      enviar_dictamen: {
        Args: {
          p_dictamen: string;
          p_puntaje: number;
          p_maximo: number;
          p_puertas_ok: boolean;
          p_criticos_ok: boolean;
          p_decision: number;
          p_comentarios: string | null;
        };
        Returns: undefined;
      };
      registrar_decision: { Args: { p_envio: string; p_decision: number }; Returns: undefined };
      marcar_anonimizacion: {
        Args: { p_envio: string; p_antiplagio?: string | null };
        Returns: undefined;
      };
      vincular_revision: { Args: { p_envio: string; p_original: string }; Returns: undefined };
      adjuntar_articulo: {
        Args: {
          p_envio: string;
          p_edicion: number;
          p_minutos?: number | null;
          p_temas?: number[];
        };
        Returns: number;
      };
      publicar_edicion: { Args: { p_edicion: number }; Returns: number };
      unaccent_simple: { Args: { t: string }; Returns: string };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

type Tablas = Database["public"]["Tables"];
export type Tabla<T extends keyof Tablas> = Tablas[T]["Row"];
export type Insertar<T extends keyof Tablas> = Tablas[T]["Insert"];
export type Actualizar<T extends keyof Tablas> = Tablas[T]["Update"];

/**
 * Las funciones devuelven `jsonb`, que en TypeScript es `Json` y por tanto no
 * dice nada útil en el punto de uso. Estas formas son el contrato que la
 * migración escribe; se aplican con una aserción en cada llamada, que es
 * exactamente donde hay que mirar si la migración cambia.
 */
export type RespuestaPrepararSubida =
  | { ok: true; path: string }
  | { ok: false; motivo: "limite" };

export type RespuestaCrearEnvio = { id: string; folio: string; nivel: string | null };

export type RespuestaConsultarEstado =
  | {
      ok: true;
      folio: string;
      titulo: string;
      recibido_at: string;
      decision: string | null;
    }
  | { ok: false; motivo: "limite" | "no_coincide" };
