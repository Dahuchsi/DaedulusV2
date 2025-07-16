import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import Downloads from './pages/Downloads';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

function App() {
    return (
        <Routes>
            {/* Public routes that do not have the main layout */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Redirect root path to the dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Protected routes that use the main app layout */}
            <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/downloads" element={<Downloads />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/profile" element={<Profile />} />
                </Route>
            </Route>

            {/* Protected admin routes */}
            <Route element={<ProtectedRoute adminOnly={true} />}>
                <Route element={<Layout />}>
                    <Route path="/admin" element={<Admin />} />
                </Route>
            </Route>
        </Routes>
    );
}

export default App;