import axios from 'axios';

export const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api'
});

// Add response interceptor for error handling
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);