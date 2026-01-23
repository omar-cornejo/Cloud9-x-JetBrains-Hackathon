import { useState } from "react";
import "./App.css";
import Drafter from "./pages/drafter";
import { Setup } from "./pages/setup";
import { DraftConfig } from "./types/draft";

function App() {
  const [config, setConfig] = useState<DraftConfig | null>(null);

  if (!config) {
    return <Setup onStart={setConfig} />;
  }

  return (
    <Drafter config={config} onBack={() => setConfig(null)} />
  );
}

export default App;
