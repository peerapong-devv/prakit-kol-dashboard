import { useState, useEffect } from 'react';
import axios from 'axios';
import KolCard from '../components/KolCard';
import StatsCard from '../components/StatsCard';
import SearchBar from '../components/SearchBar';

interface KOL {
  id: number;
  name: string;
  category: string;
  avatarUrl: string;
  platforms: Platform[];
}

interface Platform {
  id: number;
  platformType: string;
  username: string;
  metrics: Metric[];
}

interface Metric {
  followers: number;
  engagementRate: number;
}

interface Stats {
  totalKols: number;
  totalPlatforms: number;
  recentScrapes: number;
}

export default function Home() {
  const [kols, setKols] = useState<KOL[]>([]);
  const [stats, setStats] = useState<Stats>({ totalKols: 0, totalPlatforms: 0, recentScrapes: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');

  useEffect(() => {
    fetchKols();
    fetchStats();
  }, [searchTerm, selectedPlatform]);

  const fetchKols = async () => {
    try {
      const response = await axios.get('/api/kols', {
        params: {
          search: searchTerm,
          platform: selectedPlatform,
          limit: 12,
        },
      });
      setKols(response.data.data);
    } catch (error) {
      console.error('Error fetching KOLs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">KOL Directory</h1>
            <nav className="flex space-x-6">
              <a href="/" className="text-gray-700 hover:text-primary-600">Dashboard</a>
              <a href="/admin" className="text-gray-700 hover:text-primary-600">Admin</a>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard title="Total KOLs" value={stats.totalKols} icon="users" />
          <StatsCard title="Total Platforms" value={stats.totalPlatforms} icon="globe" />
          <StatsCard title="Recent Scrapes (24h)" value={stats.recentScrapes} icon="refresh" />
        </div>

        {/* Search and Filter */}
        <div className="mb-8">
          <SearchBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedPlatform={selectedPlatform}
            setSelectedPlatform={setSelectedPlatform}
          />
        </div>

        {/* KOLs Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kols.map((kol) => (
              <KolCard key={kol.id} kol={kol} />
            ))}
          </div>
        )}

        {kols.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No KOLs found. Try adjusting your search criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
}