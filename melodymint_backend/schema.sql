-- MelodyMint schema — plain SQL DDL (no ORM).
-- Idempotent: safe to run on every server startup.

CREATE TABLE IF NOT EXISTS user_account (
    user_id       SERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'listener'
                  CHECK (role IN ('listener', 'artist', 'admin')),
    is_banned     BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS wallet (
    wallet_id     SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL UNIQUE
                  REFERENCES user_account(user_id) ON DELETE CASCADE,
    token_balance INTEGER NOT NULL DEFAULT 0 CHECK (token_balance >= 0)
);

CREATE TABLE IF NOT EXISTS transaction (
    txn_id        SERIAL PRIMARY KEY,
    from_user_id  INTEGER NOT NULL
                  REFERENCES user_account(user_id) ON DELETE RESTRICT,
    to_user_id    INTEGER NOT NULL
                  REFERENCES user_account(user_id) ON DELETE RESTRICT,
    amount        INTEGER NOT NULL CHECK (amount > 0),
    txn_type      VARCHAR(20) NOT NULL
                  CHECK (txn_type IN ('buy', 'gift', 'spend', 'earn')),
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS song (
    song_id        SERIAL PRIMARY KEY,
    owner_id       INTEGER NOT NULL
                   REFERENCES user_account(user_id) ON DELETE RESTRICT,
    title          VARCHAR(150) NOT NULL,
    artist_name    VARCHAR(100) NOT NULL,
    duration_sec   INTEGER NOT NULL CHECK (duration_sec >= 0),
    audio_filename VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS tag (
    tag_id       SERIAL PRIMARY KEY,
    tag_name     VARCHAR(50) NOT NULL UNIQUE,
    tag_category VARCHAR(30) NOT NULL
                 CHECK (tag_category IN ('genre', 'mood', 'context'))
);

-- Junction table: many-to-many between song and tag, with extra vote
-- bookkeeping attached to each pairing.
CREATE TABLE IF NOT EXISTS song_tag (
    song_tag_id   SERIAL PRIMARY KEY,
    song_id       INTEGER NOT NULL
                  REFERENCES song(song_id) ON DELETE CASCADE,
    tag_id        INTEGER NOT NULL
                  REFERENCES tag(tag_id) ON DELETE CASCADE,
    suggested_by  INTEGER NOT NULL
                  REFERENCES user_account(user_id) ON DELETE RESTRICT,
    upvotes       INTEGER NOT NULL DEFAULT 0,
    downvotes     INTEGER NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'removed')),
    UNIQUE (song_id, tag_id)
);

CREATE TABLE IF NOT EXISTS tag_vote (
    vote_id       SERIAL PRIMARY KEY,
    song_tag_id   INTEGER NOT NULL
                  REFERENCES song_tag(song_tag_id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL
                  REFERENCES user_account(user_id) ON DELETE CASCADE,
    value         SMALLINT NOT NULL CHECK (value IN (1, -1)),
    UNIQUE (song_tag_id, user_id)
);

CREATE TABLE IF NOT EXISTS playlist (
    playlist_id   SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL
                  REFERENCES user_account(user_id) ON DELETE CASCADE,
    playlist_name VARCHAR(100) NOT NULL,
    visibility    VARCHAR(20) NOT NULL DEFAULT 'private'
                  CHECK (visibility IN ('private', 'public'))
);

-- Junction table: many-to-many between playlist and song, composite PK.
CREATE TABLE IF NOT EXISTS playlist_song (
    playlist_id   INTEGER NOT NULL
                  REFERENCES playlist(playlist_id) ON DELETE CASCADE,
    song_id       INTEGER NOT NULL
                  REFERENCES song(song_id) ON DELETE CASCADE,
    position      INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, song_id)
);

CREATE TABLE IF NOT EXISTS listening_history (
    history_id    SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL
                  REFERENCES user_account(user_id) ON DELETE CASCADE,
    song_id       INTEGER NOT NULL
                  REFERENCES song(song_id) ON DELETE CASCADE,
    listened_sec  INTEGER NOT NULL CHECK (listened_sec >= 0),
    played_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playback_settings (
    user_id  INTEGER PRIMARY KEY
             REFERENCES user_account(user_id) ON DELETE CASCADE,
    volume   INTEGER NOT NULL DEFAULT 80 CHECK (volume BETWEEN 0 AND 100),
    shuffle  BOOLEAN NOT NULL DEFAULT FALSE,
    loop     BOOLEAN NOT NULL DEFAULT FALSE
);

-- ================================================================
-- PL/pgSQL — real database-side functions, triggers, and a
-- procedure. This is where the "business rules" from the course's
-- PL/SQL requirement actually live (not in Python).
-- ================================================================

-- FUNCTION 1: recompute a song_tag's vote counts, called automatically
-- every time someone votes. Also rewards the person who suggested the
-- tag once it earns 5 net upvotes (10 tokens), and flags a tag as
-- "removed" if it gets heavily downvoted.
CREATE OR REPLACE FUNCTION fn_sync_song_tag_votes() RETURNS TRIGGER AS $$
DECLARE
    v_song_tag   song_tag%ROWTYPE;
    v_up         INTEGER;
    v_down       INTEGER;
    v_net        INTEGER;
    v_new_status VARCHAR(20);
BEGIN
    -- count all the up/down votes for this tag right now
    SELECT COUNT(*) FILTER (WHERE value = 1), COUNT(*) FILTER (WHERE value = -1)
      INTO v_up, v_down
      FROM tag_vote
      WHERE song_tag_id = NEW.song_tag_id;

    SELECT * INTO v_song_tag FROM song_tag WHERE song_tag_id = NEW.song_tag_id;

    -- decide if this tag should flip to "removed"
    v_new_status := v_song_tag.status;
    IF v_down >= 2 * GREATEST(v_up, 1) AND v_down > v_up THEN
        v_new_status := 'removed';
    ELSIF v_new_status != 'removed' THEN
        v_new_status := 'active';
    END IF;

    UPDATE song_tag
       SET upvotes = v_up, downvotes = v_down, status = v_new_status
     WHERE song_tag_id = NEW.song_tag_id;

    -- reward the suggester the moment the tag crosses +5 net upvotes
    v_net := v_up - v_down;
    IF v_net = 5 THEN
        UPDATE wallet SET token_balance = token_balance + 10
         WHERE user_id = v_song_tag.suggested_by;

        INSERT INTO transaction (from_user_id, to_user_id, amount, txn_type)
        VALUES (v_song_tag.suggested_by, v_song_tag.suggested_by, 10, 'earn');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER 1: fires the function above every time a new vote is inserted
CREATE OR REPLACE TRIGGER trg_tag_vote_after_insert
AFTER INSERT ON tag_vote
FOR EACH ROW EXECUTE FUNCTION fn_sync_song_tag_votes();


-- FUNCTION 2: every time someone's listening gets logged, add up how
-- much that song has EVER been listened to, and if the total just
-- crossed a new 300-second (5-minute) milestone, pay the song's owner
-- 1 token per milestone crossed.
CREATE OR REPLACE FUNCTION fn_credit_listening_earnings() RETURNS TRIGGER AS $$
DECLARE
    v_song           song%ROWTYPE;
    v_prior_total    INTEGER;
    v_new_total      INTEGER;
    v_tokens_before  INTEGER;
    v_tokens_after   INTEGER;
    v_tokens_earned  INTEGER;
BEGIN
    SELECT * INTO v_song FROM song WHERE song_id = NEW.song_id;

    SELECT COALESCE(SUM(listened_sec), 0) INTO v_prior_total
      FROM listening_history
     WHERE song_id = NEW.song_id AND history_id != NEW.history_id;

    v_new_total     := v_prior_total + NEW.listened_sec;
    v_tokens_before := v_prior_total / 300;
    v_tokens_after  := v_new_total   / 300;
    v_tokens_earned := v_tokens_after - v_tokens_before;

    IF v_tokens_earned > 0 THEN
        UPDATE wallet SET token_balance = token_balance + v_tokens_earned
         WHERE user_id = v_song.owner_id;

        INSERT INTO transaction (from_user_id, to_user_id, amount, txn_type)
        VALUES (v_song.owner_id, v_song.owner_id, v_tokens_earned, 'earn');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER 2: fires the function above every time a listen gets logged
CREATE OR REPLACE TRIGGER trg_listening_history_after_insert
AFTER INSERT ON listening_history
FOR EACH ROW EXECUTE FUNCTION fn_credit_listening_earnings();


-- PROCEDURE (as a FUNCTION returning one row): moves tokens between
-- wallets safely. Locks the wallet rows first (FOR UPDATE) so two
-- transfers happening at the exact same moment can't both read the
-- same "before" balance and cause a double-spend. Raises a real
-- database error if the amount is invalid or the balance is too low
-- — Python below catches that error and turns it into a clean 400.
CREATE OR REPLACE FUNCTION fn_transfer_tokens(
    p_from_user_id INTEGER,
    p_to_user_id   INTEGER,
    p_amount       INTEGER,
    p_txn_type     VARCHAR
) RETURNS transaction AS $$
DECLARE
    v_from_balance INTEGER;
    v_txn          transaction%ROWTYPE;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: amount must be positive';
    END IF;

    PERFORM 1 FROM wallet WHERE user_id = p_to_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND: no wallet for user %', p_to_user_id;
    END IF;

    IF p_txn_type IN ('gift', 'spend') THEN
        SELECT token_balance INTO v_from_balance
          FROM wallet WHERE user_id = p_from_user_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'WALLET_NOT_FOUND: no wallet for user %', p_from_user_id;
        END IF;
        IF v_from_balance < p_amount THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE: wallet % has % tokens, needs %',
                p_from_user_id, v_from_balance, p_amount;
        END IF;
        UPDATE wallet SET token_balance = token_balance - p_amount WHERE user_id = p_from_user_id;
    END IF;

    UPDATE wallet SET token_balance = token_balance + p_amount WHERE user_id = p_to_user_id;

    INSERT INTO transaction (from_user_id, to_user_id, amount, txn_type)
    VALUES (p_from_user_id, p_to_user_id, p_amount, p_txn_type)
    RETURNING * INTO v_txn;

    RETURN v_txn;
END;
$$ LANGUAGE plpgsql;
