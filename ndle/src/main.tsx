import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setRandomFavicon } from "./lib/Favicon";
import "./index.css";
import App from "./App.tsx";

setRandomFavicon();

const redirect = new URLSearchParams(window.location.search).get("redirect");
if (redirect) {
  window.history.replaceState(null, "", redirect);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
