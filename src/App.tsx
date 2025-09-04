import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ValidationPage } from './pages/ValidationPage';
import SummaryPage from './pages/SummaryPage';

function App() {
  return (
    <Router>
      <nav className="bg-gray-100 p-4 flex gap-4">
        <Link to="/" className="font-semibold text-blue-600">Summary</Link>
        <Link to="/validate" className="font-semibold text-green-600">Validation</Link>
      </nav>
      <Routes>
        <Route path="/" element={<SummaryPage />} />
        <Route path="/validate" element={<ValidationPage />} />
      </Routes>
    </Router>
  );
}

export default App;