<!--
  El icono de una columna.

  Sale del tipo, salvo en las del sistema que significan algo mas que su tipo:
  la de roles es un desplegable de varios valores como cualquier otro, pero lo
  que guarda son roles, y se reconoce por el icono de roles y no por el del
  desplegable.
-->
<script lang="ts">
  import { ROLE_ICON } from "@shared/people";
  import type { FieldDef, FieldType } from "@shared/types";

  import { FIELD_TYPES } from "../lib/fieldTypes";
  import Icon from "./Icon.svelte";

  let {
    type,
    system,
    size = 16,
    class: className,
  }: {
    type: FieldType;
    /** La marca de sistema de la columna, cuando se tiene la columna entera. */
    system?: FieldDef["system"];
    size?: number;
    class?: string;
  } = $props();

  const name = $derived(system === "roles" ? ROLE_ICON : (FIELD_TYPES[type]?.icon ?? "text-font"));
</script>

<Icon {name} {size} class={className} />
