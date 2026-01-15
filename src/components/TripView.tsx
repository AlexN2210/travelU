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
    <div className="min-h-screen bg-cream font-body">
      <TripNotifications tripId={tripId} />
      <div className="bg-white shadow-soft w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-dark-gray/70 hover:text-dark-gray mb-4 font-body transition-colors"
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

          <div className="flex space-x-1 overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center space-x-2 px-4 sm:px-6 py-3 font-body font-medium rounded-t-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-cream text-turquoise border-b-2 border-turquoise'
                    : 'text-dark-gray/70 hover:text-dark-gray'
                }`}
              >
                {tab.icon}
                <span className="text-sm sm:text-base">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full overflow-x-hidden">
        {activeTab === 'stages' && <StagesTab tripId={tripId} tripType={trip.type} />}
        {activeTab === 'participants' && <ParticipantsTab tripId={tripId} creatorId={trip.creator_id} />}
        {activeTab === 'voting' && <VotingTab tripId={tripId} />}
        {activeTab === 'expenses' && <ExpensesTab tripId={tripId} />}
        {activeTab === 'checklist' && <ChecklistTab tripId={tripId} />}
      </div>
    </div>
  );
}
