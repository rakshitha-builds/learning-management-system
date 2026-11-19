import { io } from 'socket.io-client';
import { API_URL } from '../app/api';

export const connectSocket = (token) => io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
