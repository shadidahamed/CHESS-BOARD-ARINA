// realtime.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function subscribeToGame(gameId, handlers = {}) {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: `id=eq.${gameId}`
    }, payload => handlers.onGame && handlers.onGame(payload))
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_players',
      filter: `game_id=eq.${gameId}`
    }, payload => handlers.onPlayers && handlers.onPlayers(payload))
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'moves',
      filter: `game_id=eq.${gameId}`
    }, payload => handlers.onMove && handlers.onMove(payload.new))
    .subscribe();

  return () => supabase.removeChannel(channel);
}
