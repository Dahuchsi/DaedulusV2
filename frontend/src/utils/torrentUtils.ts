// frontend/src/utils/torrentUtils.ts

export interface TorrentResult {
    name: string;
    size: string;
    seeders: number;
    leechers: number;
    link: string;
    provider: string;
    magnetLink?: string;
    // New metadata fields from backend
    season?: number | null;
    episode?: number | null;
    quality?: string;
    isCompleteSeason?: boolean;
    relevance?: number;
}

export interface EpisodeGroup {
    episode: number;
    torrents: TorrentResult[];
    selectedTorrent: TorrentResult | null;
}

export interface SeasonBundle {
    season: number;
    episodes: EpisodeGroup[]; // Sparse array or map, index = episode number
    completePacks: TorrentResult[]; // "Full Season" single torrents
}

export interface SearchResultGroup {
    movies: TorrentResult[];
    seasons: { [key: number]: SeasonBundle }; // Keyed by Season Number
    misc: TorrentResult[]; // Uncategorized
}

const QUALITY_RANKING = ['2160p', '1080p', '720p', '480p', 'Unknown'];

// Helper to compare qualities
export const compareQuality = (q1: string | undefined, q2: string | undefined) => {
    const idx1 = QUALITY_RANKING.indexOf(q1 || 'Unknown');
    const idx2 = QUALITY_RANKING.indexOf(q2 || 'Unknown');
    return idx1 - idx2; // Lower index = Better quality
};

// Main grouping function
export const organizeResults = (results: TorrentResult[]): SearchResultGroup => {
    const groups: SearchResultGroup = {
        movies: [],
        seasons: {},
        misc: []
    };

    results.forEach(result => {
        // 1. Check if it looks like a Movie (no season/episode info)
        // Note: Sometimes movies have "2023" which might be parsed as something else,
        // but our backend parser specifically looks for SxxExx or "Season X".
        // If no season info is found, treat as Movie/Misc.
        if (result.season === null || result.season === undefined) {
             // If it has no season info, we treat it as a movie or miscellaneous file.
             // We could further refine this by checking for "S01" etc again, but backend does that.
             groups.movies.push(result);
             return;
        }

        const seasonNum = result.season;

        // Initialize Season Bundle if not exists
        if (!groups.seasons[seasonNum]) {
            groups.seasons[seasonNum] = {
                season: seasonNum,
                episodes: [],
                completePacks: []
            };
        }

        const bundle = groups.seasons[seasonNum];

        // 2. Is it a Complete Season Pack?
        if (result.isCompleteSeason) {
            bundle.completePacks.push(result);
        } else if (result.episode !== null && result.episode !== undefined) {
            // 3. It's an Episode
            const epNum = result.episode;

            // Initialize Episode Group if not exists
            // We use the episode number as index, but it might be sparse (e.g. we have Ep 1 and Ep 5)
            // So we might want to store it in a way that allows sorting later.
            // For now, let's look it up.
            let epGroup = bundle.episodes.find(g => g.episode === epNum);
            if (!epGroup) {
                epGroup = {
                    episode: epNum,
                    torrents: [],
                    selectedTorrent: null
                };
                bundle.episodes.push(epGroup);
            }

            epGroup.torrents.push(result);
        } else {
             // Has season but no episode and not marked as complete pack?
             // Maybe a weird edge case, put in complete packs for now or misc.
             // If the backend marked it isCompleteSeason=false but no episode, it's ambiguous.
             // We'll treat it as a potential pack or misc.
             bundle.completePacks.push(result);
        }
    });

    // Post-processing: Sort and Select Defaults

    // Sort Movies/Misc by Seeders/Relevance
    groups.movies.sort((a, b) => (b.relevance || 0) - (a.relevance || 0) || b.seeders - a.seeders);

    // Process each Season
    Object.values(groups.seasons).forEach(season => {
        // Sort Complete Packs
        season.completePacks.sort((a, b) => b.seeders - a.seeders);

        // Sort Episodes by number
        season.episodes.sort((a, b) => a.episode - b.episode);

        // For each episode, sort torrents by Quality then Seeders, and pick default
        season.episodes.forEach(ep => {
            ep.torrents.sort((a, b) => {
                const qDiff = compareQuality(a.quality, b.quality);
                if (qDiff !== 0) return qDiff; // Better quality first
                return b.seeders - a.seeders; // Then seeders
            });

            // Default selection: Best Quality with at least some seeds?
            // Or just top of the list.
            if (ep.torrents.length > 0) {
                ep.selectedTorrent = ep.torrents[0];
            }
        });
    });

    return groups;
};
