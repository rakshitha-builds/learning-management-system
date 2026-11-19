import { createSlice, nanoid } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: { toasts: [], sidebarOpen: false },
  reducers: {
    addToast: { reducer: (s, { payload }) => { s.toasts.push(payload); }, prepare: (message, type = 'success') => ({ payload: { id: nanoid(), message, type } }) },
    removeToast: (s, { payload }) => { s.toasts = s.toasts.filter((t) => t.id !== payload); },
    setSidebar: (s, { payload }) => { s.sidebarOpen = payload; },
  },
});
export const { addToast, removeToast, setSidebar } = uiSlice.actions;
export default uiSlice.reducer;
