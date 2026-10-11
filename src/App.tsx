import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import Navbar from "./components/Navbar";
import { OfflineBanner } from "./components/AppStatus";
import { useT } from "./i18n/lang";
import { RouteFallback } from "./components/Skeleton";
import ErrorBoundary from "./components/ErrorBoundary";

// O emulador é a casa do site; o resto é o que se lê do save dele.
const PlayPage = lazy(() => import("./pages/PlayPage"));
const TrainerPage = lazy(() => import("./pages/TrainerPage"));
const SaveComparePage = lazy(() => import("./pages/SaveComparePage"));
const DamagePage = lazy(() => import("./pages/DamagePage"));
const GymsPage = lazy(() => import("./pages/GymsPage"));
const DataPage = lazy(() => import("./pages/DataPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function App() {
  // Ler o idioma aqui, na raiz, faz a árvore inteira re-renderizar na troca —
  // inclusive quem só usa pickLocalized e não chama useT.
  const t = useT();

  return (
    <>
      {/* Primeiro foco tabulável da página: sem ele, quem navega por teclado
          passa pelos links do menu em toda troca de rota. */}
      <a className="skip-link" href="#conteudo">
        {t("Pular para o conteúdo", "Skip to content")}
      </a>
      <Navbar />
      <OfflineBanner />
      {/* O único <main> do site: é o landmark que leitor de tela procura, e
          o destino do link acima (tabIndex -1 para ele poder receber o foco). */}
      <main id="conteudo" tabIndex={-1}>
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<PlayPage />} />
              {/* Endereço de quando o emulador era uma aba da Pokédex. */}
              <Route path="/jogar" element={<Navigate to="/" replace />} />
              <Route path="/treinador" element={<TrainerPage />} />
              <Route path="/treinador/comparar" element={<SaveComparePage />} />
              <Route path="/dano" element={<DamagePage />} />
              <Route path="/ginasios" element={<GymsPage />} />
              <Route path="/dados" element={<DataPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}

export default App;
