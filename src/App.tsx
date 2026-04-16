import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { PDFs } from "@/pages/PDFs";
import { Items } from "@/pages/Items";
import { Matieres } from "@/pages/Matieres";
import { MatiereDetail } from "@/pages/MatiereDetail";
import { Errors } from "@/pages/Errors";
import { Diagrams } from "@/pages/Diagrams";
import { Planning } from "@/pages/Planning";
import { Anki } from "@/pages/Anki";
import { Annales } from "@/pages/Annales";
import { AnkiStudy } from "@/pages/AnkiStudy";
import { Settings } from "@/pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pdfs" element={<PDFs />} />
          <Route path="/items" element={<Items />} />
          <Route path="/matieres" element={<Matieres />} />
          <Route path="/matieres/:id" element={<MatiereDetail />} />
          <Route path="/errors" element={<Errors />} />
          <Route path="/annales" element={<Annales />} />
          <Route path="/diagrams" element={<Diagrams />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/anki" element={<Anki />} />
          <Route path="/anki/study" element={<AnkiStudy />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
