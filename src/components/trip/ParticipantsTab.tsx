import { useState, useEffect } from 'react';
import { Plus, Users, Crown, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Participant {
  id: string;
  user_id: string;
  permission: 'read' | 'edit';
  joined_at: string;
  user_email?: string;
}

interface ParticipantsTabProps {
  tripId: string;
  creatorId: string;
}

export function ParticipantsTab({ tripId, creatorId }: ParticipantsTabProps) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const isCreator = user?.id === creatorId;

  useEffect(() => {
    loadParticipants();
  }, [tripId]);

  const loadParticipants = async () => {
    setLoading(true);
    const { data: participantsData, error } = await supabase
      .from('trip_participants')
      .select('*')
      .eq('trip_id', tripId);

    if (!error && participantsData) {
      // Récupérer les emails via la table auth.users (accessible via RLS)
      // Note: On ne peut pas utiliser admin.getUserById côté client
      const participantsWithEmails = participantsData.map((participant) => {
        return {
          ...participant,
          user_email: participant.user_id === user?.id ? user.email : 'Utilisateur'
        };
      });
      setParticipants(participantsWithEmails);
    }
    setLoading(false);
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!confirm('Retirer ce participant ?')) return;

    const { error } = await supabase
      .from('trip_participants')
      .delete()
      .eq('id', participantId);

    if (!error) {
      loadParticipants();
    }
  };

  const handleChangePermission = async (participantId: string, newPermission: 'read' | 'edit') => {
    const { error } = await supabase
      .from('trip_participants')
      .update({ permission: newPermission })
      .eq('id', participantId);

    if (!error) {
      loadParticipants();
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Participants</h2>
        {isCreator && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
          >
            <Plus className="w-5 h-5" />
            <span>Inviter</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {participants.map((participant) => (
          <div key={participant.id} className="p-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-turquoise/20 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-turquoise" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <p className="font-medium text-gray-900">{participant.user_email}</p>
                  {participant.user_id === creatorId && (
                    <Crown className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Rejoint le {new Date(participant.joined_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {isCreator && participant.user_id !== creatorId && (
                <>
                  <select
                    value={participant.permission}
                    onChange={(e) => handleChangePermission(participant.id, e.target.value as 'read' | 'edit')}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="read">Lecture</option>
                    <option value="edit">Édition</option>
                  </select>
                  <button
                    onClick={() => handleRemoveParticipant(participant.id)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )}
              {!isCreator && (
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  participant.permission === 'edit'
                    ? 'bg-palm-green/20 text-palm-green'
                    : 'bg-cream text-dark-gray/70'
                }`}>
                  {participant.permission === 'edit' ? 'Éditeur' : 'Lecteur'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Lien d'invitation</h3>
        <p className="text-sm text-blue-700 mb-4">
          Partagez ce lien avec vos amis pour les inviter à rejoindre le voyage
        </p>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={`${window.location.origin}/join/${tripId}`}
            className="flex-1 px-4 py-2 bg-white border border-blue-300 rounded-lg text-sm"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/join/${tripId}`);
              alert('Lien copié !');
            }}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Copier
          </button>
        </div>
      </div>

      {showInvite && (
        <InviteModal
          tripId={tripId}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setShowInvite(false);
            loadParticipants();
          }}
        />
      )}
    </div>
  );
}

interface InviteModalProps {
  tripId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function InviteModal({ tripId, onClose, onSuccess }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'read' | 'edit'>('read');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: users, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (userError || !users) {
      setError('Utilisateur non trouvé avec cet email');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('trip_participants')
      .insert({
        trip_id: tripId,
        user_id: users.id,
        permission
      });

    if (insertError) {
      setError('Erreur lors de l\'invitation. L\'utilisateur est peut-être déjà participant.');
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  };

  // Bloque le scroll du body quand la modale est ouverte
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-medium max-w-md w-full p-8 max-h-[90vh] overflow-y-auto smooth-scroll modal-content">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Inviter un participant
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="participant@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permission
            </label>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'read' | 'edit')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="read">Lecture seule</option>
              <option value="edit">Édition</option>
            </select>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Invitation...' : 'Inviter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
