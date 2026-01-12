import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Users, Vote, DollarSign, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StagesTab } from './trip/StagesTab';
import { ParticipantsTab } from './trip/ParticipantsTab';
import { VotingTab } from './trip/VotingTab';
import { ExpensesTab } from './trip/ExpensesTab';
import { ChecklistTab } from './trip/ChecklistTab';

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
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .maybeSingle();

    if (!error && data) {
      setTrip(data);
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
      <div className="bg-white shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-dark-gray/70 hover:text-dark-gray mb-4 font-body transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>

          <div className="mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-heading font-bold text-dark-gray mb-2">
                  {trip.name}
                </h1>
                {trip.description && (
                  <p className="text-dark-gray/70 font-body">{trip.description}</p>
                )}
              </div>
              <span className={`px-4 py-2 text-sm font-heading font-semibold rounded-full ${
                trip.type === 'roadtrip'
                  ? 'bg-palm-green/20 text-palm-green'
                  : 'bg-turquoise/20 text-turquoise'
              }`}>
                {trip.type === 'roadtrip' ? 'Road trip' : 'Destination unique'}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-dark-gray/60 mt-4 font-body">
              <span>
                {new Date(trip.start_date).toLocaleDateString('fr-FR')} - {new Date(trip.end_date).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>

          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center space-x-2 px-6 py-3 font-body font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-cream text-turquoise border-b-2 border-turquoise'
                    : 'text-dark-gray/70 hover:text-dark-gray'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'stages' && <StagesTab tripId={tripId} tripType={trip.type} />}
        {activeTab === 'participants' && <ParticipantsTab tripId={tripId} creatorId={trip.creator_id} />}
        {activeTab === 'voting' && <VotingTab tripId={tripId} />}
        {activeTab === 'expenses' && <ExpensesTab tripId={tripId} />}
        {activeTab === 'checklist' && <ChecklistTab tripId={tripId} />}
      </div>
    </div>
  );
}
