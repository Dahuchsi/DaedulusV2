import { organizeResults, TorrentResult } from './torrentUtils';

describe('organizeResults', () => {
    it('should group episodes into season bundles', () => {
        const results: TorrentResult[] = [
            { name: 'Breaking Bad S01E01 1080p', size: '1GB', seeders: 10, leechers: 1, link: 'l1', provider: 'P', season: 1, episode: 1, quality: '1080p', isCompleteSeason: false },
            { name: 'Breaking Bad S01E02 720p', size: '1GB', seeders: 5, leechers: 1, link: 'l2', provider: 'P', season: 1, episode: 2, quality: '720p', isCompleteSeason: false },
            { name: 'Breaking Bad S01E01 720p', size: '1GB', seeders: 20, leechers: 1, link: 'l3', provider: 'P', season: 1, episode: 1, quality: '720p', isCompleteSeason: false },
        ];

        const grouped = organizeResults(results);

        expect(grouped.seasons[1]).toBeDefined();
        expect(grouped.seasons[1].episodes.length).toBe(2);

        // Check Episode 1 group
        const ep1 = grouped.seasons[1].episodes.find(e => e.episode === 1);
        expect(ep1).toBeDefined();
        expect(ep1?.torrents.length).toBe(2);

        // Check selection logic: 1080p (seeders 10) vs 720p (seeders 20)
        // Our logic prefers Quality first. So 1080p should be selected.
        expect(ep1?.selectedTorrent?.quality).toBe('1080p');
    });

    it('should separate complete season packs', () => {
        const results: TorrentResult[] = [
            { name: 'Breaking Bad Season 1 Complete', size: '10GB', seeders: 100, leechers: 10, link: 'l1', provider: 'P', season: 1, episode: null, quality: '1080p', isCompleteSeason: true },
            { name: 'Breaking Bad S01E01', size: '1GB', seeders: 10, leechers: 1, link: 'l2', provider: 'P', season: 1, episode: 1, quality: '1080p', isCompleteSeason: false },
        ];

        const grouped = organizeResults(results);

        expect(grouped.seasons[1].completePacks.length).toBe(1);
        expect(grouped.seasons[1].completePacks[0].name).toContain('Complete');
        expect(grouped.seasons[1].episodes.length).toBe(1);
    });

    it('should categorize movies separately', () => {
        const results: TorrentResult[] = [
            { name: 'Breaking Bad Movie', size: '2GB', seeders: 50, leechers: 5, link: 'l1', provider: 'P', season: null, episode: null, quality: '1080p', isCompleteSeason: false },
        ];

        const grouped = organizeResults(results);

        expect(grouped.movies.length).toBe(1);
        expect(Object.keys(grouped.seasons).length).toBe(0);
    });
});
