import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import TextAnalyzer from './components/TextAnalyzer.jsx'

export default function App() {
  return (
    <div className="container">
      <Header/>
      <main className="main">
        <TextAnalyzer/>
      </main>
      <Footer/>
    </div>
  )
}