import { useEffect, useMemo, useRef, useState } from 'react';
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
  image_url?: string | null;
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
  const [swipeIndex, setSwipeIndex] = useState(0);

  const isCoarsePointer = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(pointer: coarse)')?.matches || window.innerWidth < 768;
  }, []);

  // Swipe gesture state
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0
  });

  useEffect(() => {
    loadCategories();
  }, [tripId]);

  useEffect(() => {
    if (selectedCategory) {
      loadOptions(selectedCategory);
    }
  }, [selectedCategory]);

  // Reset swipe position when options/category change
  useEffect(() => {
    setSwipeIndex(0);
  }, [selectedCategory, options.length]);

  const createDefaultCategoriesFallback = async () => {
    const defaultCategories = [
      { name: 'accommodation', title: 'Hébergements' },
      { name: 'activity', title: 'Activités' },
      { name: 'restaurant', title: 'Restaurants' },
      { name: 'other', title: 'Autres' }
    ];

    const { error } = await supabase.from('vote_categories').insert(
      defaultCategories.map((cat) => ({
        trip_id: tripId,
        name: cat.name,
        title: cat.title
      }))
    );

    if (error) {
      // Si l'utilisateur est lecteur, l'insert peut être refusé par RLS. On ignore ici.
      console.warn('Impossible de créer les catégories par défaut (fallback):', error);
    }
  };

  const loadCategories = async () => {
    setLoading(true);
    // 1) Tentative via RPC (recommandé)
    const { data, error } = await supabase.rpc('get_trip_vote_categories', { p_trip_id: tripId });

    if (!error && data && Array.isArray(data)) {
      if (data.length === 0) {
        // Crée les catégories par défaut (créateur/éditeur uniquement) via RPC
        const { error: ensureErr } = await supabase.rpc('ensure_default_vote_categories', { p_trip_id: tripId });
        if (ensureErr) {
          // Fallback (si RPC non déployé)
          await createDefaultCategoriesFallback();
        }
        const { data: data2 } = await supabase.rpc('get_trip_vote_categories', { p_trip_id: tripId });
        if (data2 && Array.isArray(data2)) {
          setCategories(data2);
          if (data2.length > 0) setSelectedCategory(data2[0].id);
        }
      } else {
        setCategories(data);
        if (!selectedCategory) setSelectedCategory(data[0].id);
      }
      setLoading(false);
      return;
    }

    // 2) Fallback si RPC non déployé (404 / function not found / etc.)
    if (error) {
      console.error('Erreur chargement catégories vote (RPC):', error);
    }

    const { data: cats, error: catsErr } = await supabase
      .from('vote_categories')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    if (catsErr) {
      console.error('Erreur chargement catégories vote (fallback):', catsErr);
      setLoading(false);
      return;
    }

    if (!cats || cats.length === 0) {
      await createDefaultCategoriesFallback();
      const { data: cats2 } = await supabase
        .from('vote_categories')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });
      if (cats2) {
        setCategories(cats2);
        if (cats2.length > 0) setSelectedCategory(cats2[0].id);
      }
    } else {
      setCategories(cats);
      if (!selectedCategory) setSelectedCategory(cats[0].id);
    }

    setLoading(false);
  };

  const loadOptions = async (categoryId: string) => {
    // 1) Tentative via RPC (anti N+1)
    const { data, error } = await supabase.rpc('get_vote_options_with_counts', { p_category_id: categoryId });
    if (!error && data && Array.isArray(data)) {
      setOptions(
        data.map((o: any) => ({
          ...o,
          userVote: o.user_vote ?? null
        }))
      );
      return;
    }

    if (error) {
      console.error('Erreur chargement options vote (RPC):', error);
    }

    // 2) Fallback: chargement direct + calcul votes (plus lent)
    const { data: optionsData, error: optionsErr } = await supabase
      .from('vote_options')
      .select('*')
      .eq('category_id', categoryId)
      .order('created_at', { ascending: false });

    if (optionsErr || !optionsData) {
      console.error('Erreur chargement options vote (fallback):', optionsErr);
      return;
    }

    const optionsWithVotes = await Promise.all(
      optionsData.map(async (option: any) => {
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
  };

  const handleVote = async (optionId: string, vote: boolean) => {
    const existingVote = options.find(o => o.id === optionId)?.userVote;

    if (existingVote === vote) {
      const { error } = await supabase.rpc('remove_vote', { p_option_id: optionId });
      if (error) {
        // fallback direct
        await supabase.from('user_votes').delete().eq('option_id', optionId).eq('user_id', user!.id);
      }
    } else {
      const { error } = await supabase.rpc('cast_vote', { p_option_id: optionId, p_vote: vote });
      if (error) {
        // fallback direct
        await supabase
          .from('user_votes')
          .upsert({ option_id: optionId, user_id: user!.id, vote }, { onConflict: 'option_id,user_id' });
      }
    }

    if (selectedCategory) {
      loadOptions(selectedCategory);
    }
  };

  const applyCardTransform = (dx: number) => {
    const el = cardRef.current;
    if (!el) return;
    const rotate = Math.max(-12, Math.min(12, dx / 20));
    el.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;
  };

  const resetCardTransform = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'transform 150ms ease-out';
    el.style.transform = 'translateX(0px) rotate(0deg)';
    window.setTimeout(() => {
      if (el) el.style.transition = '';
    }, 160);
  };

  const commitSwipe = async (direction: 'left' | 'right') => {
    const current = options[swipeIndex];
    if (!current) return;
    await handleVote(current.id, direction === 'right');
    setSwipeIndex((i) => Math.min(i + 1, Math.max(0, options.length - 1)));
    resetCardTransform();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  const currentSwipeOption = options[swipeIndex];

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
      ) : isCoarsePointer ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600">
              Swipe à droite = <span className="font-semibold">Oui</span>, swipe à gauche = <span className="font-semibold">Non</span>
            </p>
          </div>

          {currentSwipeOption ? (
            <div className="relative">
              <div
                ref={cardRef}
                className="bg-white rounded-lg shadow-sm p-6 touch-none select-none"
                onPointerDown={(e) => {
                  // uniquement touch/coarse
                  dragRef.current.active = true;
                  dragRef.current.startX = e.clientX;
                  dragRef.current.startY = e.clientY;
                  dragRef.current.dx = 0;
                  dragRef.current.dy = 0;
                  (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragRef.current.active) return;
                  const dx = e.clientX - dragRef.current.startX;
                  const dy = e.clientY - dragRef.current.startY;
                  dragRef.current.dx = dx;
                  dragRef.current.dy = dy;
                  // si l'utilisateur scrolle verticalement, ne pas bloquer
                  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return;
                  applyCardTransform(dx);
                }}
                onPointerUp={async () => {
                  if (!dragRef.current.active) return;
                  dragRef.current.active = false;
                  const { dx } = dragRef.current;
                  const threshold = 90;
                  if (dx > threshold) {
                    await commitSwipe('right');
                  } else if (dx < -threshold) {
                    await commitSwipe('left');
                  } else {
                    resetCardTransform();
                  }
                }}
                onPointerCancel={() => {
                  dragRef.current.active = false;
                  resetCardTransform();
                }}
              >
                {currentSwipeOption.image_url && (
                  <div className="mb-4">
                    <img
                      src={currentSwipeOption.image_url}
                      alt={currentSwipeOption.title}
                      className="w-full h-64 object-cover rounded-xl border border-cream"
                      loading="lazy"
                      onError={(e) => {
                        // Si l'image ne charge pas, on la masque
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {currentSwipeOption.title}
                </h3>

                {currentSwipeOption.description && (
                  <p className="text-gray-600 text-sm mb-3">{currentSwipeOption.description}</p>
                )}

                {currentSwipeOption.link && (
                  <a
                    href={currentSwipeOption.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1 mb-4"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Voir le lien</span>
                  </a>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <button
                    onClick={() => commitSwipe('left')}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
                    type="button"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span>Non</span>
                  </button>
                  <div className="text-sm text-gray-600 font-semibold">
                    {swipeIndex + 1}/{options.length}
                  </div>
                  <button
                    onClick={() => commitSwipe('right')}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
                    type="button"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>Oui</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-700 font-semibold">Plus d’options à swiper</p>
              <p className="text-sm text-gray-600 mt-1">Change de catégorie pour continuer.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {options.map((option) => {
            // const totalVotes = option.upvotes + option.downvotes; // Non utilisé pour l'instant
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
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: insertError } = await supabase.rpc('add_vote_option', {
      p_category_id: categoryId,
      p_title: title,
      p_description: description || null,
      p_link: link || null,
      p_image_url: imageUrl || null
    });

    if (insertError) {
      console.error('Erreur ajout option vote (RPC):', insertError);
      // fallback si RPC non déployé
      const { error: fallbackErr } = await supabase.from('vote_options').insert({
        category_id: categoryId,
        title,
        description: description || null,
        link: link || null,
        image_url: imageUrl || null,
        added_by: user!.id
      });

      if (fallbackErr) {
        console.error('Erreur ajout option vote (fallback):', fallbackErr);
        setError(fallbackErr.message || insertError.message || 'Erreur lors de l\'ajout de l\'option');
        setLoading(false);
        return;
      }
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image (URL) (optionnel)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://.../photo.jpg"
            />
            {imageUrl && (
              <div className="mt-3">
                <img
                  src={imageUrl}
                  alt="Aperçu"
                  className="w-full h-40 object-cover rounded-xl border border-gray-200"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
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
