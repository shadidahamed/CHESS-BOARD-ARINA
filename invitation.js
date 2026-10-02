// invitation.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, GAME_CONFIG } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function createPrivateGame(hostId, settings = {}) {
  const { data: game, error } = await supabase
    .from('games')
    .insert({
      game_type: settings.fourPlayer ? 'private_4p' : 'private_1v1',
      host_id: hostId,
      status: 'lobby',
      time_control: settings.initial || 300,
      increment: settings.increment || 0,
      settings
    })
    .select()
    .single();
  if (error) throw error;

  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = new Date(Date.now() + GAME_CONFIG.invitationExpiryHours * 3600 * 1000);

  await supabase.from('invitations').insert({
    game_id: game.id,
    created_by: hostId,
    token,
    max_players: settings.fourPlayer ? 4 : 2,
    expires_at: expires.toISOString()
  });

  // host seat
  await supabase.from('game_players').insert({
    game_id: game.id,
    user_id: hostId,
    seat: 0,
    color: settings.fourPlayer ? 'red' : 'white',
    remaining_time: settings.initial || 300
  });

  const link = `${location.origin}${location.pathname}?game=${game.id}&invite=${token}`;
  return { game, token, link };
}

export async function joinByInvite(token, userId) {
  const { data: inv, error } = await supabase
    .from('invitations')
    .select('*, games(*)')
    .eq('token', token)
    .eq('status', 'active')
    .single();
  if (error || !inv) throw new Error('Invalid or expired invitation.');
  if (new Date(inv.expires_at) < new Date()) throw new Error('Invitation expired.');

  const { count } = await supabase
    .from('game_players')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', inv.game_id);

  if (count >= inv.max_players) throw new Error('This game is full.');

  // prevent double join
  const { data: existing } = await supabase
    .from('game_players')
    .select('id')
    .eq('game_id', inv.game_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return inv.games; // already in

  const seat = count;
  const colors1v1 = ['white', 'black'];
  const colors4p = ['red', 'blue', 'yellow', 'green'];
  const color = inv.max_players === 4 ? colors4p[seat] : colors1v1[seat];

  await supabase.from('game_players').insert({
    game_id: inv.game_id,
    user_id: userId,
    seat,
    color,
    remaining_time: inv.games.time_control
  });

  return inv.games;
}
