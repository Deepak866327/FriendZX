import React, { useState } from 'react';
import { MapPin, Users, Bluetooth } from 'lucide-react';
import { RadiusMapFilter } from '@/components/Location/RadiusMapFilter';
import { NearbyUsers } from '@/components/Location/NearbyUsers';
import { BluetoothDiscovery } from '@/components/Bluetooth/BluetoothDiscovery';

type NearbyTab = 'map' | 'people' | 'bluetooth';

const TABS: { key: NearbyTab; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { key: 'map',       label: 'Map',       Icon: ({ size }) => <MapPin size={size} /> },
  { key: 'people',    label: 'People',    Icon: ({ size }) => <Users size={size} /> },
  { key: 'bluetooth', label: 'Bluetooth', Icon: ({ size }) => <Bluetooth size={size} /> },
];

export const NearbyPage: React.FC = () => {
  const [tab,    setTab]    = useState<NearbyTab>('map');
  const [radius, setRadius] = useState(5);

  return (
    <div className="pb-24 pt-3">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* Page header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-800">
            <span className="gradient-text">Nearby</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Discover people, places and connections around you</p>
        </div>

        {/* Tab bar */}
        <div className="glass rounded-xl p-1 flex gap-1 mb-5">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                tab === key
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
              style={{ minHeight: 36 }}
            >
              <Icon size={13} />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'map' && (
          <RadiusMapFilter radius={radius} onRadiusChange={setRadius} />
        )}
        {tab === 'people' && (
          <NearbyUsers />
        )}
        {tab === 'bluetooth' && (
          <BluetoothDiscovery />
        )}
      </div>
    </div>
  );
};
