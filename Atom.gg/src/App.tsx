import {useEffect, useState} from "react";
import "./App.css";
import Drafter from "./pages/drafter";
import { Setup } from "./pages/setup";
import { Home } from "./pages/home";
import { ClientDraft } from "./pages/client_draft";
import { DraftConfig } from "./types/draft";
import {initializeIconSource} from "./services/fallback_service.ts";

type View = "home" | "setup" | "drafter" | "client";

function App() {
  const [view, setView] = useState<View>("home");
  const [config, setConfig] = useState<DraftConfig | null>(null);

  // Test CDN availability
  useEffect(() => {
    initializeIconSource();
  }, []);

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
    return (
      <Home
        onSelectMode={(mode) => {
          if (mode === "simulator") {
            handleStartSetup();
          } else if (mode === "client") {
            setView("client");
          }
        }}
      />
    );
  }

  if (view === "client") {
    return <ClientDraft onBack={handleBackToHome} />;
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
