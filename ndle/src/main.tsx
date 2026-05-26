import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setRandomFavicon } from "./lib/Favicon";
import "./index.css";

const redirect = new URLSearchParams(window.location.search).get("redirect");
if (redirect) {
  window.history.replaceState(null, "", decodeURIComponent(redirect));
}

setRandomFavicon();

const { default: App } = await import("./App.tsx");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
