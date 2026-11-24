import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Landing } from "./pages/Landing";
import { AppPage } from "./pages/AppPage";

/** Deux pages : la présentation (par défaut) et l'application (#app). */
const isApp = () => location.hash === "#app" || location.hash === "#demo";

function Root() {
  const [app, setApp] = useState(isApp);
  useEffect(() => {
    const onHash = () => {
      const next = isApp();
      setApp((prev) => {
        if (prev !== next) window.scrollTo(0, 0);
        return next;
      });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return app ? <AppPage /> : <Landing />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
