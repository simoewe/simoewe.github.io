import React, { useMemo, useState } from 'react';
import '../TextAnalyzer.css';

const TREND_STATUS_ORDER = ['using', 'evaluating', 'discontinued', 'unspecified'];
const TREND_STATUS_LABELS = {
  using: 'Im Einsatz',
  evaluating: 'Bewertung & Planung',
  discontinued: 'Nicht mehr genutzt',
  unspecified: 'Unklar'
};

const TextAnalyzer = ({ analysisResult, loading, analysisProgress = 0, analysisSteps = [], customKeywords = [] }) => {
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

  const uniqueCustomKeywords = useMemo(() => {
    const seen = new Set();
    const unique = [];
    customKeywords.forEach((keyword) => {
      const trimmed = keyword.trim();
      if (!trimmed) {
        return;
      }
      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      unique.push(trimmed);
    });
    return unique;
  }, [customKeywords]);

  const customKeywordSet = useMemo(() => {
    return new Set(uniqueCustomKeywords.map((keyword) => keyword.toLowerCase()));
  }, [uniqueCustomKeywords]);

  if (loading) {
    const clampedProgress = Math.max(0, Math.min(analysisProgress, 100));
    return (
      <div className="text-analyzer">
        <div className="analyzer-header">
          <h2>Analysis Results</h2>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Analyzing your document...</p>
          {analysisSteps.length > 0 && (
            <div className="loading-steps">
              {analysisSteps.map((step) => (
                <div key={step.id} className={`loading-step loading-step-${step.status}`}>
                  <span className="loading-step-icon">
                    {step.status === 'completed' ? '✅' : step.status === 'active' ? '🔄' : '•'}
                  </span>
                  <span className="loading-step-label">{step.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${clampedProgress}%` }}></div>
          </div>
          <div className="progress-percentage">{Math.round(clampedProgress)}%</div>
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

  const { image, kwic, collocations, frequencies, densities, sentiment, readability, trends, trendInsights } = analysisResult;
  const insights = trendInsights || [];

  const frequencyEntries = frequencies ? Object.entries(frequencies) : [];
  const technologyFrequencyEntries = frequencyEntries.filter(([keyword]) => !customKeywordSet.has(keyword.toLowerCase()));
  const sortedTechnologyFrequencyEntries = technologyFrequencyEntries
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);
  const keywordsFoundCount = technologyFrequencyEntries.filter(([, value]) => value > 0).length;
  const totalOccurrences = technologyFrequencyEntries.reduce((sum, [, value]) => sum + value, 0);
  const maxFrequencyValue = technologyFrequencyEntries.length > 0
    ? Math.max(...technologyFrequencyEntries.map(([, value]) => value))
    : 0;

  const customFrequencyEntries = uniqueCustomKeywords.map((keyword) => {
    const matchedEntry = frequencyEntries.find(([label]) => label.toLowerCase() === keyword.toLowerCase());
    const frequencyValue = matchedEntry ? matchedEntry[1] : 0;
    return [keyword, frequencyValue];
  });
  const customMaxFrequencyValue = customFrequencyEntries.length > 0
    ? Math.max(...customFrequencyEntries.map(([, value]) => value))
    : 0;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'wordcloud', label: 'Word Cloud', icon: '☁️' },
    { id: 'trends', label: 'Trends', icon: '📉' },
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
                    {sortedTechnologyFrequencyEntries.length > 0 ? (
                      sortedTechnologyFrequencyEntries
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

            {frequencies && densities && uniqueCustomKeywords.length > 0 && (
              <div className="chart-card">
                <h3>Custom Keyword Frequencies</h3>
                <div className="frequency-bars">
                  {customFrequencyEntries.length > 0 ? (
                    customFrequencyEntries.map(([keyword, freq]) => {
                      const baseline = customMaxFrequencyValue || 1;
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
                      No custom keywords provided for this analysis.
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

        {activeTab === 'trends' && (
          <div className="trends-overview">
            {insights.length > 0 ? (
              insights.map((item) => {
                const statusCounts = item.status_counts || {};
                const evidence = item.evidence || [];
                const mentionLabel = item.total_mentions === 1 ? 'Erwähnung' : 'Erwähnungen';

                return (
                  <div key={item.trend} className="trend-card">
                    <div className="trend-card-header">
                      <div className="trend-card-title">
                        <h3 className="trend-card-name">{item.trend}</h3>
                        <span className="trend-card-count">{item.total_mentions} {mentionLabel}</span>
                      </div>
                      <p className="trend-summary">{item.summary}</p>
                    </div>

                    <div className="trend-status-row">
                      {TREND_STATUS_ORDER.map((status) => {
                        const count = statusCounts[status] || 0;
                        if (!count) {
                          return null;
                        }
                        return (
                          <span key={status} className={`trend-status-badge trend-status-${status}`}>
                            {TREND_STATUS_LABELS[status]} · {count}
                          </span>
                        );
                      })}
                    </div>

                    {evidence.length > 0 && (
                      <div className="trend-evidence">
                        {evidence.map((sample, idx) => {
                          const sampleStatus = sample.status || 'unspecified';
                          const statusLabel = TREND_STATUS_LABELS[sampleStatus] || TREND_STATUS_LABELS.unspecified;
                          return (
                            <div key={idx} className="trend-evidence-item">
                              <span className={`trend-evidence-status trend-status-${sampleStatus}`}>
                                {statusLabel}
                              </span>
                              <p className="trend-evidence-text">"{sample.sentence}"</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="no-trends">
                <div className="placeholder-icon">📉</div>
                <p>Keine Trend-Einsichten für dieses Dokument.</p>
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
