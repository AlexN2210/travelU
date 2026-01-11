import { useState, useEffect } from 'react';
import { Plus, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface VoteCategory {
  id: string;
  trip_id: string;
  name: string;
  title: string;
  created_at: string;
}

interface VoteOption {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  link: string | null;
  added_by: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  userVote: boolean | null;
}

interface VotingTabProps {
  tripId: string;
}

export function VotingTab({ tripId }: VotingTabProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<VoteCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [options, setOptions] = useState<VoteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddOption, setShowAddOption] = useState(false);

  useEffect(() => {
    loadCategories();
  }, [tripId]);

  useEffect(() => {
    if (selectedCategory) {
      loadOptions(selectedCategory);
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vote_categories')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setCategories(data);
      if (data.length > 0 && !selectedCategory) {
        setSelectedCategory(data[0].id);
      }
    } else if (!error && data?.length === 0) {
      await createDefaultCategories();
      loadCategories();
    }
    setLoading(false);
  };

  const createDefaultCategories = async () => {
    const defaultCategories = [
      { name: 'accommodation', title: 'Hébergements' },
      { name: 'activity', title: 'Activités' },
      { name: 'restaurant', title: 'Restaurants' },
      { name: 'other', title: 'Autres' }
    ];

    await supabase.from('vote_categories').insert(
      defaultCategories.map(cat => ({
        trip_id: tripId,
        name: cat.name,
        title: cat.title
      }))
    );
  };

  const loadOptions = async (categoryId: string) => {
    const { data: optionsData, error } = await supabase
      .from('vote_options')
      .select('*')
      .eq('category_id', categoryId)
      .order('created_at', { ascending: false });

    if (!error && optionsData) {
      const optionsWithVotes = await Promise.all(
        optionsData.map(async (option) => {
          const { data: votes } = await supabase
            .from('user_votes')
            .select('vote, user_id')
            .eq('option_id', option.id);

          const upvotes = votes?.filter(v => v.vote === true).length || 0;
          const downvotes = votes?.filter(v => v.vote === false).length || 0;
          const userVote = votes?.find(v => v.user_id === user?.id)?.vote ?? null;

          return {
            ...option,
            upvotes,
            downvotes,
            userVote
          };
        })
      );
      setOptions(optionsWithVotes);
    }
  };

  const handleVote = async (optionId: string, vote: boolean) => {
    const existingVote = options.find(o => o.id === optionId)?.userVote;

    if (existingVote === vote) {
      await supabase
        .from('user_votes')
        .delete()
        .eq('option_id', optionId)
        .eq('user_id', user!.id);
    } else {
      await supabase
        .from('user_votes')
        .upsert({
          option_id: optionId,
          user_id: user!.id,
          vote
        }, { onConflict: 'option_id,user_id' });
    }

    if (selectedCategory) {
      loadOptions(selectedCategory);
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
        <h2 className="text-2xl font-bold text-gray-900">Vote collaboratif</h2>
        {selectedCategory && (
          <button
            onClick={() => setShowAddOption(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter une option</span>
          </button>
        )}
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-6 py-2 font-medium rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === category.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {category.title}
          </button>
        ))}
      </div>

      {options.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucune option pour le moment
          </h3>
          <p className="text-gray-600 mb-6">
            Ajoutez des options et votez avec votre groupe
          </p>
          <button
            onClick={() => setShowAddOption(true)}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ajouter une option
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {options.map((option) => {
            const totalVotes = option.upvotes + option.downvotes;
            const score = option.upvotes - option.downvotes;

            return (
              <div key={option.id} className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {option.title}
                </h3>

                {option.description && (
                  <p className="text-gray-600 text-sm mb-3">{option.description}</p>
                )}

                {option.link && (
                  <a
                    href={option.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1 mb-4"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Voir le lien</span>
                  </a>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleVote(option.id, true)}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition-colors ${
                        option.userVote === true
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span className="font-semibold">{option.upvotes}</span>
                    </button>

                    <button
                      onClick={() => handleVote(option.id, false)}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition-colors ${
                        option.userVote === false
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span className="font-semibold">{option.downvotes}</span>
                    </button>
                  </div>

                  <div className={`text-sm font-semibold ${
                    score > 0 ? 'text-green-600' : score < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    Score: {score > 0 ? '+' : ''}{score}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddOption && selectedCategory && (
        <AddOptionModal
          categoryId={selectedCategory}
          onClose={() => setShowAddOption(false)}
          onSuccess={() => {
            setShowAddOption(false);
            if (selectedCategory) {
              loadOptions(selectedCategory);
            }
          }}
        />
      )}
    </div>
  );
}

interface AddOptionModalProps {
  categoryId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddOptionModal({ categoryId, onClose, onSuccess }: AddOptionModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: insertError } = await supabase
      .from('vote_options')
      .insert({
        category_id: categoryId,
        title,
        description: description || null,
        link: link || null,
        added_by: user!.id
      });

    if (insertError) {
      setError('Erreur lors de l\'ajout de l\'option');
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
          Ajouter une option
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titre *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Hôtel Marriott"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Décrivez l'option..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lien (optionnel)
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://..."
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
