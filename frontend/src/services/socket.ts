import { Socket } from 'socket.io-client';

export interface DownloadProgress {
    downloadId: string;
    progress: number;
    speed: number;
}

export interface NewMessage {
    id: string;
    sender_id: string;
    recipient_id: string;
    content: string;
    created_at: string;
    sender: {
        username: string;
        avatar_url?: string;
    };
}

// Added onMessageRead to callbacks for read receipt support
export const setupSocketListeners = (socket: Socket | null, callbacks: {
    onDownloadProgress?: (data: DownloadProgress) => void;
    onDownloadComplete?: (data: { downloadId: string; name: string }) => void;
    onNewMessage?: (message: NewMessage) => void;
    onBroadcastMessage?: (data: { from: string; content: string }) => void;
    onNewRequest?: (data: { id: string; username: string; search_query: string }) => void;
    onMessageRead?: (data: { messageId: string; readerId: string }) => void; // <-- Added
}): (() => void) | null => {
    if (!socket || !socket.connected) {
        console.log('Socket not available or not connected, skipping listener setup');
        return null;
    }

    console.log('Setting up socket listeners...');

    if (callbacks.onDownloadProgress) {
        socket.on('download:progress', callbacks.onDownloadProgress);
    }
    if (callbacks.onDownloadComplete) {
        socket.on('download:complete', callbacks.onDownloadComplete);
    }
    if (callbacks.onNewMessage) {
        socket.on('message:new', callbacks.onNewMessage);
    }
    if (callbacks.onBroadcastMessage) {
        socket.on('broadcast:message', callbacks.onBroadcastMessage);
    }
    if (callbacks.onNewRequest) {
        socket.on('request:new', callbacks.onNewRequest);
    }
    if (callbacks.onMessageRead) {
        socket.on('message:read', callbacks.onMessageRead); // <-- Added
    }

    // Return cleanup function
    return () => {
        console.log('Cleaning up socket listeners...');
        if (socket) {
            if (callbacks.onDownloadProgress) {
                socket.off('download:progress', callbacks.onDownloadProgress);
            }
            if (callbacks.onDownloadComplete) {
                socket.off('download:complete', callbacks.onDownloadComplete);
            }
            if (callbacks.onNewMessage) {
                socket.off('message:new', callbacks.onNewMessage);
            }
            if (callbacks.onBroadcastMessage) {
                socket.off('broadcast:message', callbacks.onBroadcastMessage);
            }
            if (callbacks.onNewRequest) {
                socket.off('request:new', callbacks.onNewRequest);
            }
            if (callbacks.onMessageRead) {
                socket.off('message:read', callbacks.onMessageRead); // <-- Added
            }
        }
    };
};

// Additional helper functions for type-safe socket operations
export const safeSocketEmit = (socket: Socket | null, event: string, ...data: any[]): boolean => {
    if (socket && socket.connected) {
        socket.emit(event, ...data);
        return true;
    }
    console.log(`Cannot emit ${event}: socket not connected`);
    return false;
};

export const isSocketConnected = (socket: Socket | null): boolean => {
    return socket !== null && socket.connected;
};