import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout: React.FC = () => {
    return (
        <div className="app-container">
            <Navbar />
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;