import { useState, useEffect } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ChecklistItem {
  id: string;
  trip_id: string;
  category: string;
  item: string;
  is_completed: boolean;
  completed_by: string | null;
  is_auto_generated: boolean;
  created_at: string;
}

interface ChecklistTabProps {
  tripId: string;
}

const CATEGORIES = [
  { id: 'clothes', label: 'Vêtements', icon: '👕' },
  { id: 'health', label: 'Santé', icon: '💊' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'accessories', label: 'Accessoires', icon: '🎒' },
  { id: 'activities', label: 'Activités', icon: '🎯' }
];

const SMART_SUGGESTIONS: Record<string, string[]> = {
  clothes: [
    'T-shirts',
    'Pantalons',
    'Sous-vêtements',
    'Chaussettes',
    'Chaussures de marche',
    'Veste légère',
    'Maillot de bain',
    'Pyjama',
    'Casquette ou chapeau'
  ],
  health: [
    'Médicaments personnels',
    'Trousse de premiers soins',
    'Protection solaire',
    'Répulsif anti-moustiques',
    'Masques',
    'Gel hydroalcoolique',
    'Lunettes de soleil',
    'Médicaments contre le mal des transports'
  ],
  documents: [
    'Passeport ou carte d\'identité',
    'Visa (si nécessaire)',
    'Permis de conduire',
    'Assurance voyage',
    'Réservations d\'hôtel',
    'Billets d\'avion/train',
    'Carte bancaire',
    'Carte européenne d\'assurance maladie'
  ],
  accessories: [
    'Chargeurs de téléphone',
    'Adaptateur électrique',
    'Sac à dos',
    'Bouteille d\'eau réutilisable',
    'Écouteurs',
    'Appareil photo',
    'Guide de voyage',
    'Sac pour linge sale'
  ],
  activities: [
    'Matériel de randonnée',
    'Équipement de plongée',
    'Jeux de cartes',
    'Livre',
    'Carnet de notes',
    'Applications de voyage téléchargées'
  ]
};

export function ChecklistTab({ tripId }: ChecklistTabProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);

  useEffect(() => {
    loadItems();
  }, [tripId]);

  const loadItems = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_trip_checklist_items', { p_trip_id: tripId });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const handleToggleItem = async (itemId: string, currentState: boolean) => {
    const { error } = await supabase.rpc('set_checklist_item_completed', {
      p_item_id: itemId,
      p_is_completed: !currentState
    });

    if (!error) {
      loadItems();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.rpc('delete_checklist_item', { p_item_id: itemId });

    if (!error) {
      loadItems();
    }
  };

  const handleGenerateSuggestions = async () => {
    const existingItems = new Set(items.map(item => item.item.toLowerCase()));
    const newItems = [];

    for (const [category, suggestions] of Object.entries(SMART_SUGGESTIONS)) {
      for (const suggestion of suggestions) {
        if (!existingItems.has(suggestion.toLowerCase())) {
          newItems.push({
            trip_id: tripId,
            category,
            item: suggestion,
            is_completed: false,
            is_auto_generated: true
          });
        }
      }
    }

    if (newItems.length > 0) {
      const { error } = await supabase.rpc('add_checklist_items_bulk', {
        p_trip_id: tripId,
        p_items: newItems.map((i) => ({
          category: i.category,
          item: i.item,
          is_auto_generated: true
        }))
      });

      if (!error) {
        loadItems();
      }
    }
  };

  const getItemsByCategory = (category: string) => {
    return items.filter(item => item.category === category);
  };

  const getCompletionPercentage = () => {
    if (items.length === 0) return 0;
    const completed = items.filter(item => item.is_completed).length;
    return Math.round((completed / items.length) * 100);
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
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Checklist</h2>
          <p className="text-gray-600 mt-1">
            {items.filter(i => i.is_completed).length} / {items.length} terminé
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleGenerateSuggestions}
            className="flex items-center space-x-2 px-4 py-2 bg-palm-green text-white font-body font-bold rounded-button hover:bg-palm-green/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
          >
            <Sparkles className="w-5 h-5" />
            <span>Suggestions</span>
          </button>
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-turquoise text-white font-body font-bold rounded-button hover:bg-turquoise/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter</span>
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progression</span>
            <span className="text-sm font-bold text-blue-600">{getCompletionPercentage()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${getCompletionPercentage()}%` }}
            />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucun élément pour le moment
          </h3>
          <p className="text-gray-600 mb-6">
            Générez des suggestions ou ajoutez vos propres éléments
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleGenerateSuggestions}
              className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              <span>Générer des suggestions</span>
            </button>
            <button
              onClick={() => setShowAddItem(true)}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ajouter manuellement
            </button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.map((category) => {
            const categoryItems = getItemsByCategory(category.id);
            if (categoryItems.length === 0) return null;

            return (
              <div key={category.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-2xl">{category.icon}</span>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {category.label}
                  </h3>
                  <span className="text-sm text-gray-500">
                    ({categoryItems.filter(i => i.is_completed).length}/{categoryItems.length})
                  </span>
                </div>

                <div className="space-y-2">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg group"
                    >
                      <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.is_completed}
                          onChange={() => handleToggleItem(item.id, item.is_completed)}
                          className="w-5 h-5 text-blue-600 rounded"
                        />
                        <span className={`text-sm ${
                          item.is_completed
                            ? 'text-gray-400 line-through'
                            : 'text-gray-900'
                        }`}>
                          {item.item}
                        </span>
                        {item.is_auto_generated && (
                          <Sparkles className="w-3 h-3 text-green-500" />
                        )}
                      </label>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 p-1 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddItem && (
        <AddItemModal
          tripId={tripId}
          onClose={() => setShowAddItem(false)}
          onSuccess={() => {
            setShowAddItem(false);
            loadItems();
          }}
        />
      )}
    </div>
  );
}

interface AddItemModalProps {
  tripId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddItemModal({ tripId, onClose, onSuccess }: AddItemModalProps) {
  const [category, setCategory] = useState('clothes');
  const [item, setItem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: insertError } = await supabase.rpc('add_checklist_item', {
      p_trip_id: tripId,
      p_category: category,
      p_item: item,
      p_is_auto_generated: false
    });

    if (insertError) {
      console.error('Erreur ajout checklist:', insertError);
      setError(insertError.message || 'Erreur lors de l\'ajout');
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
          Ajouter un élément
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catégorie *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Élément *
            </label>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Crème solaire"
            />
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
