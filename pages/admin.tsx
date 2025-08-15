import { useState, useEffect } from 'react';
import axios from 'axios';

interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

interface SystemStats {
  totalKols: number;
  totalPlatforms: number;
  totalMetrics: number;
  recentScrapes: number;
  failedScrapes: number;
  queue: QueueStatus;
}

export default function Admin() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    try {
      setMessage('Processing...');
      const response = await axios.post(`/api/admin/${action}`);
      setMessage(response.data.message || 'Action completed');
      fetchStats();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Action failed');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <nav className="flex space-x-6">
              <a href="/" className="text-gray-700 hover:text-primary-600">Dashboard</a>
              <a href="/admin" className="text-gray-700 hover:text-primary-600">Admin</a>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message && (
          <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded-lg">
            {message}
          </div>
        )}

        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Database Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total KOLs</span>
                <span className="font-semibold">{stats?.totalKols || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Platforms</span>
                <span className="font-semibold">{stats?.totalPlatforms || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Metrics</span>
                <span className="font-semibold">{stats?.totalMetrics || 0}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Scraping Stats (24h)</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Successful</span>
                <span className="font-semibold text-green-600">{stats?.recentScrapes || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Failed</span>
                <span className="font-semibold text-red-600">{stats?.failedScrapes || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Success Rate</span>
                <span className="font-semibold">
                  {stats && stats.recentScrapes + stats.failedScrapes > 0
                    ? `${((stats.recentScrapes / (stats.recentScrapes + stats.failedScrapes)) * 100).toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Queue Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Waiting</span>
                <span className="font-semibold text-yellow-600">{stats?.queue.waiting || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active</span>
                <span className="font-semibold text-blue-600">{stats?.queue.active || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="font-semibold text-green-600">{stats?.queue.completed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Failed</span>
                <span className="font-semibold text-red-600">{stats?.queue.failed || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Controls */}
        <div className="card mb-8">
          <h3 className="text-lg font-semibold mb-4">Queue Controls</h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleAction('queue/pause')}
              className="btn-secondary"
            >
              Pause Queue
            </button>
            <button
              onClick={() => handleAction('queue/resume')}
              className="btn-secondary"
            >
              Resume Queue
            </button>
            <button
              onClick={() => handleAction('queue/clear')}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium"
            >
              Clear Queue
            </button>
          </div>
        </div>

        {/* Scraping Controls */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Scraping Controls</h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleAction('scheduler/trigger/daily')}
              className="btn-primary"
            >
              Trigger Daily Scrape
            </button>
            <button
              onClick={() => handleAction('scheduler/trigger/weekly')}
              className="btn-primary"
            >
              Trigger Weekly Scrape
            </button>
            <button
              onClick={() => handleAction('retry-failed')}
              className="btn-secondary"
            >
              Retry Failed Scrapes
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}