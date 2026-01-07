import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import LibraryStatusBadge from '../components/search/LibraryStatusBadge';

interface Service {
    id: string;
    name: string;
    color: string;
    textColor: string;
}

interface TrendingItem {
    id: number;
    title: string;
    media_type: 'movie' | 'tv';
    poster_url?: string;
    backdrop_url?: string;
    release_date?: string;
    overview?: string;
    libraryStatus?: any;
    popularity: number;
    vote_average: number;
}

const Trending: React.FC = () => {
    const [services, setServices] = useState<Service[]>([]);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [content, setContent] = useState<TrendingItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState<Set<number>>(new Set());

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const res = await api.get('/trending/services');
                setServices(res.data);
            } catch (err) {
                console.error('Failed to fetch services', err);
            }
        };
        fetchServices();
    }, []);

    const handleServiceClick = async (service: Service) => {
        setSelectedService(service);
        setLoading(true);
        setContent([]);
        try {
            const res = await api.get(`/trending/${service.id}`);
            setContent(res.data);
        } catch (err) {
            console.error('Failed to fetch content', err);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setSelectedService(null);
        setContent([]);
    };

    const handleDownload = async (item: TrendingItem) => {
        // eslint-disable-next-line no-restricted-globals
        if (!window.confirm(`Auto-download "${item.title}"?`)) return;

        setDownloading(prev => new Set(prev).add(item.id));
        try {
            await api.post('/downloads/auto', {
                title: item.title,
                year: item.release_date ? item.release_date.substring(0, 4) : undefined,
                media_type: item.media_type
            });
            alert(`Queued download for: ${item.title}`);
        } catch (err: any) {
            alert(`Failed to queue: ${err.response?.data?.error || err.message}`);
        } finally {
            setDownloading(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };

    // --- SERVICE GRID VIEW ---
    if (!selectedService) {
        return (
            <div className="trending-page main-content" style={{ padding: '2rem' }}>
                <h1 style={{ marginBottom: '2rem', textAlign: 'center' }}>What's on?</h1>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '2rem'
                }}>
                    {services.map(service => (
                        <div
                            key={service.id}
                            onClick={() => handleServiceClick(service)}
                            style={{
                                backgroundColor: service.color,
                                color: service.textColor,
                                borderRadius: '12px',
                                height: '100px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '1.2rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                transition: 'transform 0.2s',
                                textAlign: 'center',
                                padding: '1rem'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            {service.name}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // --- SERVICE DETAIL VIEW ---
    return (
        <div className="trending-detail" style={{
            minHeight: '100vh',
            backgroundColor: selectedService.color,
            color: selectedService.textColor,
            padding: '2rem',
            // Simple overlay pattern or gradient for aesthetic
            backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8))'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                <button
                    onClick={handleBack}
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        color: 'inherit',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginRight: '1rem',
                        fontWeight: 'bold'
                    }}
                >
                    ← Back
                </button>
                <h1 style={{ margin: 0 }}>Trending on {selectedService.name}</h1>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', fontSize: '1.5rem', marginTop: '4rem' }}>Loading trending content...</div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '2rem'
                }}>
                    {content.map(item => (
                        <div key={item.id} style={{
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ position: 'relative', paddingTop: '150%' }}>
                                {item.poster_url ? (
                                    <img
                                        src={item.poster_url}
                                        alt={item.title}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#333' }}>No Image</div>
                                )}

                                {item.libraryStatus?.exists && (
                                    <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                        <LibraryStatusBadge status={item.libraryStatus} />
                                    </div>
                                )}
                            </div>

                            <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#fff' }}>{item.title}</h3>
                                <div style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '0.5rem' }}>
                                    {item.release_date?.substring(0, 4)} • {item.media_type === 'tv' ? 'Series' : 'Movie'}
                                </div>
                                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#ccc' }}>⭐ {item.vote_average.toFixed(1)}</span>
                                    <button
                                        onClick={() => handleDownload(item)}
                                        disabled={downloading.has(item.id)}
                                        style={{
                                            backgroundColor: downloading.has(item.id) ? '#666' : '#fff',
                                            color: '#000',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '32px',
                                            height: '32px',
                                            cursor: downloading.has(item.id) ? 'default' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold'
                                        }}
                                        title="Download"
                                    >
                                        {downloading.has(item.id) ? '...' : '⬇'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Trending;
