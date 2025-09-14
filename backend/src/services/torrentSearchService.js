const axios = require('axios');
const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio'); // 👈 make sure to install (npm install cheerio)
const { TORRENT_APIS, TORRENT_MIRRORS } = require('../config/constants');
const TorrentSearchApi = require('torrent-search-api');

// ---------- 1337x Mirror Config ----------
if (TORRENT_MIRRORS['1337x']?.length) {
  TorrentSearchApi.overrideConfig('1337x', {
    baseUrl: TORRENT_MIRRORS['1337x'][0],
    searchUrl: '/search/{query}/{page}/'
  });
}

// Enable Providers for library-based search
TorrentSearchApi.enableProvider('1337x');
TorrentSearchApi.enableProvider('Torrentz2');
TorrentSearchApi.enableProvider('Yts');
TorrentSearchApi.enableProvider('Eztv');

// ---------- YTS Direct Search ----------
async function searchYTS(query) {
  try {
    const rsp = await axios.get(
      `${TORRENT_APIS.YTS_URL}?query_term=${encodeURIComponent(query)}&sort_by=peers`
    );
    const movies = rsp.data?.data?.movies || [];
    return movies.flatMap(movie =>
      movie.torrents.map(t => ({
        name: `${movie.title_long} [${t.quality}] [YTS]`,
        size: t.size,
        seeders: t.seeds || 0,
        leechers: t.peers || 0,
        link: movie.url,
        provider: 'YTS',
        magnetLink: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(
          movie.title_long
        )}`
      }))
    );
  } catch (err) {
    console.error('YTS search failed:', err.message);
    return [];
  }
}

// ---------- EZTV Direct Search ----------
async function searchEZTV(query) {
  try {
    const rsp = await axios.get(
      `${TORRENT_APIS.EZTV_URL}?limit=100&keyword=${encodeURIComponent(query)}`
    );
    const torrents = rsp.data?.torrents || [];
    return torrents.map(t => ({
      name: t.title,
      size: (t.size_bytes / (1024 * 1024)).toFixed(2) + ' MB',
      seeders: t.seeds || 0,
      leechers: t.peers || 0,
      link: `https://eztv.re/ep/${t.id}/`,
      provider: 'EZTV',
      magnetLink: t.magnet_url
    }));
  } catch (err) {
    console.error('EZTV search failed:', err.message);
    return [];
  }
}

// ---------- PirateBay Direct Scraper ----------
async function searchPirateBay(query) {
  for (let i = 0; i < TORRENT_MIRRORS['ThePirateBay'].length; i++) {
    const baseUrl = TORRENT_MIRRORS['ThePirateBay'][i];
    try {
      const url = `${baseUrl}/search/${encodeURIComponent(query)}/1/99/0`;
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(data);

      const torrents = [];
      $('table#searchResult tr').each((_, row) => {
        const title = $(row).find('.detName a').text().trim();
        if (!title) return;

        const link = baseUrl + $(row).find('.detName a').attr('href');
        const magnet = $(row).find('a[href^="magnet:?"]').attr('href') || '';
        const desc = $(row).find('.detDesc').text();
        const sizeMatch = desc.match(/Size (.*?),/);
        const size = sizeMatch ? sizeMatch[1] : 'Unknown';
        const seeders = parseInt($(row).find('td').eq(2).text()) || 0;
        const leechers = parseInt($(row).find('td').eq(3).text()) || 0;

        torrents.push({
          name: title,
          size,
          seeders,
          leechers,
          link,
          provider: 'ThePirateBay',
          magnetLink: magnet
        });
      });

      if (torrents.length > 0) {
        console.log(`✅ PirateBay results from: ${baseUrl}`);
        return torrents;
      } else {
        console.warn(`⚠️ No results from ${baseUrl}, trying next mirror...`);
      }
    } catch (err) {
      console.warn(`❌ PirateBay mirror failed: ${baseUrl} (${err.message})`);
    }
  }
  return [];
}

// ---------- Torrent-Search-API Search (1337x, Torrentz2 etc.) ----------
async function searchLibrary(query) {
  try {
    const torrents = await TorrentSearchApi.search(query, 'All', 50);
    return torrents.map(t => ({
      name: t.title,
      size: t.size,
      seeders: t.seeds || 0,
      leechers: t.peers || 0,
      link: t.desc,
      provider: t.provider,
      magnetLink: t.magnet || ''
    }));
  } catch (err) {
    console.error('Library search failed:', err.message);
    return [];
  }
}

// ---------- Service ----------
class TorrentSearchService {
  async search(query) {
    if (!query) return [];

    const results = await Promise.allSettled([
      searchYTS(query),
      searchEZTV(query),
      searchLibrary(query),
      searchPirateBay(query) // 👈 NOW DIRECTLY SCRAPED
    ]);

    const all = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .flatMap(r => r.value);

    all.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));

    // Deduplicate
    const seen = new Set();
    const unique = [];
    for (const tor of all) {
      const key = tor.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(tor);
      }
    }

    console.log(
      'Results by provider:',
      unique.reduce((acc, t) => {
        acc[t.provider] = (acc[t.provider] || 0) + 1;
        return acc;
      }, {})
    );

    return unique;
  }

  async getMagnet(torrent) {
    if (torrent.magnetLink && torrent.magnetLink.length > 0) {
      return torrent.magnetLink;
    }
    try {
      console.log(`Scraping magnet for "${torrent.name}" from ${torrent.provider}`);
      const magnet = await TorrentSearchApi.getMagnet(torrent);
      if (magnet) return magnet;

      // --- 1337x Magnet Fallback ---
      if (torrent.link && torrent.provider === '1337x') {
        try {
          const page = await cloudscraper.get(torrent.link, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const match = page.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+/);
          if (match) return match[0];
        } catch (err) {
          const page = await axios.get(torrent.link);
          const match = page.data.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+/);
          if (match) return match[0];
        }
      }

      // --- PirateBay Magnet Fallback ---
      if (torrent.link && torrent.provider === 'ThePirateBay') {
        try {
          const page = await axios.get(torrent.link, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const match = page.data.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+/);
          if (match) return match[0];
        } catch (err) {
          console.warn(`Failed to scrape TPB magnet: ${err.message}`);
        }
      }

      return '';
    } catch (err) {
      console.error(`Magnet scrape failed: ${err.message}`);
      return '';
    }
  }
}

module.exports = new TorrentSearchService();