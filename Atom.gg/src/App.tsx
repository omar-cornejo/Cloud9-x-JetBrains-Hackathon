import { useState } from "react";
import "./App.css";
import Drafter from "./pages/drafter";
import { Setup } from "./pages/setup";
import { Home } from "./pages/home";
import { DraftConfig } from "./types/draft";

type View = "home" | "setup" | "drafter";

function App() {
  const [view, setView] = useState<View>("home");
  const [config, setConfig] = useState<DraftConfig | null>(null);

  const handleStartSetup = () => {
    setView("setup");
  };

  const handleStartDraft = (newConfig: DraftConfig) => {
    setConfig(newConfig);
    setView("drafter");
  };

  const handleBackToHome = () => {
    setView("home");
    setConfig(null);
  };

  const handleBackToSetup = () => {
    setView("setup");
  };

  if (view === "home") {
    return <Home onSelectMode={(mode) => mode === "simulator" && handleStartSetup()} />;
  }

  if (view === "setup") {
    return <Setup onStart={handleStartDraft} onBack={handleBackToHome} />;
  }

  if (view === "drafter" && config) {
    return <Drafter config={config} onBack={handleBackToSetup} />;
  }

  return null;
}

export default App;
