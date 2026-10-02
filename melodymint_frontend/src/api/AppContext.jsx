import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AppContext = createContext(null);
const TOKEN_KEY = "melodymint_token";

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, isError = false) => {
    setToast({ message, isError, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthLoading(false);
      return;
    }
    try {
      const user = await api.me();
      setCurrentUser(user);
    } catch (_) {
      localStorage.removeItem(TOKEN_KEY);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (username, password) => {
    const { access_token } = await api.login(username, password);
    localStorage.setItem(TOKEN_KEY, access_token);
    const user = await api.me();
    setCurrentUser(user);
  };

  const register = async (username, email, password, role) => {
    await api.register({ username, email, password, role });
    await login(username, password);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setCurrentUser(null);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        activeUserId: currentUser?.user_id || null,
        authLoading,
        isAdmin: currentUser?.role === "admin",
        login,
        register,
        logout,
        showToast,
      }}
    >
      {children}
      {toast && (
        <div className={`toast ${toast.isError ? "error" : ""}`} key={toast.id}>
          {toast.message}
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
