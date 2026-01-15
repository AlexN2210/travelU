import { useState, useEffect } from 'react';
import { Plus, DollarSign, Trash2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Expense {
  id: string;
  trip_id: string;
  amount: number;
  category: string;
  description: string;
  paid_by: string;
  split_between: string[];
  created_at: string;
  payer_email?: string;
}

interface Balance {
  userId: string;
  userLabel: string;
  balance: number;
}

type ParticipantProfile = {
  user_id: string;
  permission: 'read' | 'edit' | string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

function formatParticipantLabel(p: ParticipantProfile, currentUserId?: string) {
  if (currentUserId && p.user_id === currentUserId) return 'Moi';
  // Afficher uniquement le prénom (demande utilisateur). Fallback si manquant.
  if (p.first_name && p.first_name.trim()) return p.first_name.trim();
  return 'Participant';
}

interface ExpensesTabProps {
  tripId: string;
}

const EXPENSE_CATEGORY_UI: Record<string, { label: string; badgeClass: string }> = {
  restaurant: { label: 'Restaurant / Bar', badgeClass: 'bg-burnt-orange/15 text-burnt-orange' },
  courses: { label: 'Courses', badgeClass: 'bg-gold/20 text-gold' },
  transport: { label: 'Transport', badgeClass: 'bg-turquoise/20 text-turquoise' },
  hebergement: { label: 'Hébergement', badgeClass: 'bg-palm-green/20 text-palm-green' },
  activite: { label: 'Activité', badgeClass: 'bg-turquoise/10 text-turquoise' },
  autre: { label: 'Autre', badgeClass: 'bg-cream text-dark-gray/70' }
};

export function ExpensesTab({ tripId }: ExpensesTabProps) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [participants, setParticipants] = useState<ParticipantProfile[]>([]);

  useEffect(() => {
    // Charger participants puis dépenses (labels cohérents)
    loadParticipantsAndExpenses();
  }, [tripId]);

  const loadParticipantsAndExpenses = async () => {
    setLoading(true);

    // 1) Participants (avec profils)
    const { data: participantsData, error: participantsError } = await supabase.rpc(
      'get_trip_participant_profiles',
      { p_trip_id: tripId }
    );

    const loadedParticipants = (participantsError ? [] : (participantsData || [])) as ParticipantProfile[];
    if (participantsError) {
      console.error('Erreur chargement participants profils:', participantsError);
    }
    setParticipants(loadedParticipants);

    // 2) Dépenses
    const { data: expensesData, error: expensesError } = await supabase.rpc('get_trip_expenses', { p_trip_id: tripId });
    if (expensesError) {
      console.error('Erreur chargement dépenses:', expensesError);
      setExpenses([]);
      setBalances([]);
      setLoading(false);
      return;
    }

    const labelById = new Map<string, string>();
    loadedParticipants.forEach((p) => labelById.set(p.user_id, formatParticipantLabel(p, user?.id)));
    if (user?.id) labelById.set(user.id, 'Moi');

    const normalizedExpenses: Expense[] = (expensesData || []).map((expense: any) => ({
      ...expense,
      // jsonb -> array (supabase retourne généralement déjà un array)
      split_between: Array.isArray(expense.split_between) ? expense.split_between : [],
      payer_email: labelById.get(expense.paid_by) || (expense.paid_by === user?.id ? 'Moi' : 'Participant')
    }));

    setExpenses(normalizedExpenses);
    calculateBalances(normalizedExpenses, loadedParticipants);
    setLoading(false);
  };

  const calculateBalances = (expensesData: Expense[], participantsList: ParticipantProfile[]) => {
    const balanceMap = new Map<string, number>();
    const ids = participantsList.map(p => p.user_id);
    ids.forEach(id => balanceMap.set(id, 0));

    for (const expense of expensesData) {
      const splitCount = expense.split_between.length;
      if (splitCount === 0) continue;
      const amountPerPerson = expense.amount / splitCount;

      balanceMap.set(expense.paid_by, (balanceMap.get(expense.paid_by) || 0) + expense.amount);

      expense.split_between.forEach((userId: string) => {
        balanceMap.set(userId, (balanceMap.get(userId) || 0) - amountPerPerson);
      });
    }

    const labelById = new Map<string, string>();
    participantsList.forEach(p => labelById.set(p.user_id, formatParticipantLabel(p, user?.id)));
    if (user?.id) labelById.set(user.id, 'Moi');

    const balancesWithEmails = Array.from(balanceMap.entries()).map(([userId, balance]) => {
      return {
        userId,
        userLabel: labelById.get(userId) || (userId === user?.id ? 'Moi' : 'Participant'),
        balance
      };
    });

    setBalances(balancesWithEmails);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Supprimer cette dépense ?')) return;

    // Préférer une RPC (si présente) pour éviter RLS; fallback sinon
    const { error: rpcError } = await supabase.rpc('delete_expense', { p_expense_id: expenseId });
    const { error } = rpcError
      ? await supabase.from('expenses').delete().eq('id', expenseId)
      : { error: null };

    if (!error) {
      loadParticipantsAndExpenses();
    }
  };

  const getTotalExpenses = () => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
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
        <h2 className="text-2xl font-bold text-gray-900">Gestion des dépenses</h2>
        <button
          onClick={() => setShowAddExpense(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter une dépense</span>
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-2">
            <DollarSign className="w-8 h-8 text-turquoise" />
            <div>
              <p className="text-sm text-gray-600">Total des dépenses</p>
              <p className="text-2xl font-bold text-gray-900">
                {getTotalExpenses().toFixed(2)} €
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Users className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Nombre de dépenses</p>
              <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-2">
            <DollarSign className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-sm text-gray-600">Par personne (moy.)</p>
              <p className="text-2xl font-bold text-gray-900">
                {balances.length > 0 ? (getTotalExpenses() / balances.length).toFixed(2) : '0.00'} €
              </p>
            </div>
          </div>
        </div>
      </div>

      {balances.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Soldes</h3>
          <div className="space-y-3">
            {balances.map((balance) => (
              <div key={balance.userId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg min-w-0">
                <span className="font-medium text-gray-900 min-w-0 flex-1 truncate">
                  {balance.userLabel}
                </span>
                <span className={`font-bold tabular-nums whitespace-nowrap text-right shrink-0 ${
                  balance.balance > 0 ? 'text-green-600' : balance.balance < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {balance.balance > 0 ? '+' : ''}{balance.balance.toFixed(2)} €
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucune dépense pour le moment
          </h3>
          <p className="text-gray-600 mb-6">
            Ajoutez vos dépenses pour suivre le budget du voyage
          </p>
          <button
            onClick={() => setShowAddExpense(true)}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ajouter une dépense
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {expenses.map((expense) => (
            <div key={expense.id} className="p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 break-words min-w-0">
                      {expense.description}
                    </h3>
                    <span className={`px-3 py-1 text-xs font-heading font-semibold rounded-full ${
                      EXPENSE_CATEGORY_UI[expense.category]?.badgeClass || 'bg-cream text-dark-gray/70'
                    }`}>
                      {EXPENSE_CATEGORY_UI[expense.category]?.label || expense.category}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                    <span className="break-words min-w-0">Payé par: {expense.payer_email}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="whitespace-nowrap">
                      Partagé entre {expense.split_between.length} personne{expense.split_between.length > 1 ? 's' : ''}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="whitespace-nowrap">{new Date(expense.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <span className="text-2xl font-bold text-gray-900 tabular-nums whitespace-nowrap">
                    {expense.amount.toFixed(2)} €
                  </span>
                  {expense.paid_by === user?.id && (
                    <button
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddExpense && (
        <AddExpenseModal
          tripId={tripId}
          participants={participants}
          onClose={() => setShowAddExpense(false)}
          onSuccess={() => {
            setShowAddExpense(false);
            loadParticipantsAndExpenses();
          }}
        />
      )}
    </div>
  );
}

interface AddExpenseModalProps {
  tripId: string;
  participants: ParticipantProfile[];
  onClose: () => void;
  onSuccess: () => void;
}

function AddExpenseModal({ tripId, participants, onClose, onSuccess }: AddExpenseModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('restaurant');
  const [description, setDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // pré-sélectionner tous les participants au chargement de la modale
    setSelectedParticipants(participants.map(p => p.user_id));
  }, [participants]);

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Montant invalide');
      return;
    }

    if (selectedParticipants.length === 0) {
      setError('Sélectionnez au moins un participant');
      return;
    }

    setLoading(true);

    const { error: insertError } = await supabase.rpc('create_expense', {
      p_trip_id: tripId,
      p_amount: amountNum,
      p_category: category,
      p_description: description,
      p_split_between: selectedParticipants
    });

    if (insertError) {
      console.error('Erreur ajout dépense:', insertError);
      setError(insertError.message || 'Erreur lors de l\'ajout de la dépense');
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
          Ajouter une dépense
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Restaurant"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montant (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catégorie *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-turquoise focus:border-transparent bg-white"
            >
              <option value="restaurant">Restaurant / Bar</option>
              <option value="courses">Courses</option>
              <option value="transport">Transport</option>
              <option value="hebergement">Hébergement</option>
              <option value="activite">Activité</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Partager entre *
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {participants.map((participant) => (
                <label
                  key={participant.user_id}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(participant.user_id)}
                    onChange={() => toggleParticipant(participant.user_id)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-900">{formatParticipantLabel(participant, user?.id)}</span>
                </label>
              ))}
            </div>
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
              {loading ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
