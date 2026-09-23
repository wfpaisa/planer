<!--
  La guardia de sesión.

  Lo importante es el orden: mientras no se sabe si hay sesión no se echa a
  nadie. Con una sesión guardada hay que preguntarle al servidor si sigue viva,
  y hasta que conteste solo se enseña que se esta cargando; redirigir antes
  mandaria a la pantalla de entrar a quien ya estaba dentro.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { navigate } from "../lib/router.svelte";
  import { session } from "../lib/session.svelte";
  import Loading from "./ui/Loading.svelte";

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (session.ready && !session.me) navigate("/entrar", { replace: true });
  });
</script>

{#if !session.ready}
  <Loading />
{:else if session.me}
  {@render children()}
{/if}
