import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { bindPersistence } from "@/state";
import { DexieAdapter, setActiveAdapter } from "@/storage";
import "./index.css";

const adapter = new DexieAdapter();
setActiveAdapter(adapter);
bindPersistence(adapter);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
