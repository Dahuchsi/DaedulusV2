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
  // Common patterns: S01E01, 1x01, Season 1 Episode 1
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

  // 3. Detect "Complete Season" or "Season Pack"
  // If it has a season but no specific episode (or explicitly says "Complete"), it's likely a pack.
  // HOWEVER, some single episodes might just say "S01" if poorly named, but usually "S01E01".
  // Strong indicators: "Complete", "Season Pack", "S01 " (without E), "Season 1 " (without Episode)
  let isCompleteSeason = false;
  if (season !== null && episode === null) {
      isCompleteSeason = true;
  }
  // Explicit overrides
  if (lowerTitle.includes('complete') || lowerTitle.includes('pack') || lowerTitle.includes('season bundle')) {
    if (season !== null) isCompleteSeason = true;
  }

  // If it matches S01E01, it is definitely NOT a complete season (unless it's a multi-episode file, but usually handled as episode)
  if (episode !== null) {
    isCompleteSeason = false;
  }

  return { season, episode, quality, isCompleteSeason };
}

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

// ---------- Resilient EZTV Search ----------
async function searchEZTV(query) {
  try {
    const rsp = await axios.get(
      `${TORRENT_APIS.EZTV_URL}?limit=100&keyword=${encodeURIComponent(query)}`
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

    // --- SEARCH LOGIC ---
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

    const results = await Promise.allSettled(searchPromises);

    const all = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .flatMap(r => r.value);

    // --- SCORING & PARSING ---
    const searchWords = query.toLowerCase().split(' ').filter(word => word);
    const preciseQuery = searchWords.filter(word => !BONUS_WORDS.has(word)).join('');
    const coreKeywords = searchWords.filter(word => !BONUS_WORDS.has(word) && !['a', 'an', 'the'].includes(word));

    // Check if user specifically requested "Full" or "Complete"
    const userWantsFullSeason = query.toLowerCase().includes('full') || query.toLowerCase().includes('complete');

    const processedTorrents = all
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
            relevance += 20; // Big boost for seasons
            if (userWantsFullSeason) {
                relevance += 50; // Massive boost if explicitly requested
            }
        }

        // Boost for High Quality
        if (metadata.quality === '2160p') relevance += 5;
        if (metadata.quality === '1080p') relevance += 3;

        return {
            ...torrent,
            relevance,
            ...metadata // attach season, episode, quality, isCompleteSeason
        };
      })
      .filter(Boolean);

    // Sort:
    // 1. If looking for movie/general, seeders might be king.
    // 2. If series, we want bundles top.
    const filteredAndSorted = processedTorrents.sort((a, b) => {
      // Prioritize explicit "Complete Season" if detected and score is high
      if (Math.abs(a.relevance - b.relevance) > 10) {
           return b.relevance - a.relevance;
      }

      // Otherwise fallback to seeders
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