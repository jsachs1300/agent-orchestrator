import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import PlaygroundPage from './pages/PlaygroundPage';
import ToolConfigPage from './pages/ToolConfigPage';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<PlaygroundPage />} />
          <Route path="/config" element={<ToolConfigPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
