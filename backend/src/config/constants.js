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

  TORRENT_APIS: {
    // YTS Mirrors (Updated)
    YTS_URL: 'https://yts.mx/api/v2/list_movies.json', // Primary
    YTS_MIRRORS: [
        'https://yts.mx/api/v2/list_movies.json',
        'https://yts.rs/api/v2/list_movies.json',
        'https://yts.do/api/v2/list_movies.json',
        'https://yts.lt/api/v2/list_movies.json'
    ],
    EZTV_URL: 'https://eztv.re/api/get-torrents'
  },

  TORRENT_MIRRORS: {
    '1337x': [
      'https://1337x.to',
      'https://www.1377x.to',
      'https://x1337x.st',
      'https://x1337x.se',
      'https://1337x.so',
      'https://1337x.st',
      'https://1337x.is',
      'https://1337x.xyz'
    ],
    'ThePirateBay': [
      'https://tpb.party',
      'https://thepiratebay.party',
      'https://piratebay.party',
      'https://thepiratebay7.com',
      'https://thepiratebay0.org',
      'https://thepiratebay10.xyz',
      'https://piratebay.live',
      'https://thehiddenbay.com'
    ]
  },

  // TMDB
  TMDB_API_KEY: process.env.TMDB_API_KEY || '1ca3efda731f9b20af5f948ace2f7a3d',
  TMDB_READ_TOKEN: process.env.TMDB_READ_ACCESS_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxY2EzZWZkYTczMWY5YjIwYWY1Zjk0OGFjZTJmN2EzZCIsIm5iZiI6MTc2NDM4MDg4NC40MTYsInN1YiI6IjY5MmE1MGQ0YjlmZWJhODEzMGI4ZWU1NyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.nQJmm2PBun5VTqYX6ZeTmqocVVxo8QDjzw5yG573yi0',

  // Watchmode
  WATCHMODE_API_KEY: process.env.WATCHMODE_API_KEY || 'Y0la7T1tEfP3WI3KfriACU0TPnjaydMqxRzeZF0Y',

  // Tautulli
  TAUTULLI_URL: process.env.TAUTULLI_URL || 'http://localhost:8181',
  TAUTULLI_API_KEY: process.env.TAUTULLI_API_KEY || 'e7d2abed8354471b91878d8bfb5e2f0c'
};
