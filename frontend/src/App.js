// import './App.css';
// import Header from './components/Header';
// import TextAnalyzer from './components/TextAnalyzer';
// import Footer from './components/Footer';


// function App() {
//   return (
//     <div className="App">
//       <Header />
//   <TextAnalyzer />
//       <Footer />
//     </div>
//   );
// }

// export default App;

import React, { useState } from 'react';
import Header from "./components/Header";
import RightPanel from "./components/PdfViewer";
import KeywordInput from "./components/Input";
import './App.css';
import {
  PanelGroup,
  Panel,
  PanelResizeHandle
} from 'react-resizable-panels';

function App() {
  const [keywords, setKeywords] = useState("");

  return (
    <div className="app">
      <Header />

      <div className="body">
        <PanelGroup direction="horizontal" autoSaveId="layout">
          <Panel defaultSize={50} minSize={10}>
            <div className="pane-content">
              {/* Container-left Inhalt */}
              <div className="inner-container top">
                <KeywordInput 
                  value={keywords} 
                  onChange={(e) => setKeywords(e.target.value)} 
                />
              </div>
              <div className="inner-container bottom"></div>
            </div>
          </Panel>

          <PanelResizeHandle className="custom-handle" />

          <Panel defaultSize={50} minSize={10}>
            <div className="pane-content">
              {/* Container-right Inhalt */}
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
