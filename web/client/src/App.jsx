import { useEffect, useState } from "react";

import NavBar from "./components/NavBar.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Game from "./pages/Game.jsx";
import Team from "./pages/Team.jsx";

const PAGES = {
  "#/game": Game,
  "#/team": Team,
};

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export function App() {
  const hash = useHashRoute();
  const Page = PAGES[hash] ?? Home;
  return (
    <>
      <NavBar />
      <main className="page">
        <Page />
      </main>
      <Footer />
    </>
  );
}
