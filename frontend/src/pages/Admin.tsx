import React, { useState, useEffect, useCallback } from 'react';
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

interface SearchLogEntry {
    id: string;
    user_id: string;
    username: string;
    query: string;
    search_date: string;
    status: string;
    result_count: number;
    user?: { username: string; avatar_url?: string };
}

interface MessageLogEntry {
    id: string;
    sender_id: string;
    sender_username: string;
    recipient_id: string;
    recipient_username: string;
    message_content: string;
    message_type: 'text' | 'image' | 'file' | 'link';
    sent_at: string;
}


const Admin: React.FC = () => {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [requests, setRequests] = useState<Request[]>([]);
    const [allDownloads, setAllDownloads] = useState<any[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [searchLogs, setSearchLogs] = useState<SearchLogEntry[]>([]);
    const [messageLogs, setMessageLogs] = useState<MessageLogEntry[]>([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);

    // Helper function to format dates safely
    const formatDate = (dateString: string | null | undefined): string => {
        if (!dateString) return 'Unknown';

        try {
            const date = new Date(dateString);
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

    // Memoize the time formatters for performance
    const memoizedFormatDate = useCallback(formatDate, []);
    const memoizedGetRelativeTime = useCallback(getRelativeTime, []);

    useEffect(() => {
        fetchStats();
        fetchRequests();
        fetchAllDownloads();
    }, []);

    // Fetch users, search logs, message logs when respective tabs are selected
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'search_logs') {
            fetchSearchLogs();
        } else if (activeTab === 'message_logs') {
            fetchMessageLogs();
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
            const usersWithParsedDates = response.data.map((user: User) => ({
                ...user,
                created_at: user.created_at,
                updated_at: user.updated_at
            }));
            setUsers(usersWithParsedDates);
            console.log('Fetched users:', response.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            alert('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const fetchSearchLogs = async (userId?: string) => {
        setLoading(true);
        try {
            const url = userId ? `/admin/logs/search?userId=${userId}` : '/admin/logs/search';
            const response = await api.get(url);
            setSearchLogs(response.data);
        }
         catch (error) {
            console.error('Failed to fetch search logs:', error);
            alert('Failed to fetch search logs');
        } finally {
            setLoading(false);
        }
    };

    const fetchMessageLogs = async (userId?: string) => {
        setLoading(true);
        try {
            const url = userId ? `/admin/logs/messages?userId=${userId}` : '/admin/logs/messages';
            const response = await api.get(url);
            setMessageLogs(response.data);
        } catch (error) {
            console.error('Failed to fetch message logs:', error);
            alert('Failed to fetch message logs');
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
            fetchUsers();
            fetchStats();
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

    // NEW: Function to handle changing user password
    const handleChangeUserPassword = async (userId: string, username: string) => {
        const newPassword = prompt(`Enter new password for user "${username}":`);

        if (!newPassword) {
            alert('Password change cancelled or empty password provided.');
            return;
        }

        if (newPassword.length < 6) {
            alert('New password must be at least 6 characters long.');
            return;
        }

        if (!window.confirm(`Are you sure you want to change the password for "${username}"?`)) {
            return;
        }

        setLoading(true);
        try {
            await api.put(`/admin/users/${userId}/password`, { newPassword });
            alert(`Password for user "${username}" updated successfully!`);
        } catch (error: any) {
            console.error('Failed to change password:', error);
            alert(`Failed to change password: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Helper for message content formatting for logs
    const formatMessageLogContent = (log: MessageLogEntry) => {
        switch (log.message_type) {
            case 'image':
                return `🖼️ Image: ${log.message_content.split('/').pop()}`;
            case 'file':
                return `📎 File: ${log.message_content.split('/').pop()}`;
            case 'link':
                return `🔗 Link: ${log.message_content}`;
            default:
                return log.message_content;
        }
    };

    return (
        <div className="admin-page main-content">
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
                <button
                    className={activeTab === 'search_logs' ? 'active' : ''}
                    onClick={() => setActiveTab('search_logs')}
                >
                    Search Logs
                </button>
                <button
                    className={activeTab === 'message_logs' ? 'active' : ''}
                    onClick={() => setActiveTab('message_logs')}
                >
                    Message Logs
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
                                    <p>Requested: {memoizedFormatDate(request.created_at)}</p>
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
                                        <td>{memoizedFormatDate(download.created_at)}</td>
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
                                                                src={user.avatar_url.startsWith('/') ? user.avatar_url : `/uploads/avatars/${user.avatar_url.split('/').pop()}`}
                                                                alt={user.username}
                                                                style={{
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: '50%',
                                                                    objectFit: 'cover'
                                                                }}
                                                                onError={(e) => { e.currentTarget.src = '/uploads/avatars/default.png'; }}
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
                                                        <div>{memoizedFormatDate(user.created_at)}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                                            {memoizedGetRelativeTime(user.created_at)}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <div>{memoizedFormatDate(user.updated_at)}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                                            {memoizedGetRelativeTime(user.updated_at)}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {!user.is_admin && (
                                                        <>
                                                            <button
                                                                onClick={() => handleChangeUserPassword(user.id, user.username)}
                                                                className="btn-primary"
                                                                style={{
                                                                    marginRight: '0.5rem',
                                                                    backgroundColor: '#10b981',
                                                                    padding: '0.25rem 0.5rem',
                                                                    fontSize: '0.8rem',
                                                                }}
                                                            >
                                                                Change Password
                                                            </button>
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
                                                        </>
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

            {activeTab === 'search_logs' && (
                <div className="search-logs-section">
                    <h2>Search Logs</h2>
                    {loading ? (
                        <div className="loading">Loading search logs...</div>
                    ) : (
                        <div className="search-logs-table downloads-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Query</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th>Results</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchLogs.length > 0 ? (
                                        searchLogs.map(log => (
                                            <tr key={log.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {log.user?.avatar_url ? (
                                                            <img
                                                                src={log.user.avatar_url.startsWith('/') ? log.user.avatar_url : `/uploads/avatars/${log.user.avatar_url.split('/').pop()}`}
                                                                alt={log.username}
                                                                style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                                                onError={(e) => { e.currentTarget.src = '/uploads/avatars/default.png'; }}
                                                            />
                                                        ) : (
                                                            <div
                                                                className="avatar-placeholder"
                                                                style={{
                                                                    width: '24px',
                                                                    height: '24px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: '#2563eb',
                                                                    color: 'white',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: '600'
                                                                }}
                                                            >
                                                                {log.username[0]?.toUpperCase()}
                                                            </div>
                                                        )}
                                                        {log.username}
                                                    </div>
                                                </td>
                                                <td>{log.query}</td>
                                                <td>{memoizedFormatDate(log.search_date)}</td>
                                                <td><span className={`status ${log.status === 'success' ? 'completed' : log.status === 'error' ? 'failed' : 'queued'}`}>{log.status}</span></td>
                                                <td>{log.result_count}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No search logs found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'message_logs' && (
                <div className="message-logs-section">
                    <h2>Message Logs (Conversational Format)</h2>
                    {loading ? (
                        <div className="loading">Loading message logs...</div>
                    ) : (
                        <div className="message-logs-conversations">
                            {(() => {
                                const conversationsMap = new Map<string, MessageLogEntry[]>();
                                messageLogs.forEach(log => {
                                    const convoKey = [log.sender_id, log.recipient_id].sort().join('-');
                                    if (!conversationsMap.has(convoKey)) {
                                        conversationsMap.set(convoKey, []);
                                    }
                                    conversationsMap.get(convoKey)?.push(log);
                                });

                                return Array.from(conversationsMap.entries()).map(([key, logs]) => (
                                    <div key={key} className="message-log-conversation-group card">
                                        <h3>Conversation between {logs[0].sender_username} and {logs[0].recipient_username}</h3>
                                        <div className="message-log-entries">
                                            {logs.map(log => (
                                                <div
                                                    key={log.id}
                                                    className={`message-log-item ${log.sender_id === user?.id ? 'sent' : 'received'}`}
                                                >
                                                    <div className="message-log-content">
                                                        <strong>{log.sender_username}:</strong> {formatMessageLogContent(log)}
                                                    </div>
                                                    <div className="message-log-time">
                                                        {memoizedFormatDate(log.sent_at)} {new Date(log.sent_at).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                            {messageLogs.length === 0 && (
                                <p style={{ textAlign: 'center', padding: '2rem' }}>No message logs found.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Admin;