<!--
  Quien puede abrir una pagina, como un catalogo de etiquetas que se encienden.

  Es la misma pieza que `cells/MultiSelect`: una caja con las opciones dentro,
  cada una una etiqueta que se marca. Se escribe aqui y no se reusa aquella
  porque `Todos` no es un rol mas --es excluyente, y se apaga a mano-- y meterla
  en la celda de la rejilla le anadiria un caso que ninguna celda necesita.

  Son tres estados y se leen en una sola linea de etiquetas:

  - `Todos` encendido: la lista de roles esta vacia y la abre cualquiera que
    alcance la aplicacion.
  - `Todos` apagado y ningun rol marcado: solo `admin`, o sea solo quien
    construye. Es como se guarda una pagina a medias sin que nadie la vea.
  - Roles marcados: esos, y `admin` con ellos.

  `Todos` no se guarda: es la consecuencia de que la lista este vacia, asi que
  no hay dos estados que puedan discrepar. Ver `design.md` D2.

  `admin` no sale como etiqueta: no es una opcion --esta siempre puesto en
  cuanto la pagina deja de ser de todos, porque quien construye mira sus propias
  paginas con ese rol-- y una etiqueta que no se puede apagar solo ocupa sitio.
  Lo pone `withPageAdmin` al guardar y lo cuenta la nota de abajo. Ver
  `shared/pages.ts`.
-->
<script lang="ts">
  import { withPageAdmin } from "@shared/pages";
  import { ADMIN_ROLE } from "@shared/people";

  import { Tag } from "./ui";

  let {
    roles,
    appRoles,
    onChange,
  }: {
    /** Roles marcados. Vacio: la abre cualquiera que alcance la aplicacion. */
    roles: string[];
    /** Los roles que define la aplicacion. */
    appRoles: string[];
    onChange: (next: string[]) => void;
  } = $props();

  const everyone = $derived(roles.length === 0);
  /** Los roles que se marcan a mano: `admin` va aparte, y siempre puesto. */
  const others = $derived(appRoles.filter((r) => r !== ADMIN_ROLE));
  /** Ni todos ni ningun rol: solo quien construye. */
  const adminOnly = $derived(!everyone && !roles.some((r) => r !== ADMIN_ROLE));

  /*
   * Marcar un rol limita la pagina, y una pagina limitada lleva `admin`
   * siempre. Quitar el ultimo rol propio no repone `Todos`: deja la pagina en
   * "solo quien construye", que es lo que se pidio al apagarlo.
   */
  function toggle(role: string) {
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    onChange(next.some((r) => r !== ADMIN_ROLE) ? withPageAdmin(next) : [ADMIN_ROLE]);
  }
</script>

<div class="picker-page-access flex flex-col gap-2">
  <div class="box-page-access inset flex flex-wrap">
    <!--
      Apagar `Todos` no deja la pagina sin nadie que la abra: la deja en
      `admin`, que es quien construye. Por eso se puede pulsar en los dos
      sentidos y no hace falta protegerla.
    -->
    <Tag
      class="btn-page-access-everyone"
      tone={everyone ? "tint-1" : "off"}
      ariaLabel="Todos, cualquiera que alcance la aplicación"
      tip={everyone
        ? "Cualquiera que alcance la aplicación; apágalo y solo lo verá quien construye"
        : "Que lo abra cualquiera que alcance la aplicación"}
      pressed={everyone}
      onclick={() => onChange(everyone ? [ADMIN_ROLE] : [])}
    >
      Todos
    </Tag>

    {#each others as role (role)}
      {@const marked = roles.includes(role)}
      <Tag
        class="btn-page-access-role"
        tone={marked ? "tint-1" : "off"}
        ariaLabel={`Rol ${role}`}
        pressed={marked}
        onclick={() => toggle(role)}
      >
        {role}
      </Tag>
    {/each}

    {#if others.length === 0}
      <span class="empty-page-access">
        Esta aplicación todavía no tiene más roles. Se crean desde la tabla "Personas y roles", en
        la base de datos.
      </span>
    {/if}
  </div>

  {#if adminOnly}
    <p class="note-page-access">
      Solo quien construye la aplicación: se ve al construir y en la vista previa, pero no aparece
      para quien entre a la aplicación.
    </p>
  {:else if !everyone}
    <p class="note-page-access">
      Hace falta entrar con una cuenta y tener alguno de los roles marcados, aunque la aplicación
      sea pública. Quien construye lo ve siempre.
    </p>
  {/if}
</div>

<style>
  .picker-page-access {
    /* Las clases propias no llevan `tag-` delante: `.tag` da el contorno de la
       etiqueta sin marcar con `:not([class*="tag-"])`, y una clase que lo
       nombrara dejaria las opciones apagadas sin borde ninguno. */
    /* La caja es `.inset` del catalogo, la misma de `cells/MultiSelect`: las
       opciones dentro de un solo contorno, para que marcar roles se vea igual
       aqui que en la rejilla. */
    & .box-page-access {
      gap: var(--sp-6);
      align-items: center;
    }

    & .empty-page-access,
    & .note-page-access {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }
  }
</style>
