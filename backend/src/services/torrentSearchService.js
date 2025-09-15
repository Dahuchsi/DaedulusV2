const axios = require('axios');
const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
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
// NOTE: We no longer enable 'Eztv' here because we have a dedicated, resilient function for it.
TorrentSearchApi.enableProvider('1337x');
TorrentSearchApi.enableProvider('Torrentz2');
TorrentSearchApi.enableProvider('Yts');

// A list of common "bonus" words that are not part of the core title
const BONUS_WORDS = new Set([
  'hd', 'sd', '4k', '8k', 'uhd', 'fhd',
  '1080p', '720p', '480p', '2120p',
  'bluray', 'blu-ray', 'dvd', 'dvdrip', 'webrip', 'web-dl', 'hdrip',
  'x264', 'h264', 'x265', 'h265', 'hevc',
  'ac3', 'dts', 'dts-hd', 'truehd',
  '5.1', '7.1',
  'remux', 'repack', 'proper', 'internal'
]);

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

// ---------- Resilient EZTV Search (NEW AND IMPROVED) ----------
async function searchEZTV(query) {
  // Method 1: Try the original direct API call first.
  try {
    const rsp = await axios.get(
      `${TORRENT_APIS.EZTV_URL}?limit=100&keyword=${encodeURIComponent(query)}`
    );
    const torrents = rsp.data?.torrents || [];
    if (torrents.length > 0) {
      console.log(`✅ EZTV results from direct API call.`);
      return torrents.map(t => ({
        name: t.title,
        size: (t.size_bytes / (1024 * 1024)).toFixed(2) + ' MB',
        seeders: t.seeds || 0,
        leechers: t.peers || 0,
        link: `https://eztv.re/ep/${t.id}/`,
        provider: 'EZTV',
        magnetLink: t.magnet_url
      }));
    }
  } catch (err) {
    console.warn(`⚠️ EZTV direct API call failed: ${err.message}`);
  }

  // Method 2: Fallback to the torrent-search-api library if the first method fails.
  try {
    const torrents = await TorrentSearchApi.search(['Eztv'], query, 'All', 50);
     if (torrents.length > 0) {
        console.log(`✅ EZTV results from torrent-search-api library.`);
        return torrents.map(t => ({
            name: t.title,
            size: t.size,
            seeders: t.seeds || 0,
            leechers: t.peers || 0,
            link: t.desc,
            provider: 'EZTV', // Ensure provider is set correctly
            magnetLink: t.magnet || ''
        }));
    }
  } catch (err) {
    console.warn(`⚠️ EZTV library search failed: ${err.message}`);
  }
  
  console.error('❌ All EZTV search methods failed for query:', query);
  return [];
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

    // --- NEW MULTI-SEARCH LOGIC ---
    const queriesToRun = new Set();
    const trimmedQuery = query.trim();
    queriesToRun.add(trimmedQuery);

    const spacelessQuery = trimmedQuery.replace(/\s+/g, '');
    if (spacelessQuery && spacelessQuery !== trimmedQuery) {
      queriesToRun.add(spacelessQuery);
    }

    const searchPromises = [];
    for (const q of queriesToRun) {
      searchPromises.push(searchYTS(q));
      searchPromises.push(searchEZTV(q)); // Using our new resilient function
      searchPromises.push(searchLibrary(q));
      searchPromises.push(searchPirateBay(q));
    }

    const results = await Promise.allSettled(searchPromises);

    const all = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .flatMap(r => r.value);
    // --- END OF NEW LOGIC ---


    // --- DEFINITIVE SOLUTION WITH ADVANCED RELEVANCE SCORING ---
    const searchWords = query.toLowerCase().split(' ').filter(word => word);
    const preciseQuery = searchWords.filter(word => !BONUS_WORDS.has(word)).join('');
    const coreKeywords = searchWords.filter(word => !BONUS_WORDS.has(word) && !['a', 'an', 'the'].includes(word));

    const processedTorrents = all
      .map(torrent => {
        const spacelessTitle = torrent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isMatch = coreKeywords.every(word => spacelessTitle.includes(word));

        if (!isMatch) {
          return null;
        }

        let relevance = 0;
        for (const word of searchWords) {
          if (spacelessTitle.includes(word)) {
            relevance++;
          }
        }
        if (spacelessTitle.includes(preciseQuery)) {
          relevance += 10;
        }

        return { ...torrent, relevance };
      })
      .filter(Boolean);

    const filteredAndSorted = processedTorrents.sort((a, b) => {
      if (b.seeders !== a.seeders) {
        return b.seeders - a.seeders;
      }
      return b.relevance - a.relevance;
    });


    const seen = new Set();
    const unique = [];
    for (const tor of filteredAndSorted) {
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