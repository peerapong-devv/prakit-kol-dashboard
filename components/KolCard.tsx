import React from 'react';

interface KOL {
  id: number;
  name: string;
  category: string;
  avatarUrl?: string;
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

interface KolCardProps {
  kol: KOL;
}

const KolCard: React.FC<KolCardProps> = ({ kol }) => {
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return '📘';
      case 'instagram':
        return '📷';
      case 'tiktok':
        return '🎵';
      case 'youtube':
        return '📺';
      default:
        return '🌐';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getTotalFollowers = () => {
    return kol.platforms.reduce((total, platform) => {
      const latestMetric = platform.metrics?.[0];
      return total + (latestMetric?.followers || 0);
    }, 0);
  };

  const getAverageEngagement = () => {
    const engagements = kol.platforms
      .map(p => p.metrics?.[0]?.engagementRate || 0)
      .filter(e => e > 0);
    
    if (engagements.length === 0) return 0;
    return engagements.reduce((a, b) => a + b, 0) / engagements.length;
  };

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          {kol.avatarUrl ? (
            <img
              src={kol.avatarUrl}
              alt={kol.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold">
              {kol.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{kol.name}</h3>
          {kol.category && (
            <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full mt-1">
              {kol.category}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Followers</span>
          <span className="font-semibold">{formatNumber(getTotalFollowers())}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Avg. Engagement</span>
          <span className="font-semibold">{getAverageEngagement().toFixed(2)}%</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex space-x-2">
          {kol.platforms.map((platform) => (
            <a
              key={platform.id}
              href={`/kols/${kol.id}?platform=${platform.platformType}`}
              className="flex items-center space-x-1 px-2 py-1 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              title={`${platform.username} on ${platform.platformType}`}
            >
              <span className="text-lg">{getPlatformIcon(platform.platformType)}</span>
              <span className="text-xs text-gray-600">
                {formatNumber(platform.metrics?.[0]?.followers || 0)}
              </span>
            </a>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <a
          href={`/kols/${kol.id}`}
          className="block text-center text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          View Details →
        </a>
      </div>
    </div>
  );
};

export default KolCard;