import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type NotificationRow = {
  id: string;
  trip_id: string;
  actor_id: string | null;
  event_type: string;
  payload: any;
  created_at: string;
};

interface TripNotificationsProps {
  tripId: string;
}

function formatMessage(n: NotificationRow) {
  const p = n.payload || {};
  switch (n.event_type) {
    case 'stage_created':
      return `Nouvelle activité/étape ajoutée: ${p.name || '—'}`;
    case 'stage_updated':
      return `Activité/étape modifiée: ${p.name || '—'}`;
    case 'stage_deleted':
      return `Activité/étape supprimée: ${p.name || '—'}`;
    case 'vote_category_created':
      return `Nouvelle catégorie de vote: ${p.title || '—'}`;
    case 'vote_option_created':
      return `Nouvelle option de vote: ${p.title || '—'}`;
    case 'expense_created':
      return `Nouvelle dépense: ${p.description || '—'}`;
    case 'expense_updated':
      return `Dépense modifiée: ${p.description || '—'}`;
    case 'expense_deleted':
      return `Dépense supprimée: ${p.description || '—'}`;
    case 'checklist_created':
      return `Checklist: nouvel élément "${p.item || '—'}"`;
    case 'checklist_updated':
      return `Checklist: "${p.item || '—'}" ${p.is_completed ? 'complété' : 'mis à jour'}`;
    case 'checklist_deleted':
      return `Checklist: élément supprimé "${p.item || '—'}"`;
    default:
      return `Mise à jour: ${n.event_type}`;
  }
}

export function TripNotifications({ tripId }: TripNotificationsProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!tripId) return;

    const clear = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    const channel = supabase
      .channel(`trip-notifications:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `trip_id=eq.${tripId}`
        },
        (payload) => {
          const n = payload.new as NotificationRow;
          // Ne pas notifier l'utilisateur qui a fait l'action
          if (n.actor_id && user?.id && n.actor_id === user.id) return;

          clear();
          setMessage(formatMessage(n));
          timerRef.current = window.setTimeout(() => setMessage(null), 5000);
        }
      )
      .subscribe();

    return () => {
      clear();
      supabase.removeChannel(channel);
    };
  }, [tripId, user?.id]);

  if (!message) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-24px)] max-w-md">
      <div className="bg-white border border-turquoise/30 shadow-medium rounded-2xl px-4 py-3">
        <p className="text-sm text-dark-gray font-body break-words">{message}</p>
      </div>
    </div>
  );
}

