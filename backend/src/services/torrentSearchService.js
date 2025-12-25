const axios = require('axios');
const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
const { TORRENT_APIS, TORRENT_MIRRORS } = require('../config/constants');
const TorrentSearchApi = require('torrent-search-api');
const tmdbService = require('./tmdbService');
const tautulliService = require('./tautulliService');

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
// Yts usually works with custom function below, but we can enable it as backup
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

// ---------- Helper: Metadata Parser ----------
function parseMetadata(title) {
  const lowerTitle = title.toLowerCase();

  // 1. Extract Quality
  let quality = 'Unknown';
  if (lowerTitle.includes('2160p') || lowerTitle.includes('4k')) quality = '2160p';
  else if (lowerTitle.includes('1080p')) quality = '1080p';
  else if (lowerTitle.includes('720p')) quality = '720p';
  else if (lowerTitle.includes('480p')) quality = '480p';

  // 2. Extract Season & Episode
  let season = null;
  let episode = null;

  const sxE_Regex = /[Ss](\d{1,2})[Ee](\d{1,3})/i;
  const sxE_Match = title.match(sxE_Regex);

  if (sxE_Match) {
    season = parseInt(sxE_Match[1], 10);
    episode = parseInt(sxE_Match[2], 10);
  } else {
    // Try "Season X"
    const seasonRegex = /Season\s?(\d{1,2})/i;
    const seasonMatch = title.match(seasonRegex);
    if (seasonMatch) {
      season = parseInt(seasonMatch[1], 10);
    }
  }

  // 3. Detect "Complete Season"
  let isCompleteSeason = false;
  if (season !== null && episode === null) {
      isCompleteSeason = true;
  }
  if (lowerTitle.includes('complete') || lowerTitle.includes('pack') || lowerTitle.includes('season bundle')) {
    if (season !== null) isCompleteSeason = true;
  }
  if (episode !== null) {
    isCompleteSeason = false;
  }

  return { season, episode, quality, isCompleteSeason };
}

// ---------- YTS Direct Search ----------
async function searchYTS(query) {
    // Try primary then mirrors
    const mirrors = [TORRENT_APIS.YTS_URL, ...(TORRENT_APIS.YTS_MIRRORS || [])];

    for (const mirror of mirrors) {
        try {
            const rsp = await axios.get(
              `${mirror}?query_term=${encodeURIComponent(query)}&sort_by=peers`,
              { timeout: 5000 }
            );
            const movies = rsp.data?.data?.movies || [];
            if (movies.length > 0) {
                 return movies.flatMap(movie =>
                  movie.torrents.map(t => ({
                    name: `${movie.title_long} [${t.quality}] [YTS]`,
                    size: t.size,
                    seeders: t.seeds || 0,
                    leechers: t.peers || 0,
                    link: movie.url,
                    provider: 'YTS',
                    magnetLink: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(movie.title_long)}`
                  }))
                );
            }
        } catch (err) {
            console.warn(`YTS mirror failed (${mirror}):`, err.message);
        }
    }
    return [];
}

// ---------- Resilient EZTV Search ----------
async function searchEZTV(query) {
  try {
    const rsp = await axios.get(
      `${TORRENT_APIS.EZTV_URL}?limit=100&keyword=${encodeURIComponent(query)}`,
      { timeout: 5000 }
    );
    const torrents = rsp.data?.torrents || [];
    if (torrents.length > 0) {
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

  try {
    // Fallback to library
    const torrents = await TorrentSearchApi.search(['Eztv'], query, 'All', 50);
     if (torrents.length > 0) {
        return torrents.map(t => ({
            name: t.title,
            size: t.size,
            seeders: t.seeds || 0,
            leechers: t.peers || 0,
            link: t.desc,
            provider: 'EZTV',
            magnetLink: t.magnet || ''
        }));
    }
  } catch (err) {
    console.warn(`⚠️ EZTV library search failed: ${err.message}`);
  }
  return [];
}


// ---------- PirateBay Direct Scraper ----------
async function searchPirateBay(query) {
  for (let i = 0; i < TORRENT_MIRRORS['ThePirateBay'].length; i++) {
    const baseUrl = TORRENT_MIRRORS['ThePirateBay'][i];
    try {
      const url = `${baseUrl}/search/${encodeURIComponent(query)}/1/99/0`;
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
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
        return torrents;
      }
    } catch (err) {
      console.warn(`❌ PirateBay mirror failed: ${baseUrl} (${err.message})`);
    }
  }
  return [];
}

// ---------- Torrent-Search-API Search ----------
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

    const tmdbPromise = tmdbService.classifyQuery(query);
    const libraryPromise = tautulliService.searchLibrary(query);

    // --- TORRENT SEARCH ---
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
      searchPromises.push(searchEZTV(q));
      searchPromises.push(searchLibrary(q));
      searchPromises.push(searchPirateBay(q));
    }

    const [tmdbResult, libraryItems, ...searchResults] = await Promise.all([
        tmdbPromise,
        libraryPromise,
        ...searchPromises
    ]);

    const allTorrents = searchResults.flat();

    // --- SCORING & PARSING ---
    const searchWords = query.toLowerCase().split(' ').filter(word => word);
    const preciseQuery = searchWords.filter(word => !BONUS_WORDS.has(word)).join('');
    const coreKeywords = searchWords.filter(word => !BONUS_WORDS.has(word) && !['a', 'an', 'the'].includes(word));

    const userWantsFullSeason = query.toLowerCase().includes('full') || query.toLowerCase().includes('complete');

    // TMDB Info
    const { isMovie, isSeries, topResult } = tmdbResult;

    const processedTorrents = allTorrents
      .map(torrent => {
        // 1. Parse Metadata
        const metadata = parseMetadata(torrent.name);

        // 2. Basic Relevance Check
        const spacelessTitle = torrent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isMatch = coreKeywords.every(word => spacelessTitle.includes(word));

        if (!isMatch) {
          return null;
        }

        // 3. Score Calculation
        let relevance = 0;

        // Word match score
        for (const word of searchWords) {
          if (spacelessTitle.includes(word)) {
            relevance++;
          }
        }
        if (spacelessTitle.includes(preciseQuery)) {
          relevance += 10;
        }

        // Boost for Complete Season if it looks like a series
        if (metadata.isCompleteSeason) {
            relevance += 20;
            if (userWantsFullSeason) relevance += 50;
            if (isSeries) relevance += 30; // Boost seasons if TMDB confirms it *can* be a show
        }

        // --- NEW LOGIC FOR HYBRID RESULTS ---
        // If it's a Movie search AND Series search (ambiguous), we don't penalize.
        // We just boost what we are sure about.

        // Boost Movies if matches TMDB Movie result year?
        if (isMovie && metadata.season === null) {
            // It's likely a movie result
            relevance += 10;
        }

        // Boost High Quality
        if (metadata.quality === '2160p') relevance += 5;
        if (metadata.quality === '1080p') relevance += 3;

        // Check Library Status
        let libraryStatus = null;

        if (libraryItems.length > 0) {
            const libMatch = libraryItems.find(item => {
                return item.title.toLowerCase().includes(preciseQuery) || preciseQuery.includes(item.title.toLowerCase());
            });

            if (libMatch) {
                 if (metadata.season === null && libMatch.media_type === 'movie') {
                     libraryStatus = {
                         exists: true,
                         details: libMatch
                     };
                 }
                 else if (metadata.season !== null && (libMatch.media_type === 'show' || libMatch.media_type === 'episode')) {
                     libraryStatus = {
                         exists: true,
                         details: libMatch,
                         isSeriesMatch: true
                     };
                 }
            }
        }

        return {
            ...torrent,
            relevance,
            ...metadata,
            libraryStatus
        };
      })
      .filter(Boolean);

    // Sort
    const filteredAndSorted = processedTorrents.sort((a, b) => {
      if (Math.abs(a.relevance - b.relevance) > 10) {
           return b.relevance - a.relevance;
      }
      return b.seeders - a.seeders;
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

    // Attach Top-Level Metadata
    if (topResult && unique.length > 0) {
        unique.forEach(t => t.tmdb = topResult);
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
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
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