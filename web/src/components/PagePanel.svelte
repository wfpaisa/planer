<!--
  Los ajustes de una página: como se llama, quien puede verla y si es el inicio.

  Un separador --el texto que agrupa a las páginas de alrededor-- pasa por aqui
  con menos campos, pero no con menos permiso: también dice quien lo ve. Es lo
  que hace que un grupo entero se pueda esconder sin tener que esconder a mano
  cada página de dentro, y lo que evita que a quien no le toca le quede el
  título de un grupo vacío.
-->
<script lang="ts">
  import { withPageAdmin } from "@shared/pages";
  import { ROLE_ICON } from "@shared/people";
  import type { AppRecord, PageRecord } from "@shared/types";
  import { untrack } from "svelte";

  import { aiActivity } from "../lib/aiActivity.svelte";
  import { api, errorMessage, pb, put } from "../lib/pb";
  import Icon from "./Icon.svelte";
  import IconPicker from "./IconPicker.svelte";
  import OmniPanel from "./OmniPanel.svelte";
  import PageAccessPicker from "./PageAccessPicker.svelte";
  import { Button, ConfirmDialog, ErrorNote, Field, Input, Textarea } from "./ui";

  let {
    app,
    page,
    pages,
    onClose,
    onChanged,
    onDeleted,
  }: {
    app: AppRecord;
    page: PageRecord;
    pages: PageRecord[];
    onClose: () => void;
    onChanged: () => Promise<void> | void;
    onDeleted: () => void;
  } = $props();

  /*
   * Los campos son estado propio: se escriben antes de guardar. De la página
   * sale el valor de partida --por eso `untrack`, es lo que se quiere leer una
   * sola vez-- y cambiar de página los repone en el efecto de abajo.
   */
  let name = $state(untrack(() => page.name));
  let icon = $state(untrack(() => page.icon));
  /*
   * Los roles se reponen al leerlos: una página limitada lleva `admin` aunque
   * se guardara sin el --la escribio la inteligencia artificial, o es de antes
   * de que la pantalla lo pusiera siempre--. Se repone aqui y no al guardar
   * para que lo que se ve marcado sea exactamente lo que se va a guardar.
   */
  let roles = $state<string[]>(untrack(() => withPageAdmin(page.roles ?? [])));
  let isHome = $state(untrack(() => page.isHome));
  let busy = $state(false);
  let error = $state("");
  let deleting = $state(false);

  /*
   * La memoria no viene con la página que trae el constructor: se pide aparte.
   * Es lo que hace que la caja ensene lo que la pasada acaba de escribir en
   * cuanto la IA termina, sin esperar a que nadie recargue nada.
   */
  let memory = $state("");
  /** Todavía no llego: la caja no se toca hasta saber que dice. */
  let memoryLoading = $state(true);

  /** La IA esta trabajando en esta página: la caja se mira pero no se escribe. */
  const aiWorking = $derived(aiActivity.has(page.id));

  async function loadMemory(pageId: string) {
    memoryLoading = true;
    try {
      const res = await api<{ memoria: string }>(`/api/apps/${app.id}/paginas/${pageId}/memoria`);
      // Cambiar de página mientras esta iba de camino: lo que llega es de la
      // anterior y no tiene nada que hacer en la caja de esta.
      if (pageId !== page.id) return;
      memory = res.memoria;
    } catch (err) {
      if (pageId === page.id) error = errorMessage(err);
    } finally {
      if (pageId === page.id) memoryLoading = false;
    }
  }

  /** Como se nombra esto en los textos: la misma palabra en todos. */
  const thing = $derived(page.separator ? "separador" : "página");

  let last = untrack(() => page.id);
  $effect(() => {
    if (page.id === last) return;
    last = page.id;
    name = page.name;
    icon = page.icon;
    roles = withPageAdmin(page.roles ?? []);
    isHome = page.isHome;
    error = "";
  });

  /*
   * La memoria se lee al abrir, al cambiar de página y cada vez que la senal de
   * la IA cambia sobre esta --al empezar una petición y al terminarla--.
   *
   * Lo que importa es la vuelta: la pasada escribe la memoria al cerrar el
   * turno, asi que el texto que se leyo al abrir la caja ya no es el que hay
   * cuando la caja se desbloquea. Sin esto se desbloquearia ensenando lo
   * anterior, y guardar pisaria lo que la IA acaba de escribir. Ver D8.
   */
  $effect(() => {
    const id = page.id;
    // Un separador no es una página: no tiene reglas que cumplir ni caja donde
    // leerlas, asi que no se pide nada.
    if (page.separator) return;
    // Se lee también la senal: es la mitad de lo que dispara la relectura.
    void aiActivity.has(id);
    void loadMemory(id);
  });

  async function save() {
    busy = true;
    error = "";
    try {
      // Un separador no tiene icono ni puede ser el inicio: solo nombre y
      // permiso. Lo demas no se manda, para no escribirle campos que no usa.
      if (page.separator) {
        await pb.collection("pages").update(page.id, { name: name.trim() || page.name, roles });
        await onChanged();
        onClose();
        return;
      }
      if (isHome && !page.isHome) {
        await Promise.all(
          pages
            .filter((p) => p.isHome)
            .map((p) => pb.collection("pages").update(p.id, { isHome: false })),
        );
      }
      await pb.collection("pages").update(page.id, {
        name: name.trim() || page.name,
        icon,
        roles,
        ...(isHome && !page.isHome ? { isHome: true } : {}),
      });
      /*
       * La memoria va por su ruta y no con los demas campos: es lo único de la
       * página que se normaliza en el servidor antes de guardarse. Con la IA
       * trabajando no se manda nada --la caja esta bloqueada y lo que hubiera
       * escrito pisaria a la pasada-- y lo que se guarda vuelve ya limpio.
       */
      if (!aiWorking && !memoryLoading) {
        const saved = await put<{ memoria: string }>(
          `/api/apps/${app.id}/paginas/${page.id}/memoria`,
          { memoria: memory },
        );
        memory = saved.memoria;
      }
      await onChanged();
      onClose();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    busy = true;
    error = "";
    try {
      await pb.collection("pages").delete(page.id);
      await onChanged();
      deleting = false;
      onClose();
      onDeleted();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<!--
  Quien puede abrirlo. Es la misma pregunta para una página y para un
  separador, asi que la hace el mismo campo; solo cambia la palabra.
-->
{#snippet access()}
  <Field
    label={`Quién puede ver ${page.separator ? "este separador" : "esta página"}`}
    icon={ROLE_ICON}
  >
    <PageAccessPicker {roles} appRoles={app.roles ?? []} onChange={(next) => (roles = next)} />
  </Field>
{/snippet}

<!--
  Las reglas funcionales de la página, una por renglon.

  Se escriben solas: al cerrar cada turno, una pasada aparte mira lo que se
  pidio y guarda la regla que quedo, si quedo alguna. Esta caja es donde se
  leen y donde se corrigen a mano, que es lo que hace recuperable que la pasada
  se equivoque o se deje algo.

  Vacía se enseña vacía: una página a la que todavía no se le ha pedido nada no
  tiene reglas, y eso no es un error que avisar.

  Mientras la IA trabaja en esta página la caja se mira pero no se escribe: la
  pasada esta a punto de escribir ahi y guardar lo que se cargo antes borraria
  lo que acaba de anadir. Ver `design.md` D8.
-->
{#snippet memories()}
  <Field
    label="Memorias"
    icon="brain-02"
    hint={aiWorking
      ? "Bloqueadas mientras la inteligencia artificial trabaja en esta página: al terminar puede escribir aquí."
      : "Lo que esta página tiene que cumplir, una regla por renglón. Se escriben solas con cada petición; corrígelas si hace falta."}
  >
    <Textarea
      bind:value={memory}
      class="textarea-page-memory"
      rows={8}
      disabled={aiWorking || memoryLoading}
      placeholder={memoryLoading
        ? ""
        : "- Solo los auxiliares crean citas\n- El teléfono del paciente es obligatorio"}
      aria-label="Memorias de la página"
    />
  </Field>
{/snippet}

<!--
  La zona de borrar: su propia tarjeta, con el título diciendo que se va a
  borrar y que no vuelve, y el botón en el renglon de abajo. Es la misma pieza
  con la que se borra la aplicación --misma tarjeta, mismo sitio del botón-- y
  se lee igual porque es lo mismo que se hace; lo que no comparte es la
  confirmacion, que alli obliga a escribir el nombre. Borrar una página se
  deshace rehaciendola; borrar la aplicación no se deshace de ninguna manera.

  Lo destructivo no es lo mas grande del panel ni lo primero que se encuentra
  la mano: va al final y no ocupa el ancho entero.
-->
{#snippet dangerZone()}
  <section class="section-page-panel-delete card card-solid">
    <header class="card-head">
      <div class="head-page-panel-delete">
        <h3 class="title-page-panel-delete card-title">Borrar {thing}</h3>
        <p class="description-page-panel-delete card-sub">
          {#if page.separator}
            Se borrará el separador. Las páginas del grupo conservarán su posición. Esta acción no
            se puede deshacer.
          {:else}
            Se borrarán la página, su contenido y sus conversaciones con la inteligencia artificial.
            Esta acción no se puede deshacer.
          {/if}
        </p>
      </div>
    </header>

    <div class="card-body row-page-panel-delete">
      <p class="label-page-panel-delete">
        {#if page.isHome}
          La página de inicio no se borra: la aplicación siempre necesita una. Marca antes otra como
          inicio.
        {:else}
          Borrar <strong>{page.name}</strong>
          {page.separator ? "y dejar sus páginas donde están." : "y todo lo que tiene."}
        {/if}
      </p>

      {#if !page.isHome}
        <Button
          variant="danger"
          buttonClass="btn-delete-page-panel"
          onclick={() => (deleting = true)}
          disabled={busy}
          aria-label={`Borrar ${thing} "${page.name}"`}
        >
          <Icon name="trash" size={14} /> Borrar {thing}
        </Button>
      {/if}
    </div>
  </section>
{/snippet}

<OmniPanel
  title={page.separator ? "Ajustes del separador" : "Ajustes de la página"}
  description={page.separator
    ? "Cómo se llama el grupo y quién lo ve."
    : "Cómo se llama, quién puede verla y si es el inicio."}
  {onClose}
>
  {#if page.separator}
    <div class="form-page-panel flex flex-col gap-4">
      <ErrorNote message={error} />

      <Field label="Nombre">
        <Input bind:value={name} />
      </Field>

      {@render access()}
      {@render dangerZone()}
    </div>
  {:else}
    <div class="form-page-panel flex flex-col gap-4">
      <ErrorNote message={error} />

      <!--
        El inicio se marca pegado al nombre y no en una fila propia: es otra
        cosa que decir de esta página, no un ajuste con su parrafo. Pegado
        --`join` del catálogo-- porque lo que hace se lee del nombre que tiene
        al lado: esta es la que abre la aplicación.

        La de inicio no se puede desmarcar: la aplicación siempre necesita una,
        y se cambia marcando otra. Mientras el cambio no se guarda si se puede
        deshacer, que es volver a dejar de inicio a la que ya lo era.

        En la que ya es el inicio el botón se queda marcado y el clic no hace
        nada, pero no va `disabled`: un botón apagado no recibe al ratón, y con
        el se iria el globo que explica justo por que no se puede apagar. Lo
        dice `aria-disabled`, que se lee sin dejar de oir al ratón.
      -->
      <div class="row-page-panel-name">
        <IconPicker value={icon} onChange={(next) => (icon = next)} />
        <div class="field-page-panel-name">
          <Field label="Nombre">
            <div class="join join-page-panel-name">
              <Input bind:value={name} />
              <Button
                variant={isHome ? "secondary" : "default"}
                buttonClass="btn-home-page-panel"
                aria-pressed={isHome}
                aria-disabled={page.isHome}
                tip={page.isHome
                  ? "Esta página ya es el inicio; la aplicación siempre necesita una."
                  : "Quien entre a la aplicación llegará aquí primero."}
                onclick={() => {
                  if (!page.isHome) isHome = !isHome;
                }}
              >
                <Icon name="home-11" size={14} /> Página de inicio
              </Button>
            </div>
          </Field>
        </div>
      </div>

      {@render access()}
      {@render memories()}
      {@render dangerZone()}
    </div>
  {/if}

  {#snippet footer()}
    <Button onclick={onClose} disabled={busy}>Cerrar</Button>
    <Button variant="secondary" loading={busy} onclick={save}>Guardar</Button>
  {/snippet}
</OmniPanel>

<!-- Borrar es la única pregunta que sigue interrumpiendo, a propósito. -->
<ConfirmDialog
  open={deleting}
  onClose={() => (deleting = false)}
  title={`Borrar ${thing} "${page.name}"`}
  message={page.separator
    ? `Se borrará el separador "${page.name}". Las páginas que agrupa se quedan donde están. Esta acción no se puede deshacer.`
    : `Se borrará la página "${page.name}", lo que tenga escrito y las conversaciones con la inteligencia artificial que se hicieron en ella. Esta acción no se puede deshacer.`}
  {busy}
  onConfirm={remove}
/>

<style>
  .form-page-panel {
    & .row-page-panel-name {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-8);

      & .field-page-panel-name {
        min-width: 0;
        flex: 1;
      }
    }

    /* El nombre cede el ancho y el botón se queda con el suyo: la costura
       solo se ve recta si el nombre es lo que encoge. */
    & .join-page-panel-name :global(.btn-home-page-panel) {
      flex: none;
      white-space: nowrap;
    }

    /* Las reglas se leen como una lista, asi que el renglon manda: alto
       comodo, salto respetado y sin el ancho automatico del navegador, que
       aqui saldria mas estrecho que el resto del formulario. El vestido --el
       borde, el fondo, el estado apagado-- ya lo pone `field-control`. */
    & :global(.textarea-page-memory) {
      min-height: 9rem;
      resize: vertical;
      line-height: var(--text-sm--line-height);
      white-space: pre-wrap;
    }

    /* La caja, el título y el subtitulo son `.card`, `.card-title` y
       `.card-sub` del catálogo, como en los ajustes de la aplicación. Aqui
       solo el tamaño: dentro de un panel que ya tiene su título, el de la
       sección va un escalon por debajo. */
    & .section-page-panel-delete {
      & .head-page-panel-delete {
        min-width: 0;
      }

      & .title-page-panel-delete {
        font-size: var(--text-sm);
        font-weight: 600;
      }

      & .description-page-panel-delete {
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
      }

      /* El texto cede el ancho y el botón se queda con el suyo: sin esto la
         explicacion lo empuja y "Borrar" sale partido en dos líneas. */
      & .row-page-panel-delete {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-16);
      }

      & .label-page-panel-delete {
        min-width: 0;
        flex: 1;
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        color: var(--text-secondary);
      }

      & :global(.btn-delete-page-panel) {
        flex-shrink: 0;
      }
    }
  }
</style>
