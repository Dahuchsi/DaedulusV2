import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_AVATAR = '/uploads/avatars/default.png';

const Profile: React.FC = () => {
    const { user, updateUser } = useAuth();
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        bio: '',
        display_phrase: '',
        avatar_url: ''
    });
    const [watchlists, setWatchlists] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Defensive: always set watchlists as array
    const fetchWatchlists = useCallback(async () => {
        if (!user) return;
        try {
            const response = await api.get('/profile/me/watchlists');
            setWatchlists(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            setError('Failed to fetch watchlists');
            setWatchlists([]);
            console.error('Failed to fetch watchlists:', error);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            setFormData({
                bio: user.bio || '',
                display_phrase: user.display_phrase || '',
                avatar_url: user.avatar_url || DEFAULT_AVATAR
            });
            fetchWatchlists();
            setLoading(false);
        }
    }, [user, fetchWatchlists]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.put('/profile/me', formData);
            updateUser(response.data);
            setEditing(false);
            alert('Profile updated successfully');
        } catch (error) {
            setError('Failed to update profile');
            console.error('Failed to update profile:', error);
            alert('Failed to update profile');
        }
    };

    // Image resizing function
    const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.8): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Could not get canvas context');
                resolve(null);
                return;
            }
            
            const img = new Image();

            img.onload = () => {
                let { width, height } = img;
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', quality);
            };

            img.onerror = () => {
                console.error('Failed to load image for resizing');
                resolve(null);
            };

            img.src = URL.createObjectURL(file);
        });
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        console.log('Selected file:', file);
        
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('Image file size must be less than 5MB');
            return;
        }
        
        setUploading(true);

        try {
            // First, try uploading the original file without resizing
            console.log('Uploading original file first...');
            const uploadFormData = new FormData();
            uploadFormData.append('avatar', file, file.name);
            
            console.log('FormData created:', uploadFormData);
            console.log('FormData entries:');
            uploadFormData.forEach((value, key) => {
                console.log(key, value);
            });

            const response = await api.post('/profile/me/avatar', uploadFormData);
            console.log('Upload response:', response.data);
            
            setFormData(prev => ({ ...prev, avatar_url: response.data.avatar_url }));
            if (user) updateUser({ ...user, avatar_url: response.data.avatar_url });
            alert('Profile picture updated successfully');

            // If you want to use resizing later, uncomment this block:
            /*
            console.log('Resizing image...');
            const resizedBlob = await resizeImage(file, 200, 200, 0.9);
            console.log('Resized blob:', resizedBlob);
            
            if (!resizedBlob) throw new Error('Failed to resize image');
            
            const uploadFormData = new FormData();
            uploadFormData.append('avatar', resizedBlob, `avatar-${user?.id}.jpg`);
            
            console.log('FormData created with resized blob:', uploadFormData);
            console.log('FormData entries:');
            uploadFormData.forEach((value, key) => {
                console.log(key, value);
            });

            const response = await api.post('/profile/me/avatar', uploadFormData);
            console.log('Upload response:', response.data);
            
            setFormData(prev => ({ ...prev, avatar_url: response.data.avatar_url }));
            if (user) updateUser({ ...user, avatar_url: response.data.avatar_url });
            alert('Profile picture updated successfully');
            */

        } catch (error) {
            setError('Failed to upload profile picture');
            console.error('Failed to upload avatar:', error);
            alert('Failed to upload profile picture');
        } finally {
            setUploading(false);
        }
    };

    // Defensive: always use a valid avatar URL
    const avatarUrl = formData.avatar_url || DEFAULT_AVATAR;

    if (loading) return <div className="loading">Loading profile...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!user) return <div className="error">User not found.</div>;

    return (
        <div className="profile-page">
            <h1>My Profile</h1>
            <div className="profile-section">
                <div className="profile-header">
                    <div className="avatar-section">
                        <div className="avatar-large">
                            <img
                                src={avatarUrl}
                                alt={user.username}
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    objectFit: 'cover',
                                    borderRadius: '50%',
                                    border: '2px solid #eee',
                                    background: '#fafafa'
                                }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                                }}
                            />
                            {uploading && (
                                <div className="upload-overlay">
                                    <div className="upload-spinner">Uploading...</div>
                                </div>
                            )}
                        </div>
                        {editing && (
                            <div className="avatar-upload-section">
                                <input
                                    type="file"
                                    id="avatar-upload"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    className="avatar-upload"
                                    disabled={uploading}
                                    style={{ display: 'none' }}
                                />
                                <label
                                    htmlFor="avatar-upload"
                                    className={`avatar-upload-btn ${uploading ? 'disabled' : ''}`}
                                >
                                    {uploading ? 'Uploading...' : 'Change Photo'}
                                </label>
                                <p className="upload-hint">
                                    Max 5MB • JPG, PNG, GIF • Will be resized to 200x200px
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="profile-info">
                        <h2>{user.username}</h2>
                        <p className="email">{user.email}</p>
                        {formData.display_phrase && !editing && (
                            <p className="display-phrase">"{formData.display_phrase}"</p>
                        )}
                    </div>
                </div>

                {editing ? (
                    <form onSubmit={handleSubmit} className="profile-form">
                        <div className="form-group">
                            <label>Bio</label>
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                rows={4}
                                placeholder="Tell us about yourself..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Display Phrase</label>
                            <input
                                type="text"
                                value={formData.display_phrase}
                                onChange={(e) => setFormData({ ...formData, display_phrase: e.target.value })}
                                placeholder="A short quote or phrase..."
                                maxLength={255}
                            />
                        </div>
                        <div className="form-actions">
                            <button type="submit">Save Changes</button>
                            <button type="button" onClick={() => setEditing(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="profile-display">
                        {formData.bio && (
                            <div className="bio-section">
                                <h3>About Me</h3>
                                <p>{formData.bio}</p>
                            </div>
                        )}
                        <button onClick={() => setEditing(true)} className="edit-button">
                            Edit Profile
                        </button>
                    </div>
                )}
            </div>

            <div className="watchlists-section">
                <h2>My Watchlists</h2>
                <div className="watchlists-grid">
                    {Array.isArray(watchlists) && watchlists.length > 0 ? (
                        watchlists.map((list: any) => (
                            <div key={list.id} className="watchlist-card">
                                <h3>{list.name}</h3>
                                <p>{Array.isArray(list.items) ? list.items.length : 0} items</p>
                            </div>
                        ))
                    ) : (
                        <p>You have no watchlists yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;