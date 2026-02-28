import "./index.css";
import App from "./renderer/App.svelte";

const app = new App({
  target: document.getElementById("app")!,
});

export default app;
