import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { api } from "./utils/api";

const AuthContext = createContext(null);

// Session timeout configuration
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_KEY = "hydro_token";
const LOGIN_TIME_KEY = "hydro_login_time";
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"];

export function AuthProvider({ children }) {
  const [isAuthed, setIsAuthed] = useState(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const loginTime = sessionStorage.getItem(LOGIN_TIME_KEY);

    if (token && loginTime) {
      const elapsed = Date.now() - Number(loginTime);
      if (elapsed < SESSION_TIMEOUT_MS) {
        return true;
      }
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(LOGIN_TIME_KEY);
    }
    return false;
  });

  const [error, setError] = useState("");
  const logoutTimerRef = useRef(null);
  const activityTimeoutRef = useRef(null);

  const clearAllTimers = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
      activityTimeoutRef.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    clearAllTimers();
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(LOGIN_TIME_KEY);
    setIsAuthed(false);
  }, [clearAllTimers]);

  const scheduleLogout = useCallback(
    (remainingMs) => {
      clearAllTimers();
      if (remainingMs > 0) {
        logoutTimerRef.current = setTimeout(logout, remainingMs);
      } else {
        logout();
      }
    },
    [clearAllTimers, logout],
  );

  const resetActivityTimer = useCallback(() => {
    if (!isAuthed) return;

    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      const loginTime = sessionStorage.getItem(LOGIN_TIME_KEY);
      if (loginTime) {
        const elapsed = Date.now() - Number(loginTime);
        const remaining = SESSION_TIMEOUT_MS - elapsed;
        if (remaining > 0) {
          sessionStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
          scheduleLogout(SESSION_TIMEOUT_MS);
        } else {
          logout();
        }
      }
    }, 1000);
  }, [isAuthed, scheduleLogout, logout]);

  const login = useCallback(
    async (password) => {
      setError("");
      try {
        const result = await api.login(password);
        if (result.success) {
          const loginTime = Date.now().toString();
          sessionStorage.setItem(TOKEN_KEY, result.token || "authenticated");
          sessionStorage.setItem(LOGIN_TIME_KEY, loginTime);
          setIsAuthed(true);
          scheduleLogout(SESSION_TIMEOUT_MS);
          return true;
        }
        setError(result.error || "Invalid password");
        return false;
      } catch (err) {
        setError("Login failed. Please try again.");
        return false;
      }
    },
    [scheduleLogout],
  );

  useEffect(() => {
    const loginTime = sessionStorage.getItem(LOGIN_TIME_KEY);
    if (loginTime && isAuthed) {
      const elapsed = Date.now() - Number(loginTime);
      const remaining = SESSION_TIMEOUT_MS - elapsed;
      if (remaining > 0) {
        scheduleLogout(remaining);
      } else {
        logout();
      }
    }
  }, [isAuthed, scheduleLogout, logout]);

  useEffect(() => {
    if (!isAuthed) return;

    const handleActivity = () => {
      resetActivityTimer();
    };

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [isAuthed, resetActivityTimer, clearAllTimers]);

  const value = {
    isAuthed,
    login,
    logout,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
