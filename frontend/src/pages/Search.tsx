import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
// Use AuthContext for user info:
import { useAuth } from '../contexts/AuthContext';
import { organizeResults, TorrentResult } from '../utils/torrentUtils';
import SeasonBundleItem from '../components/search/SeasonBundleItem';

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

    // For single download
    const [selectedTorrentForDownload, setSelectedTorrentForDownload] = useState<TorrentResult | null>(null);
    const [selectedFileType, setSelectedFileType] = useState<'movie' | 'series' | 'music'>('movie');

    // For batch download (processing queue)
    const [batchProcessing, setBatchProcessing] = useState(false);

    // Organize results into bundles
    const organizedResults = useMemo(() => organizeResults(results), [results]);

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
            await api.post('/search/log-search', {
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

    // ---------- SINGLE DOWNLOAD LOGIC ----------

    const handleDownloadClick = (result: TorrentResult) => {
        setSelectedTorrentForDownload(result);
        setShowFileTypeSelector(true);

        // Auto-select type based on metadata or fallback to movie
        if (result.season !== undefined && result.season !== null) {
            setSelectedFileType('series');
        } else {
            setSelectedFileType('movie');
        }
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
            // Don't navigate away for better UX if downloading multiple things,
            // but for single download maybe notification is enough?
            // The original code navigated to /downloads. Let's keep that for single download flow?
            // Actually, if we want to stay on search page, we should just show a toast.
            // But let's stick to original behavior for single items for now, or maybe make it optional.
            // Given the requirement is "Download All", staying on page is better.
            alert(`Queued: ${result.name}`);
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

    // ---------- BATCH DOWNLOAD LOGIC ----------

    const handleBatchDownload = async (torrents: TorrentResult[]) => {
        // eslint-disable-next-line no-restricted-globals
        if (!window.confirm(`Are you sure you want to download ${torrents.length} episodes?`)) return;

        setBatchProcessing(true);
        let successCount = 0;
        let failCount = 0;

        // Add all to downloading set visually
        const ids = torrents.map(t => t.magnetLink || t.link || t.name);
        setDownloading(prev => {
            const newSet = new Set(prev);
            ids.forEach(id => newSet.add(id));
            return newSet;
        });

        // Loop and queue
        for (const torrent of torrents) {
            try {
                await api.post('/downloads/queue', {
                    torrentInfo: torrent,
                    fileType: 'series' // Assuming batch from SeasonBundle is always series
                });
                successCount++;
            } catch (err) {
                console.error('Batch download failed for:', torrent.name, err);
                failCount++;
            }
        }

        // Cleanup visual state
        setDownloading(prev => {
            const newSet = new Set(prev);
            ids.forEach(id => newSet.delete(id));
            return newSet;
        });
        setBatchProcessing(false);

        alert(`Batch finished. Queued: ${successCount}, Failed: ${failCount}`);
        if (successCount > 0) {
            navigate('/downloads');
        }
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
                <button type="submit" disabled={loading || batchProcessing}>
                    {loading ? 'Searching...' : batchProcessing ? 'Queueing...' : 'Search'}
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

                        {/* 1. Render Season Bundles */}
                        {Object.values(organizedResults.seasons)
                            .sort((a, b) => a.season - b.season)
                            .map(bundle => (
                                <SeasonBundleItem
                                    key={bundle.season}
                                    bundle={bundle}
                                    onDownloadBundle={handleBatchDownload}
                                    onDownloadSingle={handleDownloadClick}
                                />
                        ))}

                        {/* 2. Render Movies & Misc */}
                        {organizedResults.movies.length > 0 && (
                            <div className="movies-section">
                                {Object.keys(organizedResults.seasons).length > 0 && <h3>Other Results / Movies</h3>}
                                {organizedResults.movies.map((result, index) => (
                                    <div key={`${result.provider}-${result.name}-${index}`} className="result-item">
                                        <div className="result-info">
                                            <h3>{result.name}</h3>
                                            <div className="result-details">
                                                <span>Size: {result.size}</span>
                                                <span>Seeders: {result.seeders}</span>
                                                <span>Leechers: {result.leechers}</span>
                                                <span>Provider: {result.provider}</span>
                                                {result.quality && <span className="badge">{result.quality}</span>}
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
                            </div>
                        )}

                        {/* 3. Render Misc/Uncategorized if any (Usually movies array covers it, but strict check) */}
                        {/* The util puts everything non-season into movies array for simplicity, so we are good. */}
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
