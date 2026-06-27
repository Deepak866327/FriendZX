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

/* ── Bottom sheet wrapper ────────────────────────────────────────────── */
const Sheet: React.FC<{
  onClose: () => void;
  icon: React.ReactNode;
  title: string;
  gradient?: string;
  children: React.ReactNode;
}> = ({ onClose, icon, title, gradient = 'linear-gradient(135deg,#6366f1,#8b5cf6)', children }) => {
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
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-[#0f0a28]/40" />

          <motion.div
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl max-h-[88dvh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300/70 mx-auto mt-3 mb-1 flex-shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/40 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: gradient }}
                >
                  {icon}
                </div>
                <h3 className="text-sm font-bold text-slate-800">{title}</h3>
              </div>
              <button
                onClick={handleClose}
                className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/60"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-4 pb-safe flex flex-col gap-4" style={{ scrollbarWidth: 'none' }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ── Floating pill button ────────────────────────────────────────────── */
const BarBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <motion.button
    onClick={onClick}
    className="relative flex flex-col items-center justify-center gap-0.5 px-3.5 py-2"
    style={{ minWidth: 56 }}
    whileTap={{ scale: 0.82 }}
    transition={{ type: 'spring', damping: 18, stiffness: 420 }}
    aria-label={label}
  >
    {/* Active glow background */}
    <AnimatePresence>
      {active && (
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.13),rgba(139,92,246,0.13))' }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.18 }}
        />
      )}
    </AnimatePresence>

    <div className={`relative z-10 transition-colors duration-200 ${active ? 'text-indigo-600' : 'text-slate-500'}`}>
      {icon}
    </div>
    <span className={`relative z-10 text-[9px] font-semibold tracking-wide transition-colors duration-200 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
      {label}
    </span>

    {/* Active dot */}
    <AnimatePresence>
      {active && (
        <motion.div
          className="absolute bottom-1 w-1 h-1 rounded-full"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
        />
      )}
    </AnimatePresence>
  </motion.button>
);

/* ── Main component ──────────────────────────────────────────────────── */
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
      {/* ── Floating pill bar ── */}
      <div
        className="fixed left-0 right-0 z-30 flex justify-center pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
      >
        <motion.div
          className="pointer-events-auto flex items-center rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.60)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.16), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.70)',
          }}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280, delay: 0.1 }}
        >
          <BarBtn
            icon={<MapPin size={19} />}
            label="Location"
            active={isTracking}
            onClick={() => setShowLocationSheet(true)}
          />
          <BarBtn
            icon={<Bluetooth size={19} />}
            label="Nearby"
            active={isDiscovering}
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
            onClick={() => setShowRCPicker(true)}
          />
        </motion.div>
      </div>

      {/* ── Location sheet ── */}
      {showLocationSheet && (
        <Sheet
          onClose={() => setShowLocationSheet(false)}
          icon={<MapPin size={15} />}
          title="Location Tracking"
          gradient="linear-gradient(135deg,#6366f1,#8b5cf6)"
        >
          <LocationTracker />
          <NearbyUsers />
        </Sheet>
      )}

      {/* ── Bluetooth sheet ── */}
      {showBtSheet && (
        <Sheet
          onClose={() => setShowBtSheet(false)}
          icon={<Bluetooth size={15} />}
          title="Bluetooth Discovery"
          gradient="linear-gradient(135deg,#38bdf8,#0ea5e9)"
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
            style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            onClick={() => setShowRCPicker(false)}
          >
            <div className="absolute inset-0 bg-[#0f0a28]/50" />

            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="glass-strong w-full max-w-sm rounded-3xl overflow-hidden relative z-10"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 pt-7 pb-4 text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                >
                  <Shuffle size={24} className="text-white" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">Random Connect</h3>
                <p className="text-sm text-slate-400 mt-1">Choose how you want to connect</p>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2 px-4 pb-6">
                <motion.button
                  className="glass-hover rounded-2xl p-4 flex items-center gap-4 text-left"
                  onClick={() => { setShowRCPicker(false); setShowStartCall(true); }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)' }}
                  >
                    <Video size={19} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Nearby Video Call</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Start a room visible to people within your radius</p>
                  </div>
                </motion.button>

                <motion.button
                  className="glass-hover rounded-2xl p-4 flex items-center gap-4 text-left"
                  onClick={() => { setShowRCPicker(false); setShowRandomConnect(true); }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                  >
                    <Shuffle size={19} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Random Call</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Get matched 1-on-1 with a random person nearby</p>
                  </div>
                </motion.button>

                <button
                  className="text-center text-xs text-slate-400 py-2 hover:text-slate-600 transition-colors"
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
