import React, { createContext, useState, useContext, ReactNode } from 'react';
import { TorrentResult } from '../utils/torrentUtils';

interface SearchContextType {
    query: string;
    setQuery: (query: string) => void;
    results: TorrentResult[];
    setResults: (results: TorrentResult[]) => void;
    searched: boolean;
    setSearched: (searched: boolean) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearch = () => {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error('useSearch must be used within a SearchProvider');
    }
    return context;
};

interface SearchProviderProps {
    children: ReactNode;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TorrentResult[]>([]);
    const [searched, setSearched] = useState(false);

    return (
        <SearchContext.Provider value={{ query, setQuery, results, setResults, searched, setSearched }}>
            {children}
        </SearchContext.Provider>
    );
};
