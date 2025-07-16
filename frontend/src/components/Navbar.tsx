import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_AVATAR = '/uploads/avatars/default.png';

const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="nav-bar">
            <div className="nav-links">
                <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
                    Dashboard
                </Link>
                <Link to="/search" className={isActive('/search') ? 'active' : ''}>
                    Search
                </Link>
                <Link to="/downloads" className={isActive('/downloads') ? 'active' : ''}>
                    Downloads
                </Link>
                <Link to="/messages" className={isActive('/messages') ? 'active' : ''}>
                    Messages
                </Link>
                <Link to="/profile" className={isActive('/profile') ? 'active' : ''}>
                    Profile
                </Link>
                {user?.isAdmin && (
                    <Link to="/admin" className={isActive('/admin') ? 'active' : ''}>
                        Admin
                    </Link>
                )}
                <div className="nav-user">
                    {user && (
                        <>
                            <img
                                src={user.avatar_url || DEFAULT_AVATAR}
                                alt={user.username}
                                className="nav-avatar"
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    marginRight: 8,
                                    border: '1px solid #eee',
                                    background: '#fafafa'
                                }}
                                onError={e => (e.currentTarget.src = DEFAULT_AVATAR)}
                            />
                            <span>Welcome, {user.username}</span>
                        </>
                    )}
                    <button onClick={handleLogout} className="logout-btn">
                        Logout
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;