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
    YTS_URL: 'https://yts.mx/api/v2/list_movies.json',
    EZTV_URL: 'https://eztv.re/api/get-torrents'
  },

  TORRENT_MIRRORS: {
    '1337x': [
      'https://www.1377x.to',
      'https://x1337x.st',
      'https://x1337x.se'
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
  }
};