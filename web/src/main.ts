import "./styles/global.css";

import { mount } from "svelte";

import App from "./App.svelte";

const root = document.getElementById("root");
if (!root) throw new Error("Falta el elemento #root en el HTML");

mount(App, { target: root });
