import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Users, Vote, DollarSign, CheckSquare, Settings } from 'lucide-react';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Voyage introuvable</p>
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-700 font-medium"
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>

          <div className="mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {trip.name}
                </h1>
                {trip.description && (
                  <p className="text-gray-600">{trip.description}</p>
                )}
              </div>
              <span className={`px-4 py-2 text-sm font-semibold rounded-full ${
                trip.type === 'roadtrip'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {trip.type === 'roadtrip' ? 'Road trip' : 'Destination unique'}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-4">
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
                className={`flex items-center space-x-2 px-6 py-3 font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gray-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
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
