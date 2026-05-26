import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setRandomFavicon } from "./lib/Favicon";
import "./index.css";
import App from "./App.tsx";

setRandomFavicon();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
