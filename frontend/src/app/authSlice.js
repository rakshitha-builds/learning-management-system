import { createSlice } from '@reduxjs/toolkit';

const saved = (() => { try { return JSON.parse(localStorage.getItem('lms_auth') || 'null'); } catch { return null; } })();

const authSlice = createSlice({
  name: 'auth',
  initialState: { token: saved?.token || null, user: saved?.user || null },
  reducers: {
    setCredentials(state, { payload }) {
      state.token = payload.token ?? state.token;
      state.user = payload.user;
      localStorage.setItem('lms_auth', JSON.stringify({ token: state.token, user: state.user }));
    },
    logout(state) {
      state.token = null; state.user = null;
      localStorage.removeItem('lms_auth');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
