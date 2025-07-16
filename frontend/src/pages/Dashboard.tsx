import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Dummy recent searches for demo; replace with your real data source if needed
const RECENT_SEARCHES = [
  'Ubuntu ISO',
  'React tutorial',
  'Taylor Swift',
  'Planet Earth II',
  'Node.js best practices'
];

interface DashboardStats {
  totalDownloads: number;
  activeDownloads: number;
  completedDownloads: number;
  totalSize: string;
}

interface RecentDownload {
  id: string;
  torrent_name: string;
  status: string;
  created_at: string;
  file_type: string;
  file_size: number;
}

const RecentSearches: React.FC = () => {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="dashboard-section">
      <h2>Recent Searches</h2>
      <div className="recent-searches-list">
        {RECENT_SEARCHES.map((search, idx) => (
          <div
            key={idx}
            className={`recent-search-item${active === search ? ' active' : ''}`}
            onClick={() => setActive(search)}
            tabIndex={0}
            title={search}
          >
            {search}
          </div>
        ))}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDownloads, setRecentDownloads] = useState<RecentDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'type' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateTotalSize = (downloads: any[]) => {
    const totalBytes = downloads
      .filter(d => d.status === 'completed')
      .reduce((sum, d) => sum + (parseInt(d.file_size) || 0), 0);
    return formatFileSize(totalBytes);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const handleSort = (column: 'name' | 'date' | 'type' | 'size') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortedDownloads = () => {
    const sorted = [...recentDownloads].sort((a, b) => {
      let compareValue = 0;
      switch (sortBy) {
        case 'name':
          compareValue = a.torrent_name.localeCompare(b.torrent_name);
          break;
        case 'date':
          compareValue = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'type':
          compareValue = a.file_type.localeCompare(b.file_type);
          break;
        case 'size':
          compareValue = (a.file_size || 0) - (b.file_size || 0);
          break;
      }
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
    return sorted;
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return '↕️';
    return sortOrder === 'asc' ? '⬆️' : '⬇️';
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const downloadsRes = await api.get('/downloads');
      const downloads = downloadsRes.data;
      const stats: DashboardStats = {
        totalDownloads: downloads.length,
        activeDownloads: downloads.filter((d: any) =>
          ['queued', 'debriding', 'transferring'].includes(d.status)
        ).length,
        completedDownloads: downloads.filter((d: any) => d.status === 'completed').length,
        totalSize: calculateTotalSize(downloads)
      };
      setStats(stats);
      setRecentDownloads(downloads.slice(0, 10));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const sortedDownloads = getSortedDownloads();

  return (
    <div className="dashboard-page main-content">
      <h1>Welcome back, {user?.username}!</h1>

      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Total Downloads</h3>
          <p className="stat-number">{stats?.totalDownloads || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Active Downloads</h3>
          <p className="stat-number">{stats?.activeDownloads || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Completed</h3>
          <p className="stat-number">{stats?.completedDownloads || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Downloaded</h3>
          <p className="stat-number">{stats?.totalSize || '0 B'}</p>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Completed files only
          </p>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <h2>Quick Actions</h2>
          <div className="quick-actions">
            <Link to="/search" className="action-card">
              <h3>Search Torrents</h3>
              <p>Find movies, series, and music</p>
            </Link>
            <Link to="/downloads" className="action-card">
              <h3>View Downloads</h3>
              <p>Monitor your active downloads</p>
            </Link>
            <Link to="/messages" className="action-card">
              <h3>Messages</h3>
              <p>Chat with friends and admin</p>
            </Link>
          </div>
        </div>

        {/* Recent Downloads Table */}
        <div className="dashboard-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Recent Downloads</h2>
            <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              Showing {sortedDownloads.length} downloads
            </span>
          </div>
          {recentDownloads.length > 0 ? (
            <div className="recent-downloads-table">
              <div className="downloads-table-header">
                <div
                  className={`header-cell name ${sortBy === 'name' ? 'active' : ''}`}
                  onClick={() => handleSort('name')}
                >
                  Name {getSortIcon('name')}
                </div>
                <div
                  className={`header-cell type ${sortBy === 'type' ? 'active' : ''}`}
                  onClick={() => handleSort('type')}
                >
                  Type {getSortIcon('type')}
                </div>
                <div
                  className={`header-cell size ${sortBy === 'size' ? 'active' : ''}`}
                  onClick={() => handleSort('size')}
                >
                  Size {getSortIcon('size')}
                </div>
                <div
                  className={`header-cell date ${sortBy === 'date' ? 'active' : ''}`}
                  onClick={() => handleSort('date')}
                >
                  Date {getSortIcon('date')}
                </div>
                <div className="header-cell status">Status</div>
              </div>
              <div className="downloads-table-body">
                {sortedDownloads.map(download => (
                  <div key={download.id} className="download-row">
                    <div className="cell name">
                      <span className="download-name" title={download.torrent_name}>
                        {download.torrent_name}
                      </span>
                    </div>
                    <div className="cell type">
                      <span className={`file-type-badge ${download.file_type}`}>
                        {download.file_type === 'movie' ? '🎬' :
                          download.file_type === 'series' ? '📺' :
                            download.file_type === 'music' ? '🎵' : '📁'}
                        {download.file_type}
                      </span>
                    </div>
                    <div className="cell size">
                      {formatFileSize(download.file_size || 0)}
                    </div>
                    <div className="cell date">
                      {formatDate(download.created_at)}
                    </div>
                    <div className="cell status">
                      <span className={`status ${download.status}`}>
                        {download.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/downloads" className="view-all-link">
                View all downloads →
              </Link>
            </div>
          ) : (
            <p className="no-data">No downloads yet. Start searching!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;