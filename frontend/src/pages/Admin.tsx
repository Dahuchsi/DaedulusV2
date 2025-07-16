import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface UserStats {
    total_users: number;
    active_users: number;
    total_downloads: number;
    pending_requests: number;
}

interface Request {
    id: string;
    user_id: string;
    username: string;
    search_query: string;
    torrent_info: any;
    status: string;
    created_at: string;
}

interface User {
    id: string;
    username: string;
    email: string;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
    avatar_url?: string;
    bio?: string;
    display_phrase?: string;
}

const Admin: React.FC = () => {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [requests, setRequests] = useState<Request[]>([]);
    const [allDownloads, setAllDownloads] = useState([]);
    const [users, setUsers] = useState<User[]>([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);

    // Helper function to format dates safely
    const formatDate = (dateString: string | null | undefined): string => {
        if (!dateString) return 'Unknown';
        
        try {
            const date = new Date(dateString);
            // Check if date is valid
            if (isNaN(date.getTime())) {
                return 'Unknown';
            }
            return date.toLocaleDateString();
        } catch (error) {
            console.error('Date formatting error:', error);
            return 'Unknown';
        }
    };

    // Helper function to get relative time
    const getRelativeTime = (dateString: string | null | undefined): string => {
        if (!dateString) return 'Unknown';
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Unknown';
            
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
            return `${Math.floor(diffDays / 365)} years ago`;
        } catch (error) {
            return 'Unknown';
        }
    };

    useEffect(() => {
        fetchStats();
        fetchRequests();
        fetchAllDownloads();
    }, []);

    // Fetch users when Users tab is selected
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab]);

    const fetchStats = async () => {
        try {
            const response = await api.get('/admin/stats');
            setStats(response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchRequests = async () => {
        try {
            const response = await api.get('/admin/requests');
            setRequests(response.data);
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        }
    };

    const fetchAllDownloads = async () => {
        try {
            const response = await api.get('/admin/downloads');
            setAllDownloads(response.data);
        } catch (error) {
            console.error('Failed to fetch downloads:', error);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/users');
            setUsers(response.data);
            console.log('Fetched users:', response.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            alert('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string, username: string) => {
        const confirmDelete = window.confirm(
            `Are you sure you want to delete user "${username}"? This action cannot be undone and will remove all their data including downloads, messages, and requests.`
        );
        
        if (!confirmDelete) return;

        try {
            await api.delete(`/admin/users/${userId}`);
            alert(`User "${username}" deleted successfully`);
            fetchUsers(); // Refresh the users list
            fetchStats(); // Refresh stats
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert('Failed to delete user');
        }
    };

    const handleRequestAction = async (requestId: string, action: 'fulfill' | 'reject') => {
        try {
            await api.put(`/admin/requests/${requestId}`, { status: action });
            fetchRequests();
            alert(`Request ${action}ed successfully`);
        } catch (error) {
            console.error('Failed to update request:', error);
        }
    };

    const broadcastMessage = async () => {
        const message = prompt('Enter message to broadcast to all users:');
        if (!message) return;

        try {
            await api.post('/admin/broadcast', { message });
            alert('Message broadcasted successfully');
        } catch (error) {
            console.error('Failed to broadcast message:', error);
        }
    };

    return (
        <div className="admin-page">
            <h1>Admin Dashboard - Dahuchsi</h1>

            <div className="admin-tabs">
                <button 
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button 
                    className={activeTab === 'requests' ? 'active' : ''}
                    onClick={() => setActiveTab('requests')}
                >
                    Requests ({stats?.pending_requests || 0})
                </button>
                <button 
                    className={activeTab === 'downloads' ? 'active' : ''}
                    onClick={() => setActiveTab('downloads')}
                >
                    All Downloads
                </button>
                <button 
                    className={activeTab === 'users' ? 'active' : ''}
                    onClick={() => setActiveTab('users')}
                >
                    Users ({stats?.total_users || 0})
                </button>
            </div>

            {activeTab === 'overview' && stats && (
                <div className="admin-overview">
                    <div className="stats-grid">
                        <div className="stat-card">
                            <h3>Total Users</h3>
                            <p className="stat-number">{stats.total_users}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Active Users</h3>
                            <p className="stat-number">{stats.active_users}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Total Downloads</h3>
                            <p className="stat-number">{stats.total_downloads}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Pending Requests</h3>
                            <p className="stat-number">{stats.pending_requests}</p>
                        </div>
                    </div>

                    <div className="admin-actions">
                        <button onClick={broadcastMessage} className="broadcast-btn">
                            Broadcast Message to All Users
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="requests-section">
                    <h2>User Requests</h2>
                    <div className="requests-list">
                        {requests.filter(r => r.status === 'pending').map(request => (
                            <div key={request.id} className="request-item">
                                <div className="request-info">
                                    <h4>{request.search_query}</h4>
                                    <p>From: {request.username}</p>
                                    <p>Requested: {formatDate(request.created_at)}</p>
                                    {request.torrent_info && (
                                        <p>Torrent: {request.torrent_info.name}</p>
                                    )}
                                </div>
                                <div className="request-actions">
                                    <button 
                                        onClick={() => handleRequestAction(request.id, 'fulfill')}
                                        className="fulfill-btn"
                                    >
                                        Fulfill
                                    </button>
                                    <button 
                                        onClick={() => handleRequestAction(request.id, 'reject')}
                                        className="reject-btn"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'downloads' && (
                <div className="downloads-section">
                    <h2>All User Downloads</h2>
                    <div className="downloads-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>File</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allDownloads.map((download: any) => (
                                    <tr key={download.id}>
                                        <td>{download.username}</td>
                                        <td>{download.torrent_name}</td>
                                        <td>{download.file_type}</td>
                                        <td>
                                            <span className={`status ${download.status}`}>
                                                {download.status}
                                            </span>
                                        </td>
                                        <td>{formatDate(download.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="users-section">
                    <h2>All Users</h2>
                    {loading ? (
                        <div className="loading">Loading users...</div>
                    ) : (
                        <div className="users-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Avatar</th>
                                        <th>Username</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Joined</th>
                                        <th>Last Active</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length > 0 ? (
                                        users.map((user) => (
                                            <tr key={user.id}>
                                                <td>
                                                    <div className="user-avatar">
                                                        {user.avatar_url ? (
                                                            <img 
                                                                src={user.avatar_url} 
                                                                alt={user.username}
                                                                style={{
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: '50%',
                                                                    objectFit: 'cover'
                                                                }}
                                                            />
                                                        ) : (
                                                            <div 
                                                                className="avatar-placeholder"
                                                                style={{
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: '#2563eb',
                                                                    color: 'white',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: '600'
                                                                }}
                                                            >
                                                                {user.username[0].toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <strong>{user.username}</strong>
                                                        {user.display_phrase && (
                                                            <div style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
                                                                "{user.display_phrase}"
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>{user.email}</td>
                                                <td>
                                                    <span className={`role-badge ${user.is_admin ? 'admin' : 'user'}`}>
                                                        {user.is_admin ? 'Admin' : 'User'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div>
                                                        <div>{formatDate(user.created_at)}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                                            {getRelativeTime(user.created_at)}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <div>{formatDate(user.updated_at)}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                                            {getRelativeTime(user.updated_at)}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {!user.is_admin && (
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id, user.username)}
                                                            className="delete-user-btn"
                                                            style={{
                                                                backgroundColor: '#ef4444',
                                                                color: 'white',
                                                                border: 'none',
                                                                padding: '0.25rem 0.5rem',
                                                                borderRadius: '0.25rem',
                                                                fontSize: '0.8rem',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                                                No users found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Admin;