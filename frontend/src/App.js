import React, { useState } from 'react';
import Header from "./components/Header";
import RightPanel from "./components/PdfViewer";
import KeywordInput from "./components/Input";
import TextAnalyzer from "./components/TextAnalyzer";
import './App.css';
import {
  PanelGroup,
  Panel,
  PanelResizeHandle
} from 'react-resizable-panels';

function App() {
  const [keywords, setKeywords] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = () => {
    setSearchTerm(keywords.trim());
  };

  return (
    <div className="app">
      <Header />

      <div className="body">
        <PanelGroup direction="horizontal" autoSaveId="layout">
          {/* Left panel with vertical splitter */}
          <Panel defaultSize={50} minSize={10}>
            <div className="pane-content" style={{ height: '100%' }}>
              <PanelGroup direction="vertical" autoSaveId="layout-vertical">
                <Panel defaultSize={20} minSize={15} maxSize={30}>
                  <div className="inner-container top" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', height: '100%' }}>
                    <KeywordInput 
                      value={keywords} 
                      onChange={(e) => setKeywords(e.target.value)} 
                    />
                    <button 
                      onClick={handleSearch} 
                      style={{ height: '40px', width: '100%' }}
                    >
                      Search
                    </button>
                  </div>
                </Panel>
                <PanelResizeHandle className="custom-handle-vertical" />
                <Panel defaultSize={80} minSize={70}>
                  <div className="inner-container bottom" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff' }}>
                    <TextAnalyzer keywords={searchTerm} />
                  </div>
                </Panel>
              </PanelGroup>
            </div>
          </Panel>
          <PanelResizeHandle className="custom-handle" />
          {/* Right panel */}
          <Panel defaultSize={50} minSize={10}>
            <div className="pane-content">
              <div className="inner-container full">
                <RightPanel />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default App;
