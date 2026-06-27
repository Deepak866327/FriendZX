import React, { useState, useEffect } from 'react';
import { MapPin, Bluetooth, Compass, Film, Shuffle, X, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { overlayVariants, sheetVariants, modalVariants } from '@/utils/animations';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLocation as useLocationContext } from '@/hooks/useLocation';
import { useBluetooth } from '@/context/BluetoothContext';
import { LocationTracker } from '@/components/Location/LocationTracker';
import { NearbyUsers } from '@/components/Location/NearbyUsers';
import { BluetoothDiscovery } from '@/components/Bluetooth/BluetoothDiscovery';
import { CrationFeed } from '@/components/Cration/CrationFeed';
import { CreateCrationModal } from '@/components/Cration/CreateCrationModal';
import { StartRandomCallModal } from '@/components/VideoRoom/StartRandomCallModal';
import { VideoRoomModal } from '@/components/VideoRoom/VideoRoomModal';
import { RandomConnectModal } from '@/components/VideoRoom/RandomConnectModal';
import { VideoRoom } from '@/services/videoRoomService';

const ALLOWED_ROUTES = ['/dashboard', '/profile'];

/* ── Shared animated bottom-sheet wrapper ── */
const Sheet: React.FC<{
  onClose: () => void;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ onClose, icon, title, children }) => {
  const [open, setOpen] = useState(true);
  const handleClose = () => setOpen(false);

  return (
    <AnimatePresence onExitComplete={onClose}>
      {open && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(15,10,40,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={handleClose}
        >
          <motion.div
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl max-h-[88dvh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300/70 mx-auto mt-3 mb-1 flex-shrink-0" />
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/40 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  {icon}
                </div>
                <h3 className="text-sm font-bold text-slate-800">{title}</h3>
              </div>
              <button
                onClick={handleClose}
                className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100/60"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
            {/* Body */}
            <div className="overflow-y-auto flex-1 p-4 scrollbar-none pb-safe flex flex-col gap-4">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ── Single bar button ── */
const BarBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  dot?: boolean;
  onClick: () => void;
}> = ({ icon, label, active, dot, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative"
    style={{ minHeight: 56 }}
  >
    <div className={`w-6 h-6 flex items-center justify-center transition-colors duration-200 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
      {icon}
    </div>
    <span className={`text-[9px] font-semibold tracking-wide transition-colors duration-200 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
      {label}
    </span>
    {dot && (
      <span
        className="absolute top-1.5 w-1.5 h-1.5 rounded-full"
        style={{ right: 'calc(50% - 14px)', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
      />
    )}
  </button>
);

export const BottomActionBar: React.FC = () => {
  const routerLocation    = useRouterLocation();
  const navigate          = useNavigate();
  const { user }          = useAuth();
  const { isTracking }    = useLocationContext();
  const { isDiscovering } = useBluetooth();

  const [userLocation,      setUserLocation]      = useState<{ latitude: number; longitude: number } | null>(null);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [showBtSheet,       setShowBtSheet]       = useState(false);
  const [showCrationFeed,   setShowCrationFeed]   = useState(false);
  const [showCreateCration, setShowCreateCration] = useState(false);
  const [showRCPicker,      setShowRCPicker]      = useState(false);
  const [showStartCall,     setShowStartCall]     = useState(false);
  const [showRandomConnect, setShowRandomConnect] = useState(false);
  const [activeRoom,        setActiveRoom]        = useState<VideoRoom | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
    );
  }, []);

  if (!ALLOWED_ROUTES.includes(routerLocation.pathname)) return null;

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User'
    : 'User';

  return (
    <>
      {/* ── Bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 glass-nav border-t border-white/30 pb-safe"
      >
        <div className="max-w-md mx-auto flex items-stretch justify-around">
          <BarBtn
            icon={<MapPin size={19} />}
            label="Location"
            active={isTracking}
            dot={isTracking}
            onClick={() => setShowLocationSheet(true)}
          />
          <BarBtn
            icon={<Bluetooth size={19} />}
            label="Nearby"
            active={isDiscovering}
            dot={isDiscovering}
            onClick={() => setShowBtSheet(true)}
          />
          <BarBtn
            icon={<Compass size={19} />}
            label="Explore"
            onClick={() => navigate('/explore')}
          />
          <BarBtn
            icon={<Film size={19} />}
            label="Crations"
            onClick={() => setShowCrationFeed(true)}
          />
          <BarBtn
            icon={<Shuffle size={19} />}
            label="Connect"
            active={!!(activeRoom || showRandomConnect)}
            dot={!!(activeRoom || showRandomConnect)}
            onClick={() => setShowRCPicker(true)}
          />
        </div>
      </div>

      {/* ── Location sheet ── */}
      {showLocationSheet && (
        <Sheet
          onClose={() => setShowLocationSheet(false)}
          icon={<MapPin size={14} className="text-indigo-500" />}
          title="Location Tracking"
        >
          <LocationTracker />
          <NearbyUsers />
        </Sheet>
      )}

      {/* ── Bluetooth sheet ── */}
      {showBtSheet && (
        <Sheet
          onClose={() => setShowBtSheet(false)}
          icon={<Bluetooth size={14} className="text-indigo-500" />}
          title="Bluetooth Discovery"
        >
          <BluetoothDiscovery />
        </Sheet>
      )}

      {/* ── Random Connect picker ── */}
      <AnimatePresence>
        {showRCPicker && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(15,10,40,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={() => setShowRCPicker(false)}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="glass-strong w-full max-w-sm rounded-3xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-7 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-glass">
                <Shuffle size={24} className="text-white" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Random Connect</h3>
              <p className="text-sm text-slate-400 mt-1">Choose how you want to connect</p>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-2 px-4 pb-6">
              <button
                className="glass-hover rounded-2xl p-4 flex items-center gap-4 text-left"
                onClick={() => { setShowRCPicker(false); setShowStartCall(true); }}
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Video size={19} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Nearby Video Call</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Start a room visible to people within your chosen radius</p>
                </div>
              </button>

              <button
                className="glass-hover rounded-2xl p-4 flex items-center gap-4 text-left"
                onClick={() => { setShowRCPicker(false); setShowRandomConnect(true); }}
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Shuffle size={19} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Random Call</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Get matched 1-on-1 with a random person from anywhere</p>
                </div>
              </button>

              <button
                className="text-center text-xs text-slate-400 py-2"
                onClick={() => setShowRCPicker(false)}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Remaining modals */}
      {showStartCall && (
        <StartRandomCallModal
          userLocation={userLocation}
          displayName={displayName}
          onClose={() => setShowStartCall(false)}
          onStarted={room => { setShowStartCall(false); setActiveRoom(room); }}
        />
      )}
      {activeRoom && (
        <VideoRoomModal
          room={activeRoom}
          currentUserId={user?.id ?? ''}
          displayName={displayName}
          onClose={() => setActiveRoom(null)}
        />
      )}
      {showRandomConnect && (
        <RandomConnectModal
          displayName={displayName}
          onClose={() => setShowRandomConnect(false)}
        />
      )}
      {showCrationFeed && (
        <CrationFeed
          onClose={() => setShowCrationFeed(false)}
          onCreateNew={() => { setShowCrationFeed(false); setShowCreateCration(true); }}
        />
      )}
      {showCreateCration && (
        <CreateCrationModal
          onClose={() => setShowCreateCration(false)}
          onCreated={() => setShowCreateCration(false)}
        />
      )}
    </>
  );
};
