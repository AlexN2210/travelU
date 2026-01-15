import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { VotePlacesAutocomplete } from '../VotePlacesAutocomplete';

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

function VoteOptionImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src) return null;

  return (
    <div className="mb-4">
      {!failed ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-64 object-cover rounded-xl border border-cream"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-64 rounded-xl border border-cream bg-cream flex items-center justify-center px-4 text-center">
          <p className="text-sm text-dark-gray/70 font-body break-words">
            Impossible de charger l’image. Utilise une URL directe d’image (ex: `.jpg`, `.png`) ou une image hébergée publiquement.
          </p>
        </div>
      )}
    </div>
  );
}

function getPlatformLabel(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('booking.')) return 'Voir sur Booking';
    if (host.includes('airbnb.')) return 'Voir sur Airbnb';
    return 'Voir le lien';
  } catch {
    return 'Voir le lien';
  }
}

export function VotingTab({ tripId }: VotingTabProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<VoteCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [options, setOptions] = useState<VoteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddOption, setShowAddOption] = useState(false);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swipeDx, setSwipeDx] = useState(0);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [mobileVoteView, setMobileVoteView] = useState<'swipe' | 'ranking'>('swipe');
  const [tripLocation, setTripLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(pointer: coarse)');
    const compute = () => setIsCoarsePointer((mq?.matches ?? false) || window.innerWidth < 768);
    compute();
    window.addEventListener('resize', compute);
    mq?.addEventListener?.('change', compute);
    return () => {
      window.removeEventListener('resize', compute);
      mq?.removeEventListener?.('change', compute);
    };
  }, []);

  // Swipe gesture state
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  const setCardRefs = useCallback((node: HTMLDivElement | null) => {
    cardRef.current = node;
    setCardEl(node);
  }, []);
  const commitSwipeRef = useRef<(direction: 'left' | 'right') => Promise<void>>(async () => {});

  useEffect(() => {
    loadCategories();
  }, [tripId]);

  // Charger un point de référence (destination) pour biaiser Google Places sur la bonne zone
  useEffect(() => {
    const loadTripLocation = async () => {
      try {
        const { data, error } = await supabase.rpc('get_trip_stages', { trip_uuid: tripId });
        if (error || !data || !Array.isArray(data) || data.length === 0) return;

        const coords = data
          .map((s: any) => ({ lat: Number(s.latitude), lng: Number(s.longitude) }))
          .filter((c: any) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

        if (coords.length === 0) return;

        // moyenne simple (fonctionne pour destination unique + roadtrip)
        const avg = coords.reduce(
          (acc: any, c: any) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
          { lat: 0, lng: 0 }
        );
        setTripLocation({ lat: avg.lat / coords.length, lng: avg.lng / coords.length });
      } catch (e) {
        console.warn('Impossible de charger la localisation du voyage pour Places:', e);
      }
    };

    if (tripId) loadTripLocation();
  }, [tripId]);

  useEffect(() => {
    if (selectedCategory) {
      loadOptions(selectedCategory);
    }
  }, [selectedCategory]);

  // Reset swipe position when category changes (ne PAS dépendre de options.length,
  // sinon le swipe est "annulé" dès qu'on recharge les options après un vote)
  useEffect(() => {
    setSwipeIndex(0);
    setSwipeDx(0);
  }, [selectedCategory]);

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

  const handleVote = async (optionId: string, vote: boolean, opts?: { reload?: boolean }) => {
    const shouldReload = opts?.reload ?? true;
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

    if (shouldReload && selectedCategory) {
      loadOptions(selectedCategory);
    }
  };

  const applyCardTransform = (dx: number) => {
    const el = cardRef.current;
    if (!el) return;
    // Pendant le drag, pas de transition (sinon effet "collant")
    el.style.transition = '';
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
    setSwipeDx(0);
  };

  const commitSwipe = async (direction: 'left' | 'right') => {
    const current = options[swipeIndex];
    if (!current) return;
    // UX: avancer immédiatement, et ne pas "annuler" le swipe par un reload d'options.
    // IMPORTANT: on autorise swipeIndex === options.length pour afficher "Plus d’options"
    setSwipeIndex((i) => Math.min(i + 1, options.length));
    setSwipeDx(0);
    void handleVote(current.id, direction === 'right', { reload: false }).catch((e) =>
      console.error('Erreur vote (swipe):', e)
    );
  };

  // IMPORTANT: on garde une ref vers la dernière version de commitSwipe
  // (sinon le hook des listeners touch se ré-attache à chaque render et casse le gesture).
  commitSwipeRef.current = commitSwipe;

  const animateSwipeOut = async (direction: 'left' | 'right') => {
    const el = cardRef.current;
    if (!el) {
      await commitSwipeRef.current(direction);
      return;
    }
    const width = el.getBoundingClientRect().width || 320;
    const offX = (direction === 'right' ? 1 : -1) * (width * 1.2);
    const rotate = direction === 'right' ? 10 : -10;

    el.style.transition = 'transform 180ms ease-out';
    el.style.transform = `translateX(${offX}px) rotate(${rotate}deg)`;

    // Après l’anim, on commit et on remet la carte au centre (sans transition) pour la prochaine option.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 190));
    await commitSwipeRef.current(direction);

    // Reset DOM pour la prochaine carte
    el.style.transition = '';
    el.style.transform = 'translateX(0px) rotate(0deg)';
  };

  // Swipe mobile: listeners natifs (React peut rendre touchmove "passif" => preventDefault ignoré)
  // IMPORTANT: ce hook doit être APRES la définition de commitSwipe (sinon TDZ -> "Cannot access before initialization")
  useEffect(() => {
    if (!isCoarsePointer) return;
    const el = cardEl;
    if (!el) return;

    let active = false;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;

    const threshold = 55;

    const onTouchStart = (ev: TouchEvent) => {
      if (!ev.touches || ev.touches.length !== 1) return;
      active = true;
      const t = ev.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      dx = 0;
      dy = 0;
      setSwipeDx(0);
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (!active || !ev.touches || ev.touches.length !== 1) return;
      const t = ev.touches[0];
      dx = t.clientX - startX;
      dy = t.clientY - startY;

      // Geste horizontal => on prend la main (sinon on laisse le scroll vertical)
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
        ev.preventDefault();
        setSwipeDx(dx);
        applyCardTransform(dx);
      }
    };

    const finish = async () => {
      if (!active) return;
      active = false;
      if (dx > threshold) {
        await animateSwipeOut('right');
      } else if (dx < -threshold) {
        await animateSwipeOut('left');
      } else {
        resetCardTransform();
      }
    };

    const onTouchEnd = () => {
      void finish();
    };

    const onTouchCancel = () => {
      active = false;
      resetCardTransform();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [isCoarsePointer, cardEl]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  const rankedOptions = [...options].sort((a, b) => {
    const scoreB = (b.upvotes || 0) - (b.downvotes || 0);
    const scoreA = (a.upvotes || 0) - (a.downvotes || 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    if ((b.upvotes || 0) !== (a.upvotes || 0)) return (b.upvotes || 0) - (a.upvotes || 0);
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });

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

      {isCoarsePointer && options.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileVoteView('swipe')}
            className={`px-4 py-2 rounded-xl font-body font-semibold transition-colors ${
              mobileVoteView === 'swipe'
                ? 'bg-turquoise text-white'
                : 'bg-white text-dark-gray border border-cream hover:bg-cream'
            }`}
          >
            Swipe
          </button>
          <button
            type="button"
            onClick={() => setMobileVoteView('ranking')}
            className={`px-4 py-2 rounded-xl font-body font-semibold transition-colors ${
              mobileVoteView === 'ranking'
                ? 'bg-turquoise text-white'
                : 'bg-white text-dark-gray border border-cream hover:bg-cream'
            }`}
          >
            Classement
          </button>
        </div>
      )}

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
      ) : isCoarsePointer && mobileVoteView === 'swipe' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600">
              Swipe à droite = <span className="font-semibold">Oui</span>, swipe à gauche = <span className="font-semibold">Non</span>
            </p>
          </div>

          {currentSwipeOption ? (
            <div className="relative max-w-md mx-auto">
              <div
                ref={setCardRefs}
                className="bg-white rounded-2xl shadow-medium overflow-hidden select-none"
                style={{ touchAction: 'pan-y' }}
              >
                {/* Overlays swipe */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                  {swipeDx > 35 && (
                    <div className="px-3 py-1 rounded-full bg-palm-green/90 text-white font-heading font-bold text-xs tracking-widest">
                      OUI
                    </div>
                  )}
                  {swipeDx < -35 && (
                    <div className="px-3 py-1 rounded-full bg-burnt-orange/90 text-white font-heading font-bold text-xs tracking-widest">
                      NON
                    </div>
                  )}
                </div>
                <div className="absolute top-4 right-4 z-10 pointer-events-none">
                  <div className="px-3 py-1 rounded-full bg-white/85 text-dark-gray text-xs font-heading font-semibold">
                    {Math.min(swipeIndex + 1, options.length)}/{options.length}
                  </div>
                </div>

                {/* Image */}
                {currentSwipeOption.image_url ? (
                  <div className="w-full aspect-[4/3] bg-cream">
                    <VoteOptionImage src={currentSwipeOption.image_url} alt={currentSwipeOption.title} />
                  </div>
                ) : (
                  <div className="w-full aspect-[4/3] bg-cream flex items-center justify-center">
                    <p className="text-sm text-dark-gray/70 font-body">Aucune image</p>
                  </div>
                )}

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-heading font-bold text-dark-gray break-words">
                    {currentSwipeOption.title}
                  </h3>

                  {currentSwipeOption.description && (
                    <p className="text-dark-gray/80 text-sm font-body mt-2 break-words">
                      {currentSwipeOption.description}
                    </p>
                  )}

                  {currentSwipeOption.link && (
                    <a
                      href={currentSwipeOption.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center space-x-2 text-turquoise hover:opacity-90 text-sm font-body"
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{getPlatformLabel(currentSwipeOption.link)}</span>
                    </a>
                  )}

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-cream">
                  <button
                    onClick={() => animateSwipeOut('left')}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-burnt-orange/10 text-burnt-orange font-body font-semibold"
                    type="button"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span>Non</span>
                  </button>
                  <button
                    onClick={() => animateSwipeOut('right')}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-palm-green/10 text-palm-green font-body font-semibold"
                    type="button"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>Oui</span>
                  </button>
                </div>
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
      ) : isCoarsePointer && mobileVoteView === 'ranking' ? (
        <div className="space-y-3">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-dark-gray/80 font-body">
              Classement (trié par score puis likes).
            </p>
          </div>
          {rankedOptions.map((option) => {
            const score = (option.upvotes || 0) - (option.downvotes || 0);
            return (
              <div key={option.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {option.image_url ? (
                  <div className="w-full aspect-[16/9] bg-cream">
                    <VoteOptionImage src={option.image_url} alt={option.title} />
                  </div>
                ) : null}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading font-bold text-dark-gray break-words">{option.title}</h3>
                      {option.description && (
                        <p className="text-sm text-dark-gray/80 mt-1 break-words">{option.description}</p>
                      )}
                    </div>
                    <div className={`shrink-0 text-sm font-heading font-bold tabular-nums ${
                      score > 0 ? 'text-palm-green' : score < 0 ? 'text-burnt-orange' : 'text-dark-gray/70'
                    }`}>
                      {score > 0 ? '+' : ''}{score}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-cream">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-body text-dark-gray/80">
                        👍 <span className="font-semibold tabular-nums">{option.upvotes || 0}</span>
                      </div>
                      <div className="text-sm font-body text-dark-gray/80">
                        👎 <span className="font-semibold tabular-nums">{option.downvotes || 0}</span>
                      </div>
                    </div>
                    {option.link && (
                      <a
                        href={option.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-turquoise hover:opacity-90 text-sm font-body"
                      >
                        {getPlatformLabel(option.link)}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rankedOptions.map((option) => {
            // const totalVotes = option.upvotes + option.downvotes; // Non utilisé pour l'instant
            const score = option.upvotes - option.downvotes;

            return (
              <div key={option.id} className="bg-white rounded-lg shadow-sm p-6">
                {option.image_url && (
                  <VoteOptionImage src={option.image_url} alt={option.title} />
                )}
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
                    <span>{getPlatformLabel(option.link)}</span>
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
          categoryName={categories.find(c => c.id === selectedCategory)?.name}
          categoryTitle={categories.find(c => c.id === selectedCategory)?.title}
          latitude={tripLocation?.lat}
          longitude={tripLocation?.lng}
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
  categoryName?: string;
  categoryTitle?: string;
  latitude?: number;
  longitude?: number;
  onClose: () => void;
  onSuccess: () => void;
}

function getCategoryCopy(categoryName?: string, categoryTitle?: string) {
  const name = (categoryName || '').toLowerCase();
  const title = categoryTitle || 'option';

  switch (name) {
    case 'accommodation':
      return {
        modalTitle: `Ajouter un hébergement`,
        titleLabel: `Nom de l'hébergement *`,
        titlePlaceholder: `Ex: Hôtel Marriott / Riad / Appartement...`,
        descLabel: `Description (optionnel)`,
        descPlaceholder: `Quartier, distance, avis, conditions...`,
        linkLabel: `Lien (optionnel)`,
        linkPlaceholder: `Lien Booking/Airbnb... (https://...)`
      };
    case 'restaurant':
      return {
        modalTitle: `Ajouter un restaurant`,
        titleLabel: `Nom du restaurant *`,
        titlePlaceholder: `Ex: Le Petit Bistro`,
        descLabel: `Description (optionnel)`,
        descPlaceholder: `Type de cuisine, budget, pourquoi c’est bien...`,
        linkLabel: `Lien (optionnel)`,
        linkPlaceholder: `Lien Google Maps / site du restaurant... (https://...)`
      };
    case 'activity':
      return {
        modalTitle: `Ajouter une activité`,
        titleLabel: `Nom de l’activité *`,
        titlePlaceholder: `Ex: Visite du musée, excursion, surf...`,
        descLabel: `Description (optionnel)`,
        descPlaceholder: `Durée, prix, horaires, infos utiles...`,
        linkLabel: `Lien (optionnel)`,
        linkPlaceholder: `Lien billet / Google Maps / site... (https://...)`
      };
    default:
      return {
        modalTitle: `Ajouter une option (${title})`,
        titleLabel: `Titre *`,
        titlePlaceholder: `Ex: Idée à proposer`,
        descLabel: `Description (optionnel)`,
        descPlaceholder: `Ajoute des détails pour aider le groupe à décider...`,
        linkLabel: `Lien (optionnel)`,
        linkPlaceholder: `https://...`
      };
  }
}

function AddOptionModal({ categoryId, categoryName, categoryTitle, latitude, longitude, onClose, onSuccess }: AddOptionModalProps) {
  const { user } = useAuth();
  const copy = getCategoryCopy(categoryName, categoryTitle);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPreview = async () => {
    setPreviewError('');
    if (!link || !/^https?:\/\//i.test(link)) {
      setPreviewError('Ajoute un lien valide (https://...) pour générer un aperçu.');
      return;
    }

    setPreviewLoading(true);
    try {
      const resp = await fetch(`/api/link-preview?url=${encodeURIComponent(link)}`);
      const data = await resp.json();

      if (data?.error) {
        setPreviewError(`Aperçu indisponible: ${data.error}`);
      } else {
        // On ne remplace pas si l'utilisateur a déjà rempli
        if (!title && data.title) setTitle(data.title);
        if (!description && data.description) setDescription(data.description);
        if (!imageUrl && data.image) {
          setImagePreviewError(false);
          setImageUrl(data.image);
        }
        if (!data.image && !data.description && !data.title) {
          setPreviewError('Aucune métadonnée trouvée pour ce lien.');
        }
      }
    } catch (e: any) {
      setPreviewError(e?.message || 'Erreur lors de la génération de l’aperçu.');
    } finally {
      setPreviewLoading(false);
    }
  };

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
          {copy.modalTitle}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {(categoryName === 'restaurant' || categoryName === 'activity') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {categoryName === 'restaurant'
                  ? 'Trouver via Google Places (restaurant/bar/café)'
                  : 'Trouver via Google Places (activité)'}
              </label>
              <VotePlacesAutocomplete
                mode={categoryName === 'restaurant' ? 'restaurant' : 'activity'}
                latitude={latitude}
                longitude={longitude}
                placeholder={
                  categoryName === 'restaurant'
                    ? 'Rechercher un restaurant, bar ou café...'
                    : 'Rechercher une activité (musée, parc, attraction...)...'
                }
                onSelect={(p) => {
                  // auto-remplir
                  if (!title) setTitle(p.name);
                  if (!description) setDescription(p.address);
                  setLink(p.url);
                  if (p.imageUrl) {
                    setImagePreviewError(false);
                    setImageUrl(p.imageUrl);
                  }
                }}
              />
              <p className="mt-2 text-xs text-gray-500">
                Astuce: sélectionne un résultat pour remplir automatiquement Titre + Lien Google Maps (et photo si disponible).
              </p>
            </div>
          )}

          {previewError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
              {previewError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {copy.titleLabel}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={copy.titlePlaceholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {copy.descLabel}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={copy.descPlaceholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {copy.linkLabel}
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={copy.linkPlaceholder}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={fetchPreview}
                disabled={previewLoading}
                className="px-3 py-2 text-sm bg-turquoise text-white rounded-button hover:bg-turquoise/90 disabled:opacity-50"
              >
                {previewLoading ? 'Aperçu...' : 'Générer aperçu (image + description)'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image (URL) (optionnel)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onInput={() => setImagePreviewError(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://.../photo.jpg"
            />
            {imageUrl && (
              <div className="mt-3">
                {!imagePreviewError ? (
                  <img
                    src={imageUrl}
                    alt="Aperçu"
                    className="w-full h-40 object-cover rounded-xl border border-gray-200"
                    loading="lazy"
                    onError={() => setImagePreviewError(true)}
                  />
                ) : (
                  <div className="w-full h-40 rounded-xl border border-gray-200 bg-cream flex items-center justify-center px-4 text-center">
                    <p className="text-xs text-dark-gray/70 font-body break-words">
                      Aperçu indisponible. Vérifie que c’est une URL directe d’image (ex: `.jpg`, `.png`) et accessible publiquement.
                    </p>
                  </div>
                )}
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
