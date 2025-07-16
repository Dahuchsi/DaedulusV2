import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Export the context so it can be imported
export const SocketContext = createContext<Socket | null>(null);

// Export the useSocket hook
export const useSocket = () => {
    const socket = useContext(SocketContext);
    // Return null instead of throwing error if not in provider
    return socket;
};

interface SocketProviderProps {
    children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const { user, token } = useAuth();

    useEffect(() => {
        if (user && token) {
            console.log('Attempting to connect socket...');
            try {
                const newSocket = io(process.env.REACT_APP_WS_URL || 'ws://localhost:3001', {
                    auth: { token },
                    transports: ['websocket'],
                    timeout: 10000,
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 5,
                });

                newSocket.on('connect', () => {
                    console.log('Socket connected successfully');
                    // Join user room
                    newSocket.emit('join:user', user.id);
                    
                    // Join admin room if admin
                    if (user.isAdmin) {
                        newSocket.emit('join:admin');
                    }
                });

                newSocket.on('connect_error', (error) => {
                    console.error('Socket connection error:', error);
                });

                newSocket.on('disconnect', (reason) => {
                    console.log('Socket disconnected:', reason);
                });

                newSocket.on('reconnect', (attemptNumber) => {
                    console.log('Socket reconnected after', attemptNumber, 'attempts');
                });

                setSocket(newSocket);

                return () => {
                    console.log('Cleaning up socket connection...');
                    newSocket.close();
                };
            } catch (error) {
                console.error('Failed to create socket connection:', error);
            }
        } else {
            // Clean up socket if user logs out
            if (socket) {
                console.log('User logged out, closing socket...');
                socket.close();
                setSocket(null);
            }
        }
    }, [user, token]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};