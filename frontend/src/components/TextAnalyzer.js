import React, { useState } from 'react';
import '../TextAnalyzer.css';

const TextAnalyzer = ({ analysisResult, loading }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState({
    kwic: false,
    collocations: false,
    trends: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getSentimentColor = (polarity) => {
    if (polarity > 0.1) return '#10B981'; // Green for positive
    if (polarity < -0.1) return '#EF4444'; // Red for negative
    return '#6B7280'; // Gray for neutral
  };

  const getSentimentLabel = (polarity) => {
    if (polarity > 0.1) return 'Positive';
    if (polarity < -0.1) return 'Negative';
    return 'Neutral';
  };

  if (loading) {
    return (
      <div className="text-analyzer">
        <div className="analyzer-header">
          <h2>Analysis Results</h2>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Analyzing your document...</p>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysisResult) {
    return (
      <div className="text-analyzer">
        <div className="analyzer-header">
          <h2>Analysis Results</h2>
        </div>
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <p>Upload a document to begin analysis. Adding your own keywords is optional.</p>
        </div>
      </div>
    );
  }

  if (analysisResult.error) {
    return (
      <div className="text-analyzer">
        <div className="analyzer-header">
          <h2>Analysis Results</h2>
        </div>
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <p className="error">{analysisResult.error}</p>
        </div>
      </div>
    );
  }

  const { image, kwic, collocations, frequencies, densities, sentiment, readability, trends } = analysisResult;

  const frequencyEntries = frequencies ? Object.entries(frequencies) : [];
  const keywordsFoundCount = frequencyEntries.filter(([, value]) => value > 0).length;
  const totalOccurrences = frequencyEntries.reduce((sum, [, value]) => sum + value, 0);
  const maxFrequencyValue = frequencyEntries.length > 0
    ? Math.max(...frequencyEntries.map(([, value]) => value))
    : 0;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'wordcloud', label: 'Word Cloud', icon: '☁️' },
    { id: 'details', label: 'Details', icon: '🔍' },
    { id: 'metrics', label: 'Metrics', icon: '📈' }
  ];

  return (
    <div className="text-analyzer">
      <div className="analyzer-header">
        <h2>Analysis Results</h2>
        <div className="tab-navigation">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-grid">
            {/* Quick Stats */}
            {frequencies && densities && (
              <div className="stat-cards">
                <div className="stat-card">
                  <h4>Technology Keywords Found</h4>
                  <div className="stat-value">{keywordsFoundCount}</div>
                </div>
                <div className="stat-card">
                  <h4>Total Occurrences</h4>
                  <div className="stat-value">{totalOccurrences}</div>
                </div>
                {sentiment && (
                  <div className="stat-card sentiment-card">
                    <h4>Sentiment</h4>
                    <div className="sentiment-indicator">
                      <div 
                        className="sentiment-circle" 
                        style={{ backgroundColor: getSentimentColor(sentiment.polarity) }}
                      ></div>
                      <span>{getSentimentLabel(sentiment.polarity)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Frequency Chart */}
            {frequencies && densities && (
                <div className="chart-card">
                  <h3>Technology Keyword Frequencies</h3>
                  <div className="frequency-bars">
                    {frequencyEntries.filter(([, value]) => value > 0).length > 0 ? (
                      frequencyEntries
                        .filter(([, value]) => value > 0)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 10)
                        .map(([keyword, freq]) => {
                          const baseline = maxFrequencyValue || 1;
                          const width = baseline > 0 ? (freq / baseline) * 100 : 0;
                          return (
                            <div key={keyword} className="frequency-bar">
                              <div className="bar-label">
                                <span className="keyword">{keyword}</span>
                                <span className="count">{freq}</span>
                              </div>
                              <div className="bar-container">
                                <div 
                                  className="bar-fill" 
                                  style={{ width: `${width}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div className="no-keyword-results">
                        No technology keywords detected in this document.
                      </div>
                    )}
                  </div>
                </div>
            )}
          </div>
        )}

        {activeTab === 'wordcloud' && (
          <div className="wordcloud-section">
            {image ? (
              <div className="wordcloud-container">
                <img src={image} alt="Word Cloud Visualization" className="wordcloud-image" />
                <p className="wordcloud-caption">
                  Visual representation of keyword frequencies in your document
                </p>
              </div>
            ) : (
              <div className="no-wordcloud">
                <div className="placeholder-icon">☁️</div>
                <p>Word cloud not available for this analysis</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="details-section">
            {/* KWIC Results */}
            {kwic && Object.keys(kwic).length > 0 && (
              <div className="collapsible-section">
                <button 
                  className="section-header"
                  onClick={() => toggleSection('kwic')}
                >
                  <h3>Keywords in Context (KWIC)</h3>
                  <span className={`arrow ${expandedSections.kwic ? 'expanded' : ''}`}>▶</span>
                </button>
                {expandedSections.kwic && (
                  <div className="kwic-content">
                    {Object.entries(kwic).map(([keyword, contexts], idx) => (
                      <div key={idx} className="kwic-keyword">
                        <h4 className="keyword-title">{keyword}</h4>
                        <div className="context-list">
                          {contexts.slice(0, 5).map((context, i) => (
                            <div key={i} className="context-item">
                              <span className="context-text">{context}</span>
                            </div>
                          ))}
                          {contexts.length > 5 && (
                            <div className="show-more">
                              +{contexts.length - 5} more contexts
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Collocations */}
            {collocations && Object.keys(collocations).length > 0 && (
              <div className="collapsible-section">
                <button 
                  className="section-header"
                  onClick={() => toggleSection('collocations')}
                >
                  <h3>Collocations</h3>
                  <span className={`arrow ${expandedSections.collocations ? 'expanded' : ''}`}>▶</span>
                </button>
                {expandedSections.collocations && (
                  <div className="collocations-content">
                    {Object.entries(collocations).map(([keyword, colloc], idx) => (
                      <div key={idx} className="collocation-item">
                        <h4 className="keyword-title">{keyword}</h4>
                        <div className="collocation-grid">
                          <div className="collocation-side">
                            <h5>Words Before</h5>
                            <div className="collocation-tags">
                              {colloc.left.slice(0, 8).map(([word, count], i) => (
                                <span key={i} className="collocation-tag">
                                  {word} <span className="count">({count})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="collocation-side">
                            <h5>Words After</h5>
                            <div className="collocation-tags">
                              {colloc.right.slice(0, 8).map(([word, count], i) => (
                                <span key={i} className="collocation-tag">
                                  {word} <span className="count">({count})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Trends */}
            {trends && trends.length > 0 && (
              <div className="collapsible-section">
                <button 
                  className="section-header"
                  onClick={() => toggleSection('trends')}
                >
                  <h3>Technological Trends</h3>
                  <span className={`arrow ${expandedSections.trends ? 'expanded' : ''}`}>▶</span>
                </button>
                {expandedSections.trends && (
                  <div className="trends-content">
                    {trends.map((trend, idx) => (
                      <div key={idx} className="trend-item">
                        <div className="trend-header">
                          <h4 className="trend-name">{trend.trend}</h4>
                          <span className="trend-count">{trend.count} occurrences</span>
                        </div>
                        <div className="trend-contexts">
                          {trend.contexts.slice(0, 3).map((ctx, i) => (
                            <div key={i} className="context-snippet">"{ctx}"</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="metrics-section">
            <div className="metrics-grid">
              {/* Sentiment Analysis */}
              {sentiment && (
                <div className="metric-card">
                  <h3>Sentiment Analysis</h3>
                  <div className="sentiment-metrics">
                    <div className="sentiment-row">
                      <span>Polarity:</span>
                      <div className="sentiment-bar">
                        <div 
                          className="sentiment-fill"
                          style={{ 
                            width: `${(sentiment.polarity + 1) * 50}%`,
                            backgroundColor: getSentimentColor(sentiment.polarity)
                          }}
                        ></div>
                      </div>
                      <span className="sentiment-value">{sentiment.polarity.toFixed(3)}</span>
                    </div>
                    <div className="sentiment-row">
                      <span>Subjectivity:</span>
                      <div className="sentiment-bar">
                        <div 
                          className="sentiment-fill"
                          style={{ 
                            width: `${sentiment.subjectivity * 100}%`,
                            backgroundColor: '#8B5CF6'
                          }}
                        ></div>
                      </div>
                      <span className="sentiment-value">{sentiment.subjectivity.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Readability Metrics */}
              {readability && (
                <div className="metric-card">
                  <h3>Readability Metrics</h3>
                  <div className="readability-metrics">
                    <div className="metric-item">
                      <span className="metric-label">Flesch Reading Ease:</span>
                      <span className="metric-value">{readability.flesch_reading_ease.toFixed(1)}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Total Words:</span>
                      <span className="metric-value">{readability.total_words.toLocaleString()}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Total Sentences:</span>
                      <span className="metric-value">{readability.total_sentences.toLocaleString()}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Avg Words/Sentence:</span>
                      <span className="metric-value">
                        {(readability.total_words / readability.total_sentences).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Keyword Densities */}
              {frequencies && densities && (
                <div className="metric-card full-width">
                  <h3>Keyword Analysis</h3>
                  <div className="density-table">
                    <div className="table-header">
                      <span>Keyword</span>
                      <span>Frequency</span>
                      <span>Density</span>
                    </div>
                    {Object.entries(frequencies)
                      .sort(([,a], [,b]) => b - a)
                      .map(([keyword, freq]) => (
                        <div key={keyword} className="table-row">
                          <span className="keyword-cell">{keyword}</span>
                          <span className="frequency-cell">{freq}</span>
                          <span className="density-cell">{densities[keyword]}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextAnalyzer;
