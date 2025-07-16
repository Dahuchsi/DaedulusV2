module.exports = {
    ALLDEBRID_API_KEY: process.env.ALLDEBRID_API_KEY,
    ALLDEBRID_API_URL: 'https://api.alldebrid.com/v4',
    
    DOWNLOAD_PATHS: {
        movie: process.env.MOVIES_PATH || 'L:\\\\PlexServ\\\\Movies',
        series: process.env.SERIES_PATH || 'L:\\\\PlexServ\\\\Series',
        music: process.env.MUSIC_PATH || 'L:\\\\PlexServ\\\\Music'
    },
    
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'Dahuchsi',
    
    PUBLIC_HOSTNAME: 'daedulus.dahuchsi.net',
    
    TORRENT_SEARCH: {
        // UPDATED: Using a public torrent API
        BASE_URL: 'https://torrents-api.ryanthompson.workers.dev/search',
        USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    }
};