import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
// Use AuthContext for user info:
import { useAuth } from '../context/AuthContext';

interface TorrentResult {
    name: string;
    size: string;
    seeders: number;
    leechers: number;
    link: string;
    provider: string;
    magnetLink?: string;
}

const Search: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // Use AuthContext for user info
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TorrentResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [downloading, setDownloading] = useState<Set<string>>(new Set());
    const [showFileTypeSelector, setShowFileTypeSelector] = useState(false);
    const [selectedTorrentForDownload, setSelectedTorrentForDownload] = useState<TorrentResult | null>(null);
    const [selectedFileType, setSelectedFileType] = useState<'movie' | 'series' | 'music'>('movie');

    // Load search history from localStorage on component mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('searchHistory');
        if (savedHistory) {
            try {
                const history = JSON.parse(savedHistory);
                setSearchHistory(history);
            } catch (error) {
                console.error('Failed to parse search history:', error);
            }
        }
        const lastQuery = localStorage.getItem('lastSearchQuery');
        if (lastQuery) {
            setQuery(lastQuery);
        }
    }, []);

    // Save search to history
    const saveToHistory = (searchQuery: string) => {
        if (!searchQuery.trim()) return;
        const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10);
        setSearchHistory(newHistory);
        localStorage.setItem('searchHistory', JSON.stringify(newHistory));
        localStorage.setItem('lastSearchQuery', searchQuery);
    };

    // Remove individual pill
    const removeFromHistory = (item: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newHistory = searchHistory.filter(h => h !== item);
        setSearchHistory(newHistory);
        localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    };

    // Clear all history
    const clearHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem('searchHistory');
        localStorage.removeItem('lastSearchQuery');
    };

    // Handle search from history
    const searchFromHistory = (historyQuery: string) => {
        setQuery(historyQuery);
        handleSearch(undefined, historyQuery);
    };

    // Log search to backend
    const logSearch = async (searchQuery: string) => {
        try {
            await api.post('/log-search', {
                username: user?.username || 'anonymous',
                query: searchQuery
            });
        } catch (err) {
            // Logging should not block UI
            console.error('Failed to log search:', err);
        }
    };

    const handleSearch = async (e?: React.FormEvent, searchQuery?: string) => {
        if (e) e.preventDefault();
        const queryToSearch = searchQuery || query;
        if (!queryToSearch.trim()) return;

        setLoading(true);
        setSearched(true);

        // Save to history and log
        saveToHistory(queryToSearch);
        logSearch(queryToSearch);

        try {
            const response = await api.get('/search', {
                params: { query: queryToSearch, sortBy: 'seeders' }
            });
            setResults(response.data || []);
        } catch (error) {
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadClick = (result: TorrentResult) => {
        setSelectedTorrentForDownload(result);
        setShowFileTypeSelector(true);
        setSelectedFileType('movie');
    };

    const confirmDownload = async () => {
        if (!selectedTorrentForDownload || !selectedFileType) {
            alert('Please select a torrent and a file type.');
            return;
        }
        const result = selectedTorrentForDownload;
        const uniqueId = result.magnetLink || result.link || result.name;
        setDownloading(prev => new Set(prev).add(uniqueId));
        setShowFileTypeSelector(false);
        setSelectedTorrentForDownload(null);

        try {
            await api.post('/downloads/queue', {
                torrentInfo: result,
                fileType: selectedFileType
            });
            navigate('/downloads');
        } catch (error: any) {
            alert(`Failed to queue download: ${error.response?.data?.error || error.message}`);
        } finally {
            setDownloading(prev => {
                const newSet = new Set(prev);
                newSet.delete(uniqueId);
                return newSet;
            });
        }
    };

    const cancelDownloadSelection = () => {
        setShowFileTypeSelector(false);
        setSelectedTorrentForDownload(null);
        setSelectedFileType('movie');
    };

    return (
        <div className="search-page main-content">
            <h1>Search Torrents</h1>
            {/* Search History Pills */}
            {searchHistory.length > 0 && (
                <div className="search-history">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0 }}>Recent Searches</h3>
                        <button onClick={clearHistory} className="clear-history-btn">
                            Clear History
                        </button>
                    </div>
                    <div className="search-history-pills">
                        {searchHistory.map((historyItem, index) => (
                            <button
                                key={index}
                                className="search-history-pill"
                                onClick={() => searchFromHistory(historyItem)}
                                title={`Search for: ${historyItem}`}
                                type="button"
                            >
                                <span className="pill-text">{historyItem}</span>
                                <span
                                    className="pill-remove"
                                    title="Remove"
                                    onClick={e => removeFromHistory(historyItem, e)}
                                >
                                    &times;
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSearch} className="search-form">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for movies, series, music..."
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            <div className="search-results">
                {loading ? (
                    <p>Loading results...</p>
                ) : results.length > 0 ? (
                    <>
                        <div style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
                            Found {results.length} results for "{query}"
                        </div>
                        {results.map((result, index) => (
                            <div key={`${result.provider}-${result.name}-${index}`} className="result-item">
                                <div className="result-info">
                                    <h3>{result.name}</h3>
                                    <div className="result-details">
                                        <span>Size: {result.size}</span>
                                        <span>Seeders: {result.seeders}</span>
                                        <span>Leechers: {result.leechers}</span>
                                        <span>Provider: {result.provider}</span>
                                    </div>
                                </div>
                                <div className="result-actions">
                                    <button
                                        onClick={() => handleDownloadClick(result)}
                                        disabled={downloading.has(result.magnetLink || result.link || result.name)}
                                        className="download-btn"
                                    >
                                        {downloading.has(result.magnetLink || result.link || result.name) ? 'Queueing...' : 'Download'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </>
                ) : searched ? (
                    <div className="no-results">
                        <p>No results found for "{query}"</p>
                        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            Try different keywords or check your spelling
                        </p>
                    </div>
                ) : null}
            </div>

            {/* File Type Selector Modal */}
            {showFileTypeSelector && selectedTorrentForDownload && (
                <div className="file-type-selector-overlay">
                    <div className="file-type-selector-card">
                        <h2>Select Content Type</h2>
                        <p>For: <strong>{selectedTorrentForDownload.name}</strong></p>
                        <div className="file-type-buttons">
                            <button
                                className={selectedFileType === 'movie' ? 'active' : ''}
                                onClick={() => setSelectedFileType('movie')}
                            >
                                🎬 Movie
                            </button>
                            <button
                                className={selectedFileType === 'series' ? 'active' : ''}
                                onClick={() => setSelectedFileType('series')}
                            >
                                📺 Series
                            </button>
                            <button
                                className={selectedFileType === 'music' ? 'active' : ''}
                                onClick={() => setSelectedFileType('music')}
                            >
                                🎵 Music
                            </button>
                        </div>
                        <div className="selector-actions">
                            <button
                                onClick={confirmDownload}
                                disabled={downloading.has(selectedTorrentForDownload.magnetLink || selectedTorrentForDownload.link || selectedTorrentForDownload.name)}
                                className="btn-primary"
                            >
                                {downloading.has(selectedTorrentForDownload.magnetLink || selectedTorrentForDownload.link || selectedTorrentForDownload.name) ? 'Processing...' : 'Confirm Download'}
                            </button>
                            <button onClick={cancelDownloadSelection} className="cancel-btn">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Search;