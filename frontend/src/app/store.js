import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import auth from './authSlice';
import ui from './uiSlice';

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer, auth, ui },
  middleware: (gdm) => gdm().concat(api.middleware),
});
