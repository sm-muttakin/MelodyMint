"""
Raw SQL database access layer. Deliberately does NOT use an ORM — every
query below is plain, parameterized SQL sent through psycopg2. This file
is just a thin connection-pooling + result-shaping helper so the router
files don't each reinvent cursor management; it is not an ORM (it has no
concept of models, relationships, or query building — every caller writes
its own SQL).
"""

import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://melodymint_user:melodymint_pass@localhost:5432/melodymint",
)

_pool = psycopg2.pool.SimpleConnectionPool(1, 10, DATABASE_URL)


@contextmanager
def get_conn():
    """Borrows a connection from the pool, commits on success, rolls back
    and re-raises on error, and always returns the connection to the pool."""
    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def fetch_one(query: str, params: tuple = ()):
    """Runs a SELECT and returns a single row as a dict, or None."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            row = cur.fetchone()
            return dict(row) if row else None


def fetch_all(query: str, params: tuple = ()):
    """Runs a SELECT and returns all rows as a list of dicts."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            return [dict(r) for r in cur.fetchall()]


def execute(query: str, params: tuple = (), returning: bool = False):
    """
    Runs an INSERT/UPDATE/DELETE. If returning=True (use with a `RETURNING`
    clause in the query), returns the single resulting row as a dict.
    Otherwise returns the number of rows affected.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            if returning:
                row = cur.fetchone()
                return dict(row) if row else None
            return cur.rowcount
