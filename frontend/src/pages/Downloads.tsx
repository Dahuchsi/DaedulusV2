import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

interface Download {
    id: string;
    torrent_name: string;
    file_type: string;
    status: string;
    debriding_progress: number;
    transfer_progress: number;
    download_speed: number;
    file_size?: number;
    quality?: string;
    created_at: string;
    completed_at?: string;
    alldebrid_id?: string;
}

// Real-time progress bar component (Simplified for direct display)
const RealTimeProgressBar: React.FC<{
    progress: number;
    speed: number;
    fileSize?: number; // Keep for display if needed
    status: string;
}> = ({ progress, speed, fileSize, status }) => {
    // No local state or animation needed here.
    // The `progress` prop directly reflects the most recent value from the parent.

    return (
        <div className="progress-bar">
            <div
                className="progress-fill"
                style={{
                    width: `${progress}%`, // Directly use the provided progress
                    backgroundColor: progress > 0 ? '#2563eb' : '#e5e7eb',
                    transition: 'width 0.3s ease-out' // Smooth transition when progress updates
                }}
            />
        </div>
    );
};

const Downloads: React.FC = () => {
    const [downloads, setDownloads] = useState<Download[]>([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<string>('Never');
    const { user, loading: authLoading } = useAuth();
    const socket = useSocket();

    const safeParseFloat = (value: any): number => {
        if (value === null || value === undefined || value === '') return 0;
        const parsed = parseFloat(value.toString());
        return isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
    };

    const safeParseInt = (value: any): number => {
        if (value === null || value === undefined) return 0;
        const parsed = parseInt(value.toString());
        return isNaN(parsed) ? 0 : parsed;
    };

    const formatSpeed = (bytesPerSecond: number) => {
        if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s';
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const index = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
        return `${(bytesPerSecond / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
    };

    const formatFileSize = (bytes: number) => {
        if (!bytes || bytes === 0) return 'Unknown';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const index = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
    };

    const fetchDownloads = useCallback(async () => {
        if (!user) return;
        setError(null);
        try {
            const response = await api.get('/downloads');
            const processedDownloads = (response.data || []).map((d: any, index: number) => {
                try {
                    return {
                        id: d.id || `temp-${index}`,
                        torrent_name: d.torrent_name || 'Unknown',
                        file_type: d.file_type || 'unknown',
                        status: d.status || 'unknown',
                        debriding_progress: safeParseFloat(d.debriding_progress || d.progress),
                        transfer_progress: safeParseFloat(d.transfer_progress),
                        download_speed: safeParseInt(d.download_speed),
                        file_size: safeParseInt(d.file_size),
                        quality: d.quality,
                        created_at: d.created_at || new Date().toISOString(),
                        completed_at: d.completed_at,
                        alldebrid_id: d.alldebrid_id,
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);
            setDownloads(processedDownloads);
            setLastUpdate(new Date().toLocaleTimeString());
        } catch (error: any) {
            setError(`Failed to load downloads: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Initial fetch and polling
    useEffect(() => {
        if (!authLoading) {
            if (user) {
                fetchDownloads();
                const interval = setInterval(fetchDownloads, 5000);
                return () => clearInterval(interval);
            } else {
                setError('User not authenticated');
                setLoading(false);
            }
        }
    }, [authLoading, user, fetchDownloads]);

    // WebSocket event handlers
    useEffect(() => {
        if (socket && socket.connected) {
            const handleDownloadProgress = (data: {
                downloadId: string;
                status: string;
                progress: number;
                speed: number;
                transfer_progress?: number;
            }) => {
                setDownloads(prev => prev.map(download => {
                    if (download.id === data.downloadId) {
                        const updatedDownload = { ...download };
                        if (data.status === 'debriding') {
                            updatedDownload.debriding_progress = safeParseFloat(data.progress);
                            updatedDownload.download_speed = safeParseInt(data.speed);
                            updatedDownload.status = data.status;
                        } else if (data.status === 'transferring') {
                            updatedDownload.transfer_progress = safeParseFloat(data.transfer_progress || data.progress);
                            updatedDownload.download_speed = safeParseInt(data.speed);
                            updatedDownload.status = data.status;
                            updatedDownload.debriding_progress = 100;
                        } else {
                            updatedDownload.status = data.status;
                        }
                        return updatedDownload;
                    }
                    return download;
                }));
                setLastUpdate(new Date().toLocaleTimeString());
            };

            const handleDownloadComplete = (data: { downloadId: string; name: string }) => {
                setDownloads(prev => prev.map(download => {
                    if (download.id === data.downloadId) {
                        return {
                            ...download,
                            status: 'completed',
                            completed_at: new Date().toISOString(),
                            debriding_progress: 100,
                            transfer_progress: 100,
                        };
                    }
                    return download;
                }));
                setLastUpdate(new Date().toLocaleTimeString());
                setTimeout(() => {
                    fetchDownloads();
                }, 1000);
            };

            const handleDownloadFailed = (data: { downloadId: string; error: string }) => {
                setDownloads(prev => prev.map(download => {
                    if (download.id === data.downloadId) {
                        return {
                            ...download,
                            status: 'failed',
                        };
                    }
                    return download;
                }));
                setLastUpdate(new Date().toLocaleTimeString());
            };

            // NEW: Handle cancellation event
            const handleDownloadCancelled = (data: { downloadId: string }) => {
                setDownloads(prev => prev.map(download => {
                    if (download.id === data.downloadId) {
                        return { ...download, status: 'cancelled' };
                    }
                    return download;
                }));
                setLastUpdate(new Date().toLocaleTimeString());
            };

            socket.on('download:progress', handleDownloadProgress);
            socket.on('download:complete', handleDownloadComplete);
            socket.on('download:failed', handleDownloadFailed);
            socket.on('download:cancelled', handleDownloadCancelled); // Listen for the new event

            return () => {
                socket.off('download:progress', handleDownloadProgress);
                socket.off('download:complete', handleDownloadComplete);
                socket.off('download:failed', handleDownloadFailed);
                socket.off('download:cancelled', handleDownloadCancelled); // Clean up listener
            };
        }
    }, [socket, fetchDownloads]);
    
    // --- NEW FUNCTION: Cancel a download ---
    const cancelDownload = async (downloadId: string) => {
        try {
            await api.post(`/downloads/${downloadId}/cancel`);
            // The websocket event will update the UI, but we can also optimistically update or refetch
            fetchDownloads();
        } catch (error: any) {
            alert(`Failed to cancel download: ${error.response?.data?.error || error.message}`);
        }
    };
    // --- END OF NEW FUNCTION ---

    // Function to retry failed downloads
    const retryDownload = async (downloadId: string) => {
        try {
            await api.post(`/downloads/${downloadId}/retry`);
            fetchDownloads();
        } catch (error: any) {
            alert(`Failed to retry download: ${error.response?.data?.error || error.message}`);
        }
    };

    // Function to manually check AllDebrid status
    const checkAllDebridStatus = async (downloadId: string) => {
        try {
            await api.post(`/downloads/${downloadId}/check-status`);
            fetchDownloads();
        } catch (error: any) {
            alert(`Failed to check status: ${error.response?.data?.error || error.message}`);
        }
    };

    const getStatusText = (download: Download) => {
        try {
            const debridingProgress = safeParseFloat(download.debriding_progress);
            const transferProgress = safeParseFloat(download.transfer_progress);
            switch (download.status) {
                case 'debriding':
                    return `Debriding (${debridingProgress.toFixed(1)}%)`;
                case 'transferring':
                    return `Transferring to PC (${transferProgress.toFixed(1)}%)`;
                case 'queued':
                    return 'Queued';
                case 'completed':
                    return 'Completed';
                case 'failed':
                    return 'Failed';
                case 'cancelled': // NEW
                    return 'Cancelled';
                default:
                    return download.status ? download.status.charAt(0).toUpperCase() + download.status.slice(1) : 'Unknown';
            }
        } catch {
            return 'Unknown';
        }
    };

    const filteredDownloads = downloads.filter(d => {
        if (filter === 'all') return true;
        if (filter === 'active') return ['queued', 'debriding', 'transferring'].includes(d.status);
        if (filter === 'cancelled') return d.status === 'cancelled'; // NEW filter view
        return d.status === filter;
    });

    if (loading) {
        return (
            <div className="downloads-page main-content">
                <h1>Downloads</h1>
                <div className="loading">Loading downloads...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="downloads-page main-content">
                <h1>Downloads</h1>
                <div className="error-message">
                    {error}
                    <button onClick={fetchDownloads} style={{ marginLeft: '1rem' }}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="downloads-page main-content">
            <h1>Downloads</h1>
            <div style={{
                background: (socket && socket.connected) ? '#e8f5e8' : '#fff3cd',
                padding: '1rem',
                marginBottom: '1rem',
                borderRadius: '4px',
                border: `1px solid ${(socket && socket.connected) ? '#28a745' : '#ffc107'}`
            }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: (socket && socket.connected) ? '#155724' : '#856404' }}>
                    {(socket && socket.connected) ? '🟢 Real-time Status' : '🟡 Polling Mode'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <p><strong>Total downloads:</strong> {downloads.length}</p>
                    <p><strong>Filtered downloads:</strong> {filteredDownloads.length}</p>
                    <p><strong>WebSocket:</strong> {(socket && socket.connected) ? '✅ Connected' : '❌ Disconnected'}</p>
                    <p><strong>Last update:</strong> {lastUpdate}</p>
                    <p><strong>User:</strong> {user?.username || 'Not logged in'}</p>
                    <p><strong>Update mode:</strong> {(socket && socket.connected) ? 'Real-time + Polling' : 'Polling only'}</p>
                </div>
            </div>
            <div className="filter-controls">
                <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                    All ({downloads.length})
                </button>
                <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>
                    Active ({downloads.filter(d => ['queued', 'debriding', 'transferring'].includes(d.status)).length})
                </button>
                <button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>
                    Completed ({downloads.filter(d => d.status === 'completed').length})
                </button>
                <button className={filter === 'failed' ? 'active' : ''} onClick={() => setFilter('failed')}>
                    Failed ({downloads.filter(d => d.status === 'failed').length})
                </button>
                {/* Optional: Add a filter for cancelled downloads */}
                <button className={filter === 'cancelled' ? 'active' : ''} onClick={() => setFilter('cancelled')}>
                    Cancelled ({downloads.filter(d => d.status === 'cancelled').length})
                </button>
            </div>
            <div className="downloads-list">
                {filteredDownloads.length === 0 ? (
                    <div className="no-data">
                        <h3>No downloads found</h3>
                        {downloads.length === 0
                            ? <p>No downloads yet. Start by searching and downloading some content!</p>
                            : <p>No downloads match the current filter.</p>
                        }
                    </div>
                ) : (
                    filteredDownloads.map((download, index) => (
                        <div key={download.id || index} className="download-item">
                            <div className="download-info">
                                <h3>{download.torrent_name}</h3>
                                <div className="download-meta">
                                    <span className={`status ${download.status}`}>
                                        {getStatusText(download)}
                                    </span>
                                    <span className="file-type">📁 {download.file_type}</span>
                                    {download.file_size && download.file_size > 0 && (
                                        <span className="file-size">💾 {formatFileSize(download.file_size)}</span>
                                    )}
                                    {download.quality && (
                                        <span className="quality">🎯 {download.quality}</span>
                                    )}
                                    {download.alldebrid_id && (
                                        <span className="alldebrid-id">🔗 AD: {download.alldebrid_id}</span>
                                    )}
                                    <span className="date">
                                        {download.status === 'completed' && download.completed_at
                                            ? `✅ Completed: ${new Date(download.completed_at).toLocaleString()}`
                                            : `📅 Added: ${new Date(download.created_at).toLocaleString()}`
                                        }
                                    </span>
                                </div>
                            </div>
                            
                            {/* --- THIS BLOCK WAS MOVED --- */}
                            <div className="download-actions" style={{ marginTop: '0.5rem' }}>
                                {/* FAILED DOWNLOADS */}
                                {download.status === 'failed' && (
                                    <>
                                        <button
                                            onClick={() => retryDownload(download.id)}
                                            className="btn-primary"
                                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                        >
                                            🔄 Retry
                                        </button>
                                        <button
                                            onClick={() => checkAllDebridStatus(download.id)}
                                            className="btn-secondary"
                                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                        >
                                            🔍 Check AllDebrid
                                        </button>
                                    </>
                                )}

                                {/* ACTIVE DOWNLOADS (CANCEL BUTTON) */}
                                {['queued', 'debriding', 'transferring'].includes(download.status) && (
                                    <button
                                        onClick={() => cancelDownload(download.id)}
                                        className="btn-danger"
                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                    >
                                        ❌ Cancel
                                    </button>
                                )}
                            </div>
                             {/* --- END MOVED BLOCK --- */}
                            
                            {download.status === 'debriding' && (
                                <div className="download-progress">
                                    <RealTimeProgressBar
                                        progress={download.debriding_progress}
                                        speed={download.download_speed}
                                        fileSize={download.file_size}
                                        status={download.status}
                                    />
                                    <div className="progress-stats">
                                        <span>{download.debriding_progress.toFixed(1)}%</span>
                                        <span>{formatSpeed(download.download_speed)}</span>
                                    </div>
                                    <span className="progress-label">
                                        🔄 Processing with AllDebrid
                                        {(socket && socket.connected) && <span style={{ color: '#28a745', marginLeft: '0.5rem' }}>● Live</span>}
                                    </span>
                                </div>
                            )}
                            {download.status === 'transferring' && (
                                <div className="download-progress">
                                    <RealTimeProgressBar
                                        progress={download.transfer_progress}
                                        speed={download.download_speed}
                                        fileSize={download.file_size}
                                        status={download.status}
                                    />
                                    <div className="progress-stats">
                                        <span>{download.transfer_progress.toFixed(1)}%</span>
                                        <span>{formatSpeed(download.download_speed)}</span>
                                    </div>
                                    <span className="progress-label">
                                       ⬇️ Downloading to your PC
                                        {(socket && socket.connected) && <span style={{ color: '#28a745', marginLeft: '0.5rem' }}>● Live</span>}
                                    </span>
                                </div>
                            )}
                            {download.status === 'queued' && (
                                <div className="download-progress">
                                    <span className="progress-label">⏳ Waiting in queue...</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button onClick={fetchDownloads} className="btn-primary">
                    🔄 Refresh Downloads
                </button>
            </div>
        </div>
    );
};

export default Downloads;