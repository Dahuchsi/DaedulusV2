const adminMiddleware = (req, res, next) => {
    // Check if user exists and is authenticated
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user is admin - handle both property name formats
    const isAdmin = req.user.isAdmin || req.user.is_admin;
    if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    // User is admin, proceed to next middleware/route
    next();
};

module.exports = adminMiddleware;