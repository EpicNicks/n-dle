import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setRandomFavicon } from "./lib/Favicon";
import "./index.css";
import App from "./App.tsx";

setRandomFavicon();

const redirect = new URLSearchParams(window.location.search).get("redirect");
console.log("location:", window.location.href);
console.log("redirect param:", redirect);
if (redirect) {
  const decoded = decodeURIComponent(redirect);
  console.log("decoded →", decoded);
  window.history.replaceState(null, "", decoded);
  console.log("after replaceState →", window.location.href);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
