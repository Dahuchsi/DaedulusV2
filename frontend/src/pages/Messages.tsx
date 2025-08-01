import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import '../styles/Messages.css'; // Ensure this is imported

interface Message {
    id: string;
    sender_id: string;
    recipient_id: string;
    content: string;
    message_type: 'text' | 'image' | 'file' | 'link';
    is_read: boolean;
    created_at: string;
    sender?: {
    username: string;
    avatar_url?: string;
    };
    text?: string;
}

interface Conversation {
    friend_id: string;
    friend_username: string;
    friend_avatar?: string;
    last_message?: Message;
    unread_count: number;
}

const DEFAULT_AVATAR = '/uploads/avatars/default.png';

const getAvatar = (avatarUrl: string | undefined | null, username: string) =>
    avatarUrl && avatarUrl.trim() !== ''
    ? avatarUrl
    : DEFAULT_AVATAR;

const Messages: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [uploadingFile, setUploadingFile] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState<string>('');
    const [isMobile, setIsMobile] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const { user } = useAuth();
    const socket = useSocket();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout>();

    // Detect mobile device
    useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Format message time
    const formatMessageTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
    } catch {
    return '';
    }
    };

    // Fetch conversations
    const fetchConversations = useCallback(async () => {
    try {
    const response = await api.get('/messages/conversations');
    setConversations(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
    console.error('Failed to fetch conversations:', error);
    }
    }, []);

    // Fetch messages and mark as read
    const fetchMessages = useCallback(async (friendId: string) => {
        try {
            const response = await api.get(`/messages/${friendId}`);
            setMessages(Array.isArray(response.data) ? response.data : []);
            setSelectedConversation(friendId);
            await api.put(`/messages/${friendId}/read`);
            await fetchConversations();
            // Ensure scroll to bottom on new conversation load
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 0); // Use 0 timeout to push to next event loop cycle
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    }, [fetchConversations]);

    // Handle new incoming message
    const handleNewMessage = useCallback((message: Message) => {
    if (selectedConversation === message.sender_id || selectedConversation === message.recipient_id) {
    setMessages(prev => {
    const exists = prev.some(m => m.id === message.id);
    if (exists) return prev;
    return [...prev, message];
    });
    // Mark as read if the message is for the open conversation
    // Updated to use try-catch for robustness during real-time updates
    (async () => {
        try {
            await api.put(`/messages/${selectedConversation}/read`);
            fetchConversations(); // Refresh unread counts
        } catch (err) {
            console.warn('Failed to mark message as read via real-time update:', err);
        }
    })();
    } else {
    fetchConversations();
    }
    setTimeout(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    }, [selectedConversation, fetchConversations]);

    // Handle real-time read receipts
    const handleMessageRead = useCallback((data: { messageId: string; readerId: string }) => {
    setMessages(prevMessages =>
    prevMessages.map(msg =>
    msg.id === data.messageId
    ? { ...msg, is_read: true }
    : msg
    )
    );
    }, []);

    // Typing indicators
    const handleTypingStart = useCallback((data: { userId: string, username: string }) => {
    if (data.userId === selectedConversation) {
    setTypingUsers(prev => new Set(prev.add(data.username)));
    }
    }, [selectedConversation]);

    const handleTypingStop = useCallback((data: { userId: string, username: string }) => {
    setTypingUsers(prev => {
    const newSet = new Set(prev);
    newSet.delete(data.username);
    return newSet;
    });
    }, []);

    // Socket event handlers
    useEffect(() => {
    if (socket && socket.connected && user) {
    socket.emit('join:user', user.id);
    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead); // Listen for read receipts
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    return () => {
    socket.off('message:new', handleNewMessage);
    socket.off('message:read', handleMessageRead); // Clean up read receipt listener
    socket.off('typing:start', handleTypingStart);
    socket.off('typing:stop', handleTypingStop);
    };
    }
    }, [socket, user, handleNewMessage, handleMessageRead, handleTypingStart, handleTypingStop]);

    // Initial fetch
    useEffect(() => {
    fetchConversations();
    }, [fetchConversations]);

    // Auto-scroll to bottom (ensure this works reliably)
    useEffect(() => {
        // Only scroll if there are messages and the ref is available
        if (messages.length > 0 && messagesEndRef.current) {
            const timer = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100); // Small delay to ensure DOM update
            return () => clearTimeout(timer);
        }
    }, [messages]); // Dependency on messages array

    // Handle typing indication
    const handleTyping = () => {
    if (!isTyping && selectedConversation && socket) {
    setIsTyping(true);
    socket.emit('typing:start', {
    recipientId: selectedConversation,
    userId: user?.id,
    username: user?.username
    });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
    if (isTyping && selectedConversation && socket) {
    setIsTyping(false);
    socket.emit('typing:stop', {
    recipientId: selectedConversation,
    userId: user?.id,
    username: user?.username
    });
    }
    }, 1000);
    };

    // Reset mobile viewport after sending (ONLY on mobile)
    const resetMobileViewport = () => {
        if (isMobile && messageInputRef.current) { // Only run if mobile
            messageInputRef.current.blur();
            // Removed window.scrollTo(0, 0) as it was causing desktop jumps
        }
    };

    // Send message (text, file, or both)
    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        setSendError(null);
        if (!selectedConversation) return;

        // Stop typing indicator
        if (isTyping && socket) {
            setIsTyping(false);
            socket.emit('typing:stop', {
                recipientId: selectedConversation,
                userId: user?.id,
                username: user?.username
            });
        }

        let newMsg: Message | null = null;

        try {
            if (selectedFile) {
                setUploadingFile(true);
                const formData = new FormData();
                formData.append('file', selectedFile);
                formData.append('recipient_id', selectedConversation);
                if (newMessage.trim()) formData.append('text', newMessage.trim());

                const response = await api.post('/messages/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                newMsg = response.data.message || response.data;
                setSelectedFile(null);
                setFilePreviewUrl('');
                setNewMessage('');
                setUploadingFile(false);
            } else if (newMessage.trim()) {
                const response = await api.post('/messages', {
                    recipient_id: selectedConversation,
                    content: newMessage.trim(),
                    message_type: 'text'
                });
                newMsg = response.data;
                setNewMessage('');
            }
        } catch (error: any) {
            setUploadingFile(false);
            if (
                error?.response?.status !== 409 &&
                error?.message !== 'Network Error'
            ) {
                setSendError('Failed to send message');
            } else {
                setSendError(null);
            }
            console.error('Failed to send message:', error);
            return; // Exit if initial send fails
        }

        // --- Refactored Post-send Follow-up with separate try-catch blocks ---
        // This block ensures messages are updated locally and read status is sent
        // regardless of potential issues with fetchConversations or markAsRead.
        // Each await call is now self-contained for error handling, which helps with transpilation.
        try {
            if (newMsg) {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === newMsg!.id);
                    if (exists) return prev;
                    return [...prev, newMsg!];
                });

                // Explicit try-catch for marking as read
                try {
                    await api.put(`/messages/${selectedConversation}/read`);
                } catch (err) {
                    console.warn('Failed to mark as read:', err);
                }

                // Explicit try-catch for refreshing conversations
                try {
                    await fetchConversations();
                } catch (err) {
                    console.warn('Failed to refresh conversations:', err);
                }
            }
            // `resetMobileViewport()` is intentionally placed after API calls and state updates
            // to allow scrollIntoView to happen correctly, and now only for mobile.
            if (isMobile) {
                resetMobileViewport();
            }
        } catch (err) {
            console.warn('Post-send follow-up failed:', err);
            // No setSendError here as message itself was already sent successfully
        }
    };

    // Handle file selection and preview
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
    setFilePreviewUrl(URL.createObjectURL(file));
    } else {
    setFilePreviewUrl('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Format message content based on type
    const formatMessageContent = (message: Message) => {
    switch (message.message_type) {
    case 'image':
    return (
    <img
    src={message.content}
    alt="Shared file"
    style={{
    maxWidth: isMobile ? '250px' : '300px',
    maxHeight: isMobile ? '200px' : '250px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'block'
    }}
    onClick={() => window.open(message.content, '_blank')}
    />
    );
    case 'file': {
    const fileName = message.content.split('/').pop() || 'Unknown file';
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(fileExtension || '');
    if (isVideo) {
    return (
    <video
    src={message.content}
    controls
    style={{
    maxWidth: isMobile ? '250px' : '300px',
    maxHeight: isMobile ? '200px' : '250px',
    borderRadius: '8px'
    }}
    />
    );
    }
    return (
    <a
    href={message.content}
    download
    target="_blank"
    rel="noopener noreferrer"
    style={{
    color: message.sender_id === user?.id ? 'white' : '#2563eb',
    textDecoration: 'underline',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
    }}
    >
    📎 {fileName}
    </a>
    );
    }
    case 'link':
    return (
    <a
    href={message.content}
    target="_blank"
    rel="noopener noreferrer"
    style={{
    color: message.sender_id === user?.id ? 'white' : '#2563eb',
    textDecoration: 'underline'
    }}
    >
    🔗 {message.content}
    </a>
    );
    default: {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = message.content.split(urlRegex);
    return parts.map((part, index) =>
    urlRegex.test(part) ? (
    <a
    key={index}
    href={part}
    target="_blank"
    rel="noopener noreferrer"
    style={{
    color: message.sender_id === user?.id ? 'white' : '#2563eb',
    textDecoration: 'underline'
    }}
    >
    {part}
    </a>
    ) : part
    );
    }
    }
    };

    const selectedFriend = conversations.find(c => c.friend_id === selectedConversation);

    // Find the last message you sent that has been read by the recipient
    const lastReadMessageId = React.useMemo(() => {
    const sentMessages = messages.filter(
    m => m.sender_id === user?.id && m.is_read
    );
    if (sentMessages.length === 0) return null;
    return sentMessages[sentMessages.length - 1].id;
    }, [messages, user?.id]);

    // The other user in the conversation
    const otherUser = selectedFriend
    ? { username: selectedFriend.friend_username, avatar_url: selectedFriend.friend_avatar }
    : null;

    // Back function for mobile
    const handleBackToConversations = useCallback(() => {
        setSelectedConversation(null);
        setMessages([]); // Clear messages when going back
    }, []);


    return (
        <div className={`messages-page ${isMobile ? 'mobile' : ''}`}>
            {/* Conditional rendering for mobile conversation list */}
            {(!isMobile || !selectedConversation) && ( /* Show sidebar if not mobile OR if mobile but no conversation selected */
                <div className="conversations-sidebar">
                    <h2>Conversations</h2>
                    <div className={`conversations-list ${isMobile ? 'mobile-grid' : ''}`}>
                        {conversations.map(conv => (
                            <div
                                key={conv.friend_id}
                                className={`conversation-item ${selectedConversation === conv.friend_id ? 'active' : ''} ${isMobile ? 'mobile-conversation' : ''}`}
                                onClick={() => fetchMessages(conv.friend_id)}
                            >
                                <div className="conversation-avatar">
                                    <img
                                        src={getAvatar(conv.friend_avatar, conv.friend_username)}
                                        alt={conv.friend_username}
                                        className="avatar-circle"
                                        onError={e => (e.currentTarget.src = DEFAULT_AVATAR)}
                                    />
                                </div>
                                <div className="conversation-info">
                                    <h4>{conv.friend_username}</h4>
                                    {!isMobile && conv.last_message && (
                                        <p className="last-message">
                                            {conv.last_message.message_type === 'text'
                                                ? conv.last_message.content
                                                : `📎 ${conv.last_message.message_type}`
                                            }
                                        </p>
                                    )}
                                </div>
                                {conv.unread_count > 0 && selectedConversation !== conv.friend_id && (
                                    <span className="unread-badge">{conv.unread_count}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Conditional rendering for mobile chat view */}
            {selectedConversation && ( /* Show messages-main if a conversation is selected */
                <div className="messages-main">
                    <div className="messages-header">
                        {isMobile && ( // Back button for mobile
                            <button
                                onClick={handleBackToConversations}
                                className="btn-back-to-conversations"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    fontSize: '1.5rem',
                                    marginRight: '1rem',
                                    padding: 0,
                                    cursor: 'pointer'
                                }}
                            >
                                ←
                            </button>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {/* Friend's avatar and username in header */}
                            {selectedFriend && (
                                <>
                                <img
                                    src={getAvatar(selectedFriend.friend_avatar, selectedFriend.friend_username)}
                                    alt={selectedFriend.friend_username}
                                    style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    marginRight: 8
                                    }}
                                    onError={e => (e.currentTarget.src = DEFAULT_AVATAR)}
                                />
                                <h2 style={{ margin: 0 }}>{selectedFriend.friend_username}</h2>
                                </>
                            )}
                        </div>
                        {socket && socket.connected && (
                            <span style={{ color: '#28a745', fontSize: '0.8rem' }}>● Live messaging</span>
                        )}
                    </div>

                    <div className="messages-list">
                        {messages.map((message, idx) => (
                            <div
                            key={message.id}
                            className={`message ${message.sender_id === user?.id ? 'sent' : 'received'}`}
                            style={{ position: 'relative', marginBottom: message.id === lastReadMessageId ? 32 : 8 }}
                            >
                            <div className="message-content">
                                {formatMessageContent(message)}
                                {message.text && (
                                <div style={{ marginTop: 4, fontSize: 14 }}>{message.text}</div>
                                )}
                            </div>
                            <div className="message-time">
                                {formatMessageTime(message.created_at)}
                            </div>
                            {/* Read receipt: show other user's profile pic under the last message sent by user and read by other user */}
                            {message.id === lastReadMessageId && otherUser && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                bottom: -26,
                                display: 'flex',
                                alignItems: 'center',
                                zIndex: 1
                            }}>
                                <img
                                src={getAvatar(otherUser.avatar_url, otherUser.username)}
                                alt={otherUser.username}
                                style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    border: '2px solid #fff',
                                    boxShadow: '0 0 2px rgba(0,0,0,0.2)',
                                    background: '#fafafa'
                                }}
                                title={`Read by ${otherUser.username}`}
                                onError={e => (e.currentTarget.src = DEFAULT_AVATAR)}
                                />
                            </div>
                            )}
                            </div>
                        ))}

                        {typingUsers.size > 0 && (
                            <div className="typing-indicator">
                            <div className="typing-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            <span className="typing-text">
                                {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                            </span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={sendMessage} className="message-input">
                        {selectedFile && (
                            <div className="file-preview">
                                {selectedFile.type.startsWith('image/') ? (
                                <img src={filePreviewUrl} alt="preview" />
                                ) : selectedFile.type.startsWith('video/') ? (
                                <video src={filePreviewUrl} controls />
                                ) : (
                                <span style={{ fontSize: 14 }}>{selectedFile.name}</span>
                                )}
                                <button type="button" onClick={() => { setSelectedFile(null); setFilePreviewUrl(''); }}>✖</button>
                            </div>
                        )}

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*,video/*,.gif,.pdf,.doc,.docx,.txt"
                            style={{ display: 'none' }}
                        />

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingFile}
                            className="file-upload-btn"
                        >
                            {uploadingFile ? '⏳' : '📎'}
                        </button>

                        <input
                            ref={messageInputRef}
                            type="text"
                            value={newMessage}
                            onChange={(e) => {
                            setNewMessage(e.target.value);
                            handleTyping();
                            }}
                            placeholder="Type a message..."
                            disabled={uploadingFile}
                            />
                        <button type="submit" disabled={uploadingFile}>
                            Send
                        </button>
                    </form>
                    {sendError && (
                    <div style={{ color: 'red', marginTop: 8, textAlign: 'center' }}>
                        {sendError}
                    </div>
                    )}
                </div>
            )}

            {/* This 'no-conversation' block is shown if no conversation is selected AND not on mobile */}
            {!selectedConversation && !isMobile && (
                <div className="no-conversation">
                    <div style={{ textAlign: 'center', marginTop: '40vh' }}>
                        <p>Select a conversation to start messaging</p>
                        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            Socket status: {socket && socket.connected ? '🟢 Connected' : '🔴 Disconnected'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Messages;