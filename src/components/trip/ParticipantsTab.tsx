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
    
    // Essayer d'abord avec la fonction PostgreSQL qui bypass RLS
    const { data: functionData, error: functionError } = await supabase
      .rpc('get_trip_participants', { trip_uuid: tripId });

    if (!functionError && functionData) {
      // Récupérer les emails via la fonction PostgreSQL
      const participantsWithEmails = await Promise.all(
        functionData.map(async (participant) => {
          let userEmail = 'Utilisateur';
          
          // Si c'est l'utilisateur actuel, utiliser son email directement
          if (participant.user_id === user?.id) {
            userEmail = user.email || 'Utilisateur';
          } else {
            // Sinon, utiliser la fonction PostgreSQL pour récupérer l'email
            const { data: emailData, error: emailError } = await supabase
              .rpc('get_user_email', { user_uuid: participant.user_id });
            
            if (!emailError && emailData) {
              userEmail = emailData;
            }
          }
          
          return {
            ...participant,
            user_email: userEmail
          };
        })
      );
      setParticipants(participantsWithEmails);
      setLoading(false);
      return;
    }

    // Si la fonction n'existe pas ou échoue, utiliser la méthode classique
    const { data: participantsData, error } = await supabase
      .from('trip_participants')
      .select('*')
      .eq('trip_id', tripId);

    if (!error && participantsData) {
      // Récupérer les emails via la fonction PostgreSQL
      const participantsWithEmails = await Promise.all(
        participantsData.map(async (participant) => {
          let userEmail = 'Utilisateur';
          
          // Si c'est l'utilisateur actuel, utiliser son email directement
          if (participant.user_id === user?.id) {
            userEmail = user.email || 'Utilisateur';
          } else {
            // Sinon, utiliser la fonction PostgreSQL pour récupérer l'email
            const { data: emailData, error: emailError } = await supabase
              .rpc('get_user_email', { user_uuid: participant.user_id });
            
            if (!emailError && emailData) {
              userEmail = emailData;
            }
          }
          
          return {
            ...participant,
            user_email: userEmail
          };
        })
      );
      setParticipants(participantsWithEmails);
    } else if (error) {
      console.error('Erreur lors du chargement des participants:', error);
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
        <div className="w-12 h-12 border-4 border-turquoise border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-dark-gray/70 font-body">Chargement des participants...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-heading font-bold text-dark-gray">Participants</h2>
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

      {participants.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-8 text-center">
          <Users className="w-12 h-12 text-dark-gray/30 mx-auto mb-4" />
          <p className="text-dark-gray/70 font-body">Aucun participant pour le moment</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-soft divide-y divide-cream">
          {participants.map((participant) => (
            <div key={participant.id} className="p-6 flex items-center justify-between hover:bg-cream/30 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-turquoise/20 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-turquoise" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-body font-medium text-dark-gray">{participant.user_email}</p>
                    {participant.user_id === creatorId && (
                      <Crown className="w-4 h-4 text-gold" title="Créateur du voyage" />
                    )}
                  </div>
                  <p className="text-sm text-dark-gray/60 font-body">
                    Rejoint le {new Date(participant.joined_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {isCreator && participant.user_id !== creatorId && (
                  <>
                    <select
                      value={participant.permission}
                      onChange={(e) => handleChangePermission(participant.id, e.target.value as 'read' | 'edit')}
                      className="px-3 py-1.5 border border-cream rounded-button text-sm font-body focus:ring-2 focus:ring-turquoise focus:border-transparent bg-white text-dark-gray"
                    >
                      <option value="read">Lecture</option>
                      <option value="edit">Édition</option>
                    </select>
                    <button
                      onClick={() => handleRemoveParticipant(participant.id)}
                      className="text-burnt-orange hover:text-burnt-orange/80 p-2 transition-colors"
                      title="Retirer ce participant"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
                {!isCreator && (
                  <span className={`px-3 py-1.5 text-sm font-body font-medium rounded-full ${
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
      )}

      {isCreator && (
        <div className="bg-cream/50 border border-turquoise/30 rounded-xl p-6">
          <h3 className="font-heading font-semibold text-dark-gray mb-2">Lien d'invitation</h3>
          <p className="text-sm text-dark-gray/70 font-body mb-4">
            Partagez ce lien avec vos amis pour les inviter à rejoindre le voyage
          </p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/join/${tripId}`}
              className="flex-1 px-4 py-2 bg-white border border-turquoise/30 rounded-button text-sm font-body text-dark-gray"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/join/${tripId}`);
                alert('Lien copié dans le presse-papiers !');
              }}
              className="px-4 py-2 bg-turquoise text-white font-body font-semibold rounded-button hover:bg-turquoise/90 transition-colors shadow-soft"
            >
              Copier
            </button>
          </div>
        </div>
      )}

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

    // Utiliser la fonction PostgreSQL pour trouver l'utilisateur par email
    const { data: userId, error: userError } = await supabase
      .rpc('find_user_by_email', { user_email: email });

    if (userError || !userId) {
      setError('Utilisateur non trouvé avec cet email. Assurez-vous que l\'utilisateur a un compte TravelU.');
      setLoading(false);
      return;
    }

    // Vérifier si l'utilisateur est déjà participant
    const { data: existingParticipant } = await supabase
      .from('trip_participants')
      .select('id')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingParticipant) {
      setError('Cet utilisateur est déjà participant à ce voyage.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('trip_participants')
      .insert({
        trip_id: tripId,
        user_id: userId,
        permission
      });

    if (insertError) {
      console.error('Erreur lors de l\'invitation:', insertError);
      setError('Erreur lors de l\'invitation. Veuillez réessayer.');
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-heading font-bold text-dark-gray">
            Inviter un participant
          </h2>
          <button
            onClick={onClose}
            className="text-dark-gray/60 hover:text-dark-gray transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm font-body">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-body font-medium text-dark-gray mb-2">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent font-body text-dark-gray"
              placeholder="participant@email.com"
            />
            <p className="text-xs text-dark-gray/60 mt-1 font-body">
              L'utilisateur doit avoir un compte TravelU avec cet email
            </p>
          </div>

          <div>
            <label className="block text-sm font-body font-medium text-dark-gray mb-2">
              Permission
            </label>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'read' | 'edit')}
              className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent font-body text-dark-gray bg-white"
            >
              <option value="read">Lecture seule</option>
              <option value="edit">Édition</option>
            </select>
            <p className="text-xs text-dark-gray/60 mt-1 font-body">
              Les éditeurs peuvent modifier le voyage, les lecteurs peuvent seulement consulter
            </p>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-dark-gray/70 hover:text-dark-gray font-body font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-turquoise text-white font-body font-semibold rounded-button hover:bg-turquoise/90 transition-colors disabled:opacity-50 shadow-soft"
            >
              {loading ? 'Invitation...' : 'Inviter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
