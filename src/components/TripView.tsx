import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Users, Vote, DollarSign, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StagesTab } from './trip/StagesTab';
import { ParticipantsTab } from './trip/ParticipantsTab';
import { VotingTab } from './trip/VotingTab';
import { ExpensesTab } from './trip/ExpensesTab';
import { ChecklistTab } from './trip/ChecklistTab';
import { TripNotifications } from './TripNotifications';

interface TripViewProps {
  tripId: string;
  onBack: () => void;
}

interface Trip {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  type: 'single' | 'roadtrip';
  creator_id: string;
}

type Tab = 'stages' | 'participants' | 'voting' | 'expenses' | 'checklist';

export function TripView({ tripId, onBack }: TripViewProps) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('stages');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrip();
  }, [tripId]);

  const loadTrip = async () => {
    setLoading(true);
    
    // Essayer d'abord avec la fonction PostgreSQL qui bypass RLS
    const { data: functionData, error: functionError } = await supabase
      .rpc('get_trip_by_id', { trip_uuid: tripId });

    if (!functionError && functionData && functionData.length > 0) {
      setTrip(functionData[0] as Trip);
      setLoading(false);
      return;
    }

    // Si la fonction n'existe pas ou échoue, utiliser la méthode classique
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .maybeSingle();

    if (!error && data) {
      setTrip(data);
    } else if (error) {
      console.error('Erreur lors du chargement du voyage:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center font-body">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-dark-gray/70 font-body">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center font-body">
        <div className="text-center">
          <p className="text-dark-gray/70 mb-4 font-body">Voyage introuvable</p>
          <button
            onClick={onBack}
            className="text-turquoise hover:text-turquoise/80 font-body font-medium transition-colors"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'stages', label: 'Étapes', icon: <MapPin className="w-5 h-5" /> },
    { id: 'participants', label: 'Participants', icon: <Users className="w-5 h-5" /> },
    { id: 'voting', label: 'Votes', icon: <Vote className="w-5 h-5" /> },
    { id: 'expenses', label: 'Dépenses', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'checklist', label: 'Checklist', icon: <CheckSquare className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-[100svh] bg-cream font-body flex flex-col">
      <TripNotifications tripId={tripId} />
      {/* Header (app-like on mobile) */}
      <header className="bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-soft w-full overflow-x-hidden sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 w-full">
          {/* Mobile: compact app bar */}
          <div className="sm:hidden flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-dark-gray/70 active:bg-cream transition-colors"
              aria-label="Retour"
              type="button"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-dark-gray/60 font-body">Voyage</p>
              <h1 className="text-base font-heading font-bold text-dark-gray truncate">
                {trip.name}
              </h1>
            </div>
            <span className={`px-3 py-1 text-[11px] font-heading font-semibold rounded-full whitespace-nowrap ${
              trip.type === 'roadtrip'
                ? 'bg-palm-green/20 text-palm-green'
                : 'bg-turquoise/20 text-turquoise'
            }`}>
              {trip.type === 'roadtrip' ? 'Road trip' : 'Destination unique'}
            </span>
          </div>

          {/* Desktop/tablet: existing header */}
          <div className="hidden sm:block">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-dark-gray/70 hover:text-dark-gray mb-4 font-body transition-colors"
              type="button"
            >
              <ArrowLeft className="w-5 h-5 flex-shrink-0" />
              <span>Retour</span>
            </button>

            <div className="mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-heading font-bold text-dark-gray mb-2 break-words">
                    {trip.name}
                  </h1>
                  {trip.description && (
                    <p className="text-dark-gray/70 font-body break-words">{trip.description}</p>
                  )}
                </div>
                <span className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-heading font-semibold rounded-full whitespace-nowrap flex-shrink-0 ${
                  trip.type === 'roadtrip'
                    ? 'bg-palm-green/20 text-palm-green'
                    : 'bg-turquoise/20 text-turquoise'
                }`}>
                  {trip.type === 'roadtrip' ? 'Road trip' : 'Destination unique'}
                </span>
              </div>
              <div className="flex items-center space-x-4 text-xs sm:text-sm text-dark-gray/60 mt-4 font-body flex-wrap">
                <span className="break-words">
                  {new Date(trip.start_date).toLocaleDateString('fr-FR')} - {new Date(trip.end_date).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>

            {/* Tabs desktop */}
            <div className="hidden sm:flex space-x-1 overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0 scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center space-x-2 px-4 sm:px-6 py-3 font-body font-medium rounded-t-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-cream text-turquoise border-b-2 border-turquoise'
                      : 'text-dark-gray/70 hover:text-dark-gray'
                  }`}
                  type="button"
                >
                  {tab.icon}
                  <span className="text-sm sm:text-base">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-[calc(84px+env(safe-area-inset-bottom))] sm:pb-8 w-full">
        {activeTab === 'stages' && <StagesTab tripId={tripId} tripType={trip.type} />}
        {activeTab === 'participants' && <ParticipantsTab tripId={tripId} creatorId={trip.creator_id} />}
        {activeTab === 'voting' && <VotingTab tripId={tripId} />}
        {activeTab === 'expenses' && <ExpensesTab tripId={tripId} />}
        {activeTab === 'checklist' && <ChecklistTab tripId={tripId} />}
        </div>
      </main>

      {/* Bottom tab bar mobile */}
      <nav className="fixed bottom-0 left-0 right-0 sm:hidden z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-7xl px-3">
          <div className="mb-2 bg-white border border-cream/70 shadow-soft rounded-2xl px-2 py-2 grid grid-cols-5 gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={`bottom-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex flex-col items-center justify-center py-2 rounded-xl transition-colors active:scale-[0.98] ${
                  isActive ? 'bg-cream text-turquoise' : 'text-dark-gray/60'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className={`${isActive ? 'text-turquoise' : 'text-dark-gray/60'}`}>
                  {tab.icon}
                </div>
                <span className="text-[11px] font-body font-semibold leading-none mt-1">
                  {tab.label}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      </nav>
    </div>
  );
}
