const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.errors
        });
    }
    
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
            error: 'Duplicate entry',
            field: err.errors[0].path
        });
    }
    
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token'
        });
    }
    
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
};

module.exports = errorHandler;