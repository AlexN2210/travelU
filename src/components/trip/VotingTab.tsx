import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, ThumbsUp, ThumbsDown, ExternalLink, Pencil } from 'lucide-react';
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
  address?: string | null;
  price?: string | null;
  photo_urls?: string[] | null;
  added_by: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  userVote: boolean | null;
}

interface VotingTabProps {
  tripId: string;
}

function toImageProxyUrl(src: string) {
  return `/api/image-proxy?url=${encodeURIComponent(src)}`;
}

function canProxyImageUrl(src: string) {
  return /^https?:\/\//i.test(src);
}

function SmartImage({
  src,
  alt,
  className,
  fallback,
  onFinalError,
  onRecovered
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  onFinalError?: () => void;
  onRecovered?: (cachedUrl: string) => void;
}) {
  const [attempt, setAttempt] = useState<0 | 1 | 2>(0);
  const recoveredRef = useRef(false);

  useEffect(() => {
    setAttempt(0);
    recoveredRef.current = false;
  }, [src]);

  if (!src) return null;

  const resolvedSrc =
    attempt === 0 ? src : attempt === 1 && canProxyImageUrl(src) ? toImageProxyUrl(src) : '';

  if (attempt === 2 || !resolvedSrc) {
    return <>{fallback || null}</>;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onLoad={() => {
        // Si on a dû passer par le proxy, essayer de “cacher” l’image en Storage (URL stable)
        if (attempt === 1 && !recoveredRef.current && onRecovered && canProxyImageUrl(src)) {
          recoveredRef.current = true;
          fetch(`/api/cache-image?url=${encodeURIComponent(src)}`)
            .then((r) => r.json())
            .then((j) => {
              const u = j?.publicUrl;
              if (typeof u === 'string' && u.length > 0) onRecovered(u);
            })
            .catch(() => {
              // ignore
            });
        }
      }}
      onError={() => {
        if (attempt === 0 && canProxyImageUrl(src)) {
          setAttempt(1);
          return;
        }
        setAttempt(2);
        onFinalError?.();
      }}
    />
  );
}

function VoteOptionImage({ src, alt }: { src: string; alt: string }) {
  if (!src) return null;

  return (
    <div className="mb-4">
      <SmartImage
        src={src}
        alt={alt}
        className="w-full h-64 object-cover rounded-xl border border-cream"
        fallback={
          <div className="w-full h-64 rounded-xl border border-cream bg-cream flex items-center justify-center px-4 text-center">
            <p className="text-sm text-dark-gray/70 font-body break-words">
              Impossible de charger l’image du lien. Ajoute des captures d’écran via “Photos” pour un affichage fiable.
            </p>
          </div>
        }
      />
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

function extractEuroAmount(text?: string | null) {
  if (!text) return null;
  // Ex: "à partir de 25€", "25 €", "EUR 25", "25,50€"
  const t = String(text);
  const m =
    t.match(/(\d{1,6}(?:[.,]\d{1,2})?)\s*€/) ||
    t.match(/€\s*(\d{1,6}(?:[.,]\d{1,2})?)/) ||
    t.match(/(?:EUR|€)\s*(\d{1,6}(?:[.,]\d{1,2})?)/i) ||
    t.match(/(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:EUR|eur)\b/i);
  if (!m) return null;
  return m[1]?.replace(',', '.') || null;
}

export function VotingTab({ tripId }: VotingTabProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<VoteCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [options, setOptions] = useState<VoteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddOption, setShowAddOption] = useState(false);
  const [editingOption, setEditingOption] = useState<VoteOption | null>(null);
  const [gallery, setGallery] = useState<{ option: VoteOption; index: number } | null>(null);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swipeDx, setSwipeDx] = useState(0);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [mobileVoteView, setMobileVoteView] = useState<'swipe' | 'ranking'>('swipe');
  const [tripLocation, setTripLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tripNights, setTripNights] = useState<number>(1);
  const [tripParticipantsCount, setTripParticipantsCount] = useState<number>(1);
  const [swipePhotoIndex, setSwipePhotoIndex] = useState(0);
  const [swipePhotoFailed, setSwipePhotoFailed] = useState(false);

  const repairOptionPrimaryImage = useCallback(
    async (optionId: string, cachedUrl: string) => {
      // 1) Update UI optimiste
      setOptions((arr) => arr.map((o) => (o.id === optionId ? { ...o, image_url: cachedUrl } : o)));
      // 2) Persister côté DB (si autorisé)
      try {
        await supabase.rpc('update_vote_option', {
          p_option_id: optionId,
          p_image_url: cachedUrl
        });
      } catch {
        // ignore
      }
    },
    []
  );

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

  const canEditOption = (o: VoteOption) => {
    return Boolean(user?.id && o?.added_by && o.added_by === user.id);
  };

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
    setSwipePhotoIndex(0);
    setSwipePhotoFailed(false);
  }, [selectedCategory]);

  // Reset carousel quand on change de card
  useEffect(() => {
    setSwipePhotoIndex(0);
    setSwipePhotoFailed(false);
  }, [swipeIndex]);

  // Charger infos voyage: nb participants + nb nuits (pour calcul prix/pers/nuit)
  useEffect(() => {
    const loadTripMeta = async () => {
      try {
        // 1) RPC fiable (bypass RLS): dates + nb participants
        const { data: meta, error: metaErr } = await supabase.rpc('get_trip_meta', { p_trip_id: tripId });
        if (!metaErr && Array.isArray(meta) && meta[0]) {
          const m: any = meta[0];
          const startDate = m.start_date as string | null;
          const endDate = m.end_date as string | null;
          const participantsCount = Number(m.participants_count);

          setTripParticipantsCount(Number.isFinite(participantsCount) ? Math.max(1, participantsCount) : 1);

          // IMPORTANT: utiliser UTC pour éviter les décalages timezone/DST
          const start = startDate ? new Date(`${startDate}T00:00:00Z`) : null;
          const end = endDate ? new Date(`${endDate}T00:00:00Z`) : null;
          if (start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
            const msPerDay = 1000 * 60 * 60 * 24;
            const diffDays = Math.round((end.getTime() - start.getTime()) / msPerDay);
            setTripNights(Math.max(1, diffDays || 1));
          } else {
            setTripNights(1);
          }
          return;
        }

        if (metaErr) {
          console.warn('Votes: get_trip_meta indisponible (fallback client):', metaErr);
        }

        // 2) Fallback client (ancien comportement)
        const { data: trip, error: tripErr } = await supabase
          .from('trips')
          .select('creator_id,start_date,end_date')
          .eq('id', tripId)
          .maybeSingle();
        if (tripErr || !trip) return;

        const start = trip.start_date ? new Date(`${trip.start_date}T00:00:00Z`) : null;
        const end = trip.end_date ? new Date(`${trip.end_date}T00:00:00Z`) : null;
        if (start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
          const msPerDay = 1000 * 60 * 60 * 24;
          const diffDays = Math.round((end.getTime() - start.getTime()) / msPerDay);
          setTripNights(Math.max(1, diffDays || 1));
        }

        const creatorId = trip.creator_id as string | null;

        const { data: tps } = await supabase
          .from('trip_participants')
          .select('user_id')
          .eq('trip_id', tripId);
        const ids = new Set<string>();
        (tps || []).forEach((r: any) => r?.user_id && ids.add(String(r.user_id)));
        if (creatorId) ids.add(creatorId);
        setTripParticipantsCount(Math.max(1, ids.size || 1));
      } catch (e) {
        console.warn('Impossible de charger le meta voyage (participants/nuits):', e);
      }
    };

    if (tripId) void loadTripMeta();
  }, [tripId]);

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
      // IMPORTANT: si la DB n’a pas les dernières migrations RPC, il se peut que la fonction
      // ne retourne pas photo_urls -> on tombe alors sur “seulement la 1ère photo”.
      const hasPhotoUrls = data.some((o: any) => Object.prototype.hasOwnProperty.call(o, 'photo_urls'));
      if (hasPhotoUrls) {
        setOptions(
          data.map((o: any) => ({
            ...o,
            userVote: o.user_vote ?? null
          }))
        );
        return;
      }
      console.warn('RPC get_vote_options_with_counts ne retourne pas photo_urls; fallback select(*)');
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

  const getOptionPrimaryImage = (o?: VoteOption | null) => {
    if (!o) return null;
    const arr = Array.isArray(o.photo_urls) ? o.photo_urls : [];
    return (o.image_url || arr[0] || null) as string | null;
  };

  const getOptionImages = (o?: VoteOption | null) => {
    if (!o) return [] as string[];
    const urls: string[] = [];
    if (o.image_url) urls.push(o.image_url);
    if (Array.isArray(o.photo_urls)) {
      for (const u of o.photo_urls) {
        if (u && typeof u === 'string') urls.push(u);
      }
    }
    // dédoublonnage simple
    return Array.from(new Set(urls));
  };

  const formatPriceDisplay = (price?: string | null) => {
    if (!price) return '';
    const p = String(price).trim();
    if (!p) return '';
    if (p.includes('€')) return p;
    return `${p} €`;
  };

  const parsePriceToNumber = (price?: string | null) => {
    if (!price) return null;
    // Ex: "120€/nuit", "1 200,50 €", "120.5"
    const cleaned = price
      .replace(/\s/g, '')
      .replace(/€/g, '')
      .replace(/[^0-9,.-]/g, '');
    // si virgule et point, on garde le point comme milliers => on supprime les points
    const hasComma = cleaned.includes(',');
    const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const selectedCategoryName = categories.find((c) => c.id === selectedCategory)?.name;
  const isAccommodationCategory = (() => {
    const n = (selectedCategoryName || '').toLowerCase().trim();
    if (!n) return false;
    // compat: anciennes valeurs éventuelles + accents
    return (
      n === 'accommodation' ||
      n === 'hebergement' ||
      n === 'hébergement' ||
      n.includes('heberg') ||
      n.includes('héberg')
    );
  })();

  const computeAccommodationPrices = (
    priceText: string,
    participants: number,
    nights: number
  ): { total: number; perPerson: number; perPersonPerNight: number } | null => {
    const base = parsePriceToNumber(priceText);
    if (!base) return null;
    const p = Math.max(1, participants);
    const n = Math.max(1, nights);

    // IMPORTANT: règle produit (confirmée): le prix saisi est TOUJOURS le prix TOTAL du séjour
    // (toutes nuits + toutes personnes). On calcule donc seulement des répartitions.
    const total = base;
    const perPerson = total / p;
    const perPersonPerNight = total / p / n;
    return { total, perPerson, perPersonPerNight };
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
                {canEditOption(currentSwipeOption) && (
                  <button
                    type="button"
                    className="absolute top-3 left-3 z-30 w-10 h-10 rounded-full bg-white/90 text-dark-gray shadow-soft flex items-center justify-center"
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => setEditingOption(currentSwipeOption)}
                    aria-label="Modifier"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
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

                {/* Photos (carousel) */}
                {(() => {
                  const imgs = getOptionImages(currentSwipeOption);
                  const current = imgs[swipePhotoIndex] || imgs[0] || null;
                  if (!current) {
                    return (
                      <div className="w-full aspect-[4/3] bg-cream flex items-center justify-center">
                        <p className="text-sm text-dark-gray/70 font-body">Aucune image</p>
                      </div>
                    );
                  }

                  return (
                    <div
                      className="relative w-full aspect-[4/3] bg-cream"
                    >
                      {!swipePhotoFailed ? (
                        <SmartImage
                          src={current}
                          alt={currentSwipeOption.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onFinalError={() => setSwipePhotoFailed(true)}
                          onRecovered={(cachedUrl) => {
                            // On ne “répare” que si l’utilisateur a le droit d’éditer (auteur / editor)
                            if (canEditOption(currentSwipeOption)) {
                              repairOptionPrimaryImage(currentSwipeOption.id, cachedUrl);
                            }
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center px-4 text-center">
                          <p className="text-sm text-dark-gray/70 font-body break-words">
                            Impossible de charger l’image. Ajoute des captures d’écran dans “Photos”.
                          </p>
                        </div>
                      )}

                      {imgs.length > 1 && (
                        <>
                          <div className="absolute bottom-2 left-2 z-10 px-2 py-1 rounded-full bg-black/40 text-white text-xs font-heading font-semibold pointer-events-none">
                            {swipePhotoIndex + 1}/{imgs.length}
                          </div>

                          {/* Zones tap/clic (gauche/droite) pour défiler, plus fiables que click/touchend sur mobile */}
                          <button
                            type="button"
                            className="absolute inset-y-0 left-0 w-1/2 bg-transparent"
                            aria-label="Photo précédente (taper à gauche)"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => {
                              e.stopPropagation();
                              setSwipePhotoFailed(false);
                              setSwipePhotoIndex((i) => Math.max(0, i - 1));
                            }}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 w-1/2 bg-transparent"
                            aria-label="Photo suivante (taper à droite)"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => {
                              e.stopPropagation();
                              setSwipePhotoFailed(false);
                              setSwipePhotoIndex((i) => Math.min(imgs.length - 1, i + 1));
                            }}
                          />
                          <button
                            type="button"
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white text-lg flex items-center justify-center"
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                              setSwipePhotoFailed(false);
                              setSwipePhotoIndex((i) => Math.max(0, i - 1));
                            }}
                            onClick={() => {
                              setSwipePhotoFailed(false);
                              setSwipePhotoIndex((i) => Math.max(0, i - 1));
                            }}
                            aria-label="Photo précédente"
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white text-lg flex items-center justify-center"
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                              setSwipePhotoFailed(false);
                              setSwipePhotoIndex((i) => Math.min(imgs.length - 1, i + 1));
                            }}
                            onClick={() => {
                              setSwipePhotoFailed(false);
                              setSwipePhotoIndex((i) => Math.min(imgs.length - 1, i + 1));
                            }}
                            aria-label="Photo suivante"
                          >
                            ›
                          </button>

                          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
                            {imgs.map((_, i) => (
                              <span
                                key={i}
                                className={`w-2 h-2 rounded-full ${i === swipePhotoIndex ? 'bg-white' : 'bg-white/40'}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-heading font-bold text-dark-gray break-words">
                    {currentSwipeOption.title}
                  </h3>

                  {(currentSwipeOption.address || currentSwipeOption.price) && (
                    <div className="mt-2 space-y-1">
                      {currentSwipeOption.address && (
                        <p className="text-dark-gray/70 text-sm font-body break-words">
                          {currentSwipeOption.address}
                        </p>
                      )}
                      {currentSwipeOption.price && (
                        <p className="text-dark-gray/80 text-sm font-body font-semibold break-words">
                          {formatPriceDisplay(currentSwipeOption.price)}
                          {selectedCategoryName === 'activity' ? ' / pers' : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {isAccommodationCategory && currentSwipeOption.price && (
                    (() => {
                      const computed = computeAccommodationPrices(
                        currentSwipeOption.price,
                        tripParticipantsCount,
                        tripNights
                      );
                      if (!computed) return null;
                      return (
                        <div className="mt-3 rounded-xl bg-cream border border-cream p-3">
                          <div className="text-xs text-dark-gray/70 font-body">
                            {tripParticipantsCount} pers • {tripNights} nuits
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-2">
                            <div>
                              <div className="text-[11px] text-dark-gray/70">Total</div>
                              <div className="text-sm font-heading font-bold tabular-nums">{computed.total.toFixed(2)} €</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-dark-gray/70">/ pers</div>
                              <div className="text-sm font-heading font-bold tabular-nums">{computed.perPerson.toFixed(2)} €</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-dark-gray/70">/ pers / nuit</div>
                              <div className="text-sm font-heading font-bold tabular-nums">{computed.perPersonPerNight.toFixed(2)} €</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}

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
            const primaryImg = getOptionPrimaryImage(option);
            const imgs = getOptionImages(option);
            return (
              <div key={option.id} className="bg-white rounded-2xl shadow-sm overflow-hidden relative">
                {primaryImg ? (
                  <div className="w-full aspect-[16/9] bg-cream">
                    <VoteOptionImage src={primaryImg} alt={option.title} />
                  </div>
                ) : null}
                <div className="p-4">
                  {canEditOption(option) && (
                    <button
                      type="button"
                      className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 text-dark-gray shadow-soft flex items-center justify-center"
                      onClick={() => setEditingOption(option)}
                      aria-label="Modifier"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {imgs.length > 1 && (
                    <div className="mb-3">
                      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {imgs.map((u, idx) => (
                          <button
                            key={`${u}-${idx}`}
                            type="button"
                            onClick={() => setGallery({ option, index: idx })}
                            className="shrink-0"
                            aria-label={`Voir photo ${idx + 1}`}
                            title="Ouvrir la galerie"
                          >
                            <SmartImage
                              src={u}
                              alt={`Photo ${idx + 1}`}
                              className="w-16 h-16 object-cover rounded-lg border border-cream"
                              fallback={<div className="w-16 h-16 rounded-lg border border-cream bg-cream" />}
                            />
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-dark-gray/60 font-body">Tap sur une photo pour ouvrir la galerie.</p>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading font-bold text-dark-gray break-words">{option.title}</h3>
                      {(option.address || option.price) && (
                        <div className="mt-1 space-y-1">
                          {option.address && (
                            <p className="text-sm text-dark-gray/70 break-words">{option.address}</p>
                          )}
                          {option.price && (
                            <p className="text-sm text-dark-gray/80 font-semibold break-words">
                              {formatPriceDisplay(option.price)}
                              {selectedCategoryName === 'activity' ? ' / pers' : ''}
                            </p>
                          )}
                        </div>
                      )}
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
            const primaryImg = getOptionPrimaryImage(option);
            const imgs = getOptionImages(option);

            return (
              <div key={option.id} className="bg-white rounded-lg shadow-sm p-6 relative">
                {canEditOption(option) && (
                  <button
                    type="button"
                    className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 text-dark-gray shadow-soft flex items-center justify-center"
                    onClick={() => setEditingOption(option)}
                    aria-label="Modifier"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {primaryImg && (
                  <VoteOptionImage src={primaryImg} alt={option.title} />
                )}
                {imgs.length > 1 && (
                  <div className="mb-4 -mt-2">
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {imgs.map((u, idx) => (
                        <button
                          key={`${u}-${idx}`}
                          type="button"
                          onClick={() => setGallery({ option, index: idx })}
                          className="shrink-0"
                          aria-label={`Voir photo ${idx + 1}`}
                          title="Ouvrir la galerie"
                        >
                          <SmartImage
                            src={u}
                            alt={`Photo ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-cream"
                            fallback={<div className="w-16 h-16 rounded-lg border border-cream bg-cream" />}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {option.title}
                </h3>

                {(option.address || option.price) && (
                  <div className="mb-3 space-y-1">
                    {option.address && <p className="text-gray-600 text-sm break-words">{option.address}</p>}
                    {option.price && (
                      <p className="text-gray-800 text-sm font-semibold break-words">
                        {formatPriceDisplay(option.price)}
                        {selectedCategoryName === 'activity' ? ' / pers' : ''}
                      </p>
                    )}
                  </div>
                )}

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
          tripId={tripId}
          categoryId={selectedCategory}
          categoryName={categories.find(c => c.id === selectedCategory)?.name}
          categoryTitle={categories.find(c => c.id === selectedCategory)?.title}
          latitude={tripLocation?.lat}
          longitude={tripLocation?.lng}
          existingOptions={options}
          onClose={() => setShowAddOption(false)}
          onSuccess={() => {
            setShowAddOption(false);
            if (selectedCategory) {
              loadOptions(selectedCategory);
            }
          }}
        />
      )}

      {editingOption && (
        <EditOptionModal
          tripId={tripId}
          option={editingOption}
          onClose={() => setEditingOption(null)}
          onSuccess={() => {
            setEditingOption(null);
            if (selectedCategory) loadOptions(selectedCategory);
          }}
        />
      )}

      {gallery && (
        <PhotoGalleryModal
          title={gallery.option.title}
          images={getOptionImages(gallery.option)}
          index={gallery.index}
          onClose={() => setGallery(null)}
          onChange={(next) => setGallery((g) => (g ? { ...g, index: next } : g))}
        />
      )}
    </div>
  );
}

function PhotoGalleryModal({
  title,
  images,
  index,
  onClose,
  onChange
}: {
  title: string;
  images: string[];
  index: number;
  onClose: () => void;
  onChange: (idx: number) => void;
}) {
  const safeImages = Array.isArray(images) ? images.filter(Boolean) : [];
  const i = Math.max(0, Math.min(index, Math.max(0, safeImages.length - 1)));
  const current = safeImages[i];

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-medium w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-cream">
          <div className="min-w-0">
            <p className="font-heading font-bold text-dark-gray truncate">{title}</p>
            <p className="text-xs text-dark-gray/60 font-body">
              {safeImages.length > 0 ? `${i + 1}/${safeImages.length}` : '—'}
            </p>
          </div>
          <button
            type="button"
            className="w-10 h-10 rounded-full bg-cream text-dark-gray flex items-center justify-center"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="relative bg-black">
          {current ? (
            <SmartImage
              src={current}
              alt={title}
              className="w-full h-[60vh] object-contain"
              fallback={
                <div className="w-full h-[40vh] flex items-center justify-center bg-black text-white/70">
                  Impossible de charger l’image
                </div>
              }
            />
          ) : (
            <div className="w-full h-[40vh] flex items-center justify-center bg-black text-white/70">
              Aucune image
            </div>
          )}

          {safeImages.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 text-white text-xl"
                onClick={() => onChange(Math.max(0, i - 1))}
                aria-label="Précédente"
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 text-white text-xl"
                onClick={() => onChange(Math.min(safeImages.length - 1, i + 1))}
                aria-label="Suivante"
              >
                ›
              </button>
            </>
          )}
        </div>

        {safeImages.length > 1 && (
          <div className="p-3 border-t border-cream overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-2">
              {safeImages.map((u, idx) => (
                <button
                  key={`${u}-${idx}`}
                  type="button"
                  className={`shrink-0 rounded-lg overflow-hidden border ${idx === i ? 'border-turquoise' : 'border-cream'}`}
                  onClick={() => onChange(idx)}
                  aria-label={`Voir photo ${idx + 1}`}
                >
                  <SmartImage
                    src={u}
                    alt={`Miniature ${idx + 1}`}
                    className="w-16 h-16 object-cover"
                    fallback={<div className="w-16 h-16 bg-black/20" />}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface AddOptionModalProps {
  tripId: string;
  categoryId: string;
  categoryName?: string;
  categoryTitle?: string;
  latitude?: number;
  longitude?: number;
  existingOptions?: VoteOption[];
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

function AddOptionModal({ tripId, categoryId, categoryName, categoryTitle, latitude, longitude, existingOptions, onClose, onSuccess }: AddOptionModalProps) {
  const { user } = useAuth();
  const copy = getCategoryCopy(categoryName, categoryTitle);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const isAccommodation = categoryName === 'accommodation';

  const normalize = (s?: string | null) => (s || '').trim().toLowerCase();

  const isDuplicate = () => {
    const t = normalize(title);
    const l = normalize(link);
    const list = Array.isArray(existingOptions) ? existingOptions : [];
    return list.some((o) => {
      const ot = normalize(o.title);
      const ol = normalize(o.link || '');
      if (t && ot === t) return true;
      if (l && ol && ol === l) return true;
      return false;
    });
  };

  const safeRandomId = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c: any = globalThis.crypto;
      if (c?.randomUUID) return c.randomUUID();
    } catch {
      // ignore
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (!user) throw new Error('Utilisateur non authentifié');
    if (photoFiles.length === 0) return [];

    const bucket = supabase.storage.from('vote-option-photos');
    const urls: string[] = [];

    for (const file of photoFiles) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `trips/${tripId}/categories/${categoryId}/users/${user.id}/${safeRandomId()}.${ext}`;
      const { error: upErr } = await bucket.upload(path, file, {
        upsert: false,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600'
      });
      if (upErr) throw new Error(upErr.message || 'Erreur upload photo');
      const { data } = bucket.getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  };

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
          // Tenter de copier l’image distante en Storage (URL stable) pour éviter les liens expirés
          try {
            const cached = await fetch(`/api/cache-image?url=${encodeURIComponent(data.image)}`).then((r) => r.json());
            if (cached?.publicUrl) setImageUrl(cached.publicUrl);
          } catch {
            // ignore
          }
        }
        // Activités: tenter d'extraire un tarif / pers depuis le texte si disponible
        if (categoryName === 'activity' && !price) {
          const p = extractEuroAmount(data?.description) || extractEuroAmount(data?.title);
          if (p) setPrice(p);
        }
        if (!data.image && !data.description && !data.title) {
          setPreviewError(
            categoryName === 'accommodation'
              ? 'Photos indisponibles pour ce lien. Ajoute des captures d’écran via “Photos”.'
              : 'Aucune métadonnée trouvée pour ce lien.'
          );
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
    setWarning('');

    if (isDuplicate()) {
      setWarning('Option déjà existante (même titre ou même lien).');
      return;
    }

    setLoading(true);

    try {
      const uploadedUrls = await uploadPhotos();
      const primaryFromUploads = uploadedUrls[0] || null;
      const finalImageUrl = imageUrl || primaryFromUploads || null;

      const { error: insertError } = await supabase.rpc('add_vote_option', {
        p_category_id: categoryId,
        p_title: title,
        p_description: description || null,
        p_link: link || null,
        p_image_url: finalImageUrl,
        p_address: address || null,
        p_price: price || null,
        p_photo_urls: uploadedUrls.length > 0 ? uploadedUrls : null
      });

      if (insertError) {
        console.error('Erreur ajout option vote (RPC):', insertError);
        // fallback si RPC non déployé
        const { error: fallbackErr } = await supabase.from('vote_options').insert({
          category_id: categoryId,
          title,
          description: description || null,
          link: link || null,
          image_url: finalImageUrl,
          address: address || null,
          price: price || null,
          photo_urls: uploadedUrls,
          added_by: user!.id
        });

        if (fallbackErr) {
          console.error('Erreur ajout option vote (fallback):', fallbackErr);
          setError(fallbackErr.message || insertError.message || "Erreur lors de l'ajout de l'option");
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      onSuccess();
    } catch (e: any) {
      console.error('Erreur ajout option vote (upload/submit):', e);
      setError(e?.message || "Erreur lors de l'ajout de l'option");
      setLoading(false);
    }
  };

  // Bloque le scroll du body quand la modale est ouverte
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Cleanup des previews blob
  useEffect(() => {
    return () => {
      photoPreviews.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
    };
  }, [photoPreviews]);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-medium max-w-md w-full p-6 sm:p-8 max-h-[85svh] flex flex-col min-h-0 modal-content">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {copy.modalTitle}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div
            className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            {warning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
                {warning}
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
                    if (!address) setAddress(p.address);
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

            {isAccommodation && (
              <div className="bg-cream border border-cream rounded-lg p-3 text-dark-gray/80 text-sm font-body">
                <p className="font-semibold mb-1">Info (photos & descriptions)</p>
                <p>
                  À cause des politiques de confidentialité de Booking/Airbnb et autres plateformes, il n’est pas toujours possible
                  de récupérer automatiquement les photos et descriptions. Si besoin, ajoute des <span className="font-semibold">captures d’écran</span>{' '}
                  via le champ “Photos”.
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
              Adresse (optionnel)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={isAccommodation ? 'Ex: 12 rue ..., Paris' : 'Ex: Adresse / quartier'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {categoryName === 'activity' ? 'Tarif / personne (optionnel)' : 'Prix (optionnel)'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pr-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={
                  categoryName === 'activity'
                    ? 'Ex: 25 (par personne)'
                    : isAccommodation
                      ? 'Ex: 1200 (prix total du séjour)'
                      : 'Ex: 25'
                }
                inputMode="decimal"
              />
              <div className="absolute inset-y-0 right-3 flex items-center text-gray-500 font-semibold pointer-events-none">
                €
              </div>
            </div>
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
                {previewLoading ? 'Vérification...' : 'Vérifier si des photos sont dispo'}
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
                  <SmartImage
                    src={imageUrl}
                    alt="Aperçu"
                    className="w-full h-40 object-cover rounded-xl border border-gray-200"
                    onFinalError={() => setImagePreviewError(true)}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos (captures) (optionnel)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setPhotoFiles(files);

                const urls = files.map((f) => URL.createObjectURL(f));
                photoPreviews.forEach((u) => {
                  try {
                    URL.revokeObjectURL(u);
                  } catch {
                    // ignore
                  }
                });
                setPhotoPreviews(urls);
              }}
              className="w-full text-sm"
            />

            {photoPreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {photoPreviews.map((u, idx) => (
                  <div key={u} className="relative">
                    <img
                      src={u}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextFiles = photoFiles.filter((_, i) => i !== idx);
                        const nextPreviews = photoPreviews.filter((_, i) => i !== idx);
                        try {
                          URL.revokeObjectURL(photoPreviews[idx]);
                        } catch {
                          // ignore
                        }
                        setPhotoFiles(nextFiles);
                        setPhotoPreviews(nextPreviews);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                      aria-label="Supprimer la photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-2 text-xs text-gray-500">
              Tu peux ajouter plusieurs images. Elles seront utilisées comme aperçu si aucune URL d’image n’est fournie.
            </p>
          </div>

          </div>

          <div className="sticky bottom-0 bg-white pt-4 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="flex justify-end space-x-4">
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
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditOptionModalProps {
  tripId: string;
  option: VoteOption;
  onClose: () => void;
  onSuccess: () => void;
}

function EditOptionModal({ tripId, option, onClose, onSuccess }: EditOptionModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(option.title || '');
  const [description, setDescription] = useState(option.description || '');
  const [address, setAddress] = useState(option.address || '');
  const [price, setPrice] = useState(option.price || '');
  const [link, setLink] = useState(option.link || '');
  const [imageUrl, setImageUrl] = useState(option.image_url || '');

  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>(
    Array.isArray(option.photo_urls) ? option.photo_urls.filter(Boolean) : []
  );
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const safeRandomId = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c: any = globalThis.crypto;
      if (c?.randomUUID) return c.randomUUID();
    } catch {
      // ignore
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (!user) throw new Error('Utilisateur non authentifié');
    if (photoFiles.length === 0) return [];

    const bucket = supabase.storage.from('vote-option-photos');
    const urls: string[] = [];

    for (const file of photoFiles) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `trips/${tripId}/vote-options/${option.id}/${user.id}/${safeRandomId()}.${ext}`;
      const { error: upErr } = await bucket.upload(path, file, {
        upsert: false,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600'
      });
      if (upErr) throw new Error(upErr.message || 'Erreur upload photo');
      const { data } = bucket.getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  };

  const extractStoragePath = (publicUrl: string) => {
    // Ex: https://<project>.supabase.co/storage/v1/object/public/vote-option-photos/<path>
    const marker = '/storage/v1/object/public/vote-option-photos/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  };

  const deleteOption = async () => {
    if (!confirm('Supprimer cette option ? Cette action est définitive.')) return;
    setError('');
    setLoading(true);

    try {
      // Best-effort: supprimer les fichiers Storage référencés
      const bucket = supabase.storage.from('vote-option-photos');
      const toRemove = (Array.isArray(existingPhotoUrls) ? existingPhotoUrls : [])
        .map((u) => (u ? extractStoragePath(u) : null))
        .filter((p): p is string => Boolean(p));
      if (toRemove.length > 0) {
        await bucket.remove(toRemove).catch(() => {});
      }

      const { error: delErr } = await supabase.rpc('delete_vote_option', { p_option_id: option.id });
      if (delErr) {
        console.error('Erreur suppression option vote (RPC):', delErr);
        // fallback direct (peut être bloqué par RLS)
        const { error: fbErr } = await supabase.from('vote_options').delete().eq('id', option.id);
        if (fbErr) {
          setError(fbErr.message || delErr.message || 'Erreur lors de la suppression');
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la suppression');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const uploaded = await uploadPhotos();
      const mergedPhotoUrls = [...existingPhotoUrls, ...uploaded];
      const finalImageUrl = imageUrl || mergedPhotoUrls[0] || null;

      const { error: updErr } = await supabase.rpc('update_vote_option', {
        p_option_id: option.id,
        p_title: title,
        p_description: description || null,
        p_link: link || null,
        p_image_url: finalImageUrl,
        p_address: address || null,
        p_price: price || null,
        p_photo_urls: mergedPhotoUrls
      });

      if (updErr) {
        console.error('Erreur update option vote (RPC):', updErr);
        // fallback direct (peut être bloqué par RLS)
        const { error: fbErr } = await supabase
          .from('vote_options')
          .update({
            title,
            description: description || null,
            link: link || null,
            image_url: finalImageUrl,
            address: address || null,
            price: price || null,
            photo_urls: mergedPhotoUrls
          })
          .eq('id', option.id);
        if (fbErr) {
          setError(fbErr.message || updErr.message || 'Erreur lors de la mise à jour');
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la mise à jour');
      setLoading(false);
    }
  };

  // Bloque le scroll du body quand la modale est ouverte
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Cleanup previews
  useEffect(() => {
    return () => {
      photoPreviews.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
    };
  }, [photoPreviews]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-medium max-w-md w-full p-6 sm:p-8 max-h-[85svh] flex flex-col min-h-0 modal-content">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Modifier l’option</h2>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Titre *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Adresse (optionnel)</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Prix (optionnel)</label>
              <div className="relative">
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pr-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  inputMode="decimal"
                />
                <div className="absolute inset-y-0 right-3 flex items-center text-gray-500 font-semibold pointer-events-none">
                  €
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (optionnel)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lien (optionnel)</label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Image principale (URL) (optionnel)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://.../photo.jpg"
              />
            </div>

            {existingPhotoUrls.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photos actuelles</label>
                <div className="grid grid-cols-3 gap-2">
                  {existingPhotoUrls.map((u, idx) => (
                    <div key={`${u}-${idx}`} className="relative">
                      <SmartImage
                        src={u}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-20 object-cover rounded-lg border border-gray-200"
                        fallback={<div className="w-full h-20 rounded-lg border border-gray-200 bg-cream" />}
                      />
                      <button
                        type="button"
                        onClick={() => setExistingPhotoUrls((arr) => arr.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                        aria-label="Supprimer la photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ajouter des photos (optionnel)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setPhotoFiles(files);
                  const urls = files.map((f) => URL.createObjectURL(f));
                  photoPreviews.forEach((u) => {
                    try {
                      URL.revokeObjectURL(u);
                    } catch {
                      // ignore
                    }
                  });
                  setPhotoPreviews(urls);
                }}
                className="w-full text-sm"
              />
              {photoPreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {photoPreviews.map((u, idx) => (
                    <SmartImage
                      src={u}
                      alt={`Nouveau ${idx + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-gray-200"
                      fallback={<div className="w-full h-20 rounded-lg border border-gray-200 bg-cream" />}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 bg-white pt-4 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={deleteOption}
                disabled={loading}
                className="px-6 py-2 text-burnt-orange font-semibold rounded-lg hover:bg-burnt-orange/10 transition-colors disabled:opacity-50"
              >
                Supprimer
              </button>
              <button type="button" onClick={onClose} className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium">
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
