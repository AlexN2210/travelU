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
  userEmail: string;
  balance: number;
}

interface ExpensesTabProps {
  tripId: string;
}

export function ExpensesTab({ tripId }: ExpensesTabProps) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, [tripId]);

  const loadExpenses = async () => {
    setLoading(true);
    const { data: expensesData, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (!error && expensesData) {
      const expensesWithEmails = expensesData.map((expense) => {
        return {
          ...expense,
          payer_email: expense.paid_by === user?.id ? user.email : 'Utilisateur'
        };
      });
      setExpenses(expensesWithEmails);
      calculateBalances(expensesWithEmails);
    }
    setLoading(false);
  };

  const calculateBalances = async (expensesData: Expense[]) => {
    const { data: participants } = await supabase
      .from('trip_participants')
      .select('user_id')
      .eq('trip_id', tripId);

    if (!participants) return;

    const balanceMap = new Map<string, number>();
    participants.forEach(p => balanceMap.set(p.user_id, 0));

    for (const expense of expensesData) {
      const splitCount = expense.split_between.length;
      const amountPerPerson = expense.amount / splitCount;

      balanceMap.set(expense.paid_by, (balanceMap.get(expense.paid_by) || 0) + expense.amount);

      expense.split_between.forEach((userId: string) => {
        balanceMap.set(userId, (balanceMap.get(userId) || 0) - amountPerPerson);
      });
    }

    const balancesWithEmails = Array.from(balanceMap.entries()).map(([userId, balance]) => {
      return {
        userId,
        userEmail: userId === user?.id ? user.email : 'Utilisateur',
        balance
      };
    });

    setBalances(balancesWithEmails);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Supprimer cette dépense ?')) return;

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (!error) {
      loadExpenses();
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
              <div key={balance.userId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">{balance.userEmail}</span>
                <span className={`font-bold ${
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
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {expense.description}
                    </h3>
                    <span className="px-3 py-1 bg-turquoise/20 text-turquoise text-xs font-heading font-semibold rounded-full">
                      {expense.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>Payé par: {expense.payer_email}</span>
                    <span>•</span>
                    <span>Partagé entre {expense.split_between.length} personne{expense.split_between.length > 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{new Date(expense.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-2xl font-bold text-gray-900">
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
          onClose={() => setShowAddExpense(false)}
          onSuccess={() => {
            setShowAddExpense(false);
            loadExpenses();
          }}
        />
      )}
    </div>
  );
}

interface AddExpenseModalProps {
  tripId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddExpenseModal({ tripId, onClose, onSuccess }: AddExpenseModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<{ id: string; email: string }[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadParticipants();
  }, []);

  const loadParticipants = async () => {
    const { data: participantsData } = await supabase
      .from('trip_participants')
      .select('user_id')
      .eq('trip_id', tripId);

    if (participantsData) {
      const participantsWithEmails = participantsData.map((p) => {
        return {
          id: p.user_id,
          email: p.user_id === user?.id ? user.email : 'Utilisateur'
        };
      });
      setParticipants(participantsWithEmails);
      setSelectedParticipants(participantsWithEmails.map(p => p.id));
    }
  };

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

    const { error: insertError } = await supabase
      .from('expenses')
      .insert({
        trip_id: tripId,
        amount: amountNum,
        category,
        description,
        paid_by: user!.id,
        split_between: selectedParticipants
      });

    if (insertError) {
      setError('Erreur lors de l\'ajout de la dépense');
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
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Restaurant, Transport, Hébergement..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Partager entre *
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {participants.map((participant) => (
                <label
                  key={participant.id}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(participant.id)}
                    onChange={() => toggleParticipant(participant.id)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-900">{participant.email}</span>
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
