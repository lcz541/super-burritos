import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameApp } from "@/components/GameApp";
import { readChallenge } from "@/lib/share";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameApp rivalScore={readChallenge()} />
  </StrictMode>,
);
