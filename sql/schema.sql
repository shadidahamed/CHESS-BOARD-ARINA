CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (char_length(username) BETWEEN 3 AND 24),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 1200,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  four_player_wins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL CHECK (game_type IN ('ai','private_1v1','private_4p')),
  variant TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby','waiting','ready','running','finished','aborted','expired')),
  host_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  current_turn TEXT,
  move_number INTEGER NOT NULL DEFAULT 0,
  position_state JSONB NOT NULL DEFAULT '{}',
  winner UUID REFERENCES public.profiles(id),
  result TEXT,
  time_control INTEGER NOT NULL DEFAULT 300,
  increment INTEGER NOT NULL DEFAULT 0,
  last_move_at TIMESTAMPTZ,
  game_version INTEGER NOT NULL DEFAULT 1,
  finalized BOOLEAN NOT NULL DEFAULT false,
  settings JSONB DEFAULT '{}'
);

CREATE TABLE public.game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  seat INTEGER NOT NULL,
  color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'joined',
  remaining_time NUMERIC(12,3) NOT NULL DEFAULT 300,
  points INTEGER NOT NULL DEFAULT 0,
  result TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now(),
  UNIQUE(game_id, user_id),
  UNIQUE(game_id, seat)
);

CREATE TABLE public.moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  player_id UUID NOT NULL REFERENCES public.profiles(id),
  from_square TEXT NOT NULL,
  to_square TEXT NOT NULL,
  promotion TEXT,
  notation TEXT NOT NULL,
  position_after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, move_number)
);

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  token TEXT UNIQUE NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 2,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','accepted','expired','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.player_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  result TEXT NOT NULL,
  points_delta INTEGER NOT NULL DEFAULT 0,
  rating_delta INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_id)
);

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'player_' || substr(NEW.id::text,1,8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Player')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "games_select" ON public.games FOR SELECT USING (
  host_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.game_players gp WHERE gp.game_id = id AND gp.user_id = auth.uid()
  )
);
CREATE POLICY "games_insert" ON public.games FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "games_update" ON public.games FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.game_id = id AND gp.user_id = auth.uid())
);

CREATE POLICY "gp_select" ON public.game_players FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_players gp2 WHERE gp2.game_id = game_id AND gp2.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.host_id = auth.uid())
);
CREATE POLICY "gp_insert" ON public.game_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gp_update" ON public.game_players FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "moves_select" ON public.moves FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.game_id = game_id AND gp.user_id = auth.uid())
);
CREATE POLICY "moves_insert" ON public.moves FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "inv_select" ON public.invitations FOR SELECT USING (true);
CREATE POLICY "inv_insert" ON public.invitations FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "inv_update" ON public.invitations FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "stats_select" ON public.player_statistics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stats_insert" ON public.player_statistics FOR INSERT WITH CHECK (auth.uid() = user_id);
