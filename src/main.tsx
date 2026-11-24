import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Landing } from "./pages/Landing";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
