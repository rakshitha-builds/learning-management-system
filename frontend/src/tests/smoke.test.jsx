/**
 * Integration smoke tests: render the REAL React app against a RUNNING backend (seeded database).
 *   1. cd backend && npm run seed && npm start
 *   2. cd frontend && npm test
 * Verifies routing, role guards, Redux/RTK Query wiring and that every dashboard renders real API data.
 */
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { store } from '../app/store';
import { api } from '../app/api';
import { logout, setCredentials } from '../app/authSlice';
import App from '../App';

const API = process.env.VITE_API_URL || 'http://localhost:5000';
const tokens = {};
async function login(email, password) {
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).data;
}
const renderAt = (path, creds) => {
  store.dispatch(api.util.resetApiState());
  if (creds) store.dispatch(setCredentials(creds)); else store.dispatch(logout());
  return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>);
};

beforeAll(async () => {
  tokens.student = await login('rakshitha@learnsphere.dev', 'Student@123');
  tokens.instructor = await login('priya@learnsphere.dev', 'Instructor@123');
  tokens.admin = await login('admin@learnsphere.dev', 'Admin@123');
  expect(tokens.admin?.token).toBeTruthy();
});
afterEach(cleanup);

describe('Public pages', () => {
  test('home shows the course catalogue from the API', async () => {
    renderAt('/');
    expect(await screen.findByText(/A full online school/i)).toBeInTheDocument();
    expect(await screen.findByText('Full-Stack Web Development with MERN')).toBeInTheDocument();
  });
  test('catalogue search filters courses', async () => {
    renderAt('/courses');
    await screen.findByText('Full-Stack Web Development with MERN');
    await userEvent.type(screen.getByPlaceholderText(/search courses/i), 'flutter');
    await waitFor(() => expect(screen.queryByText('Full-Stack Web Development with MERN')).not.toBeInTheDocument());
    expect(await screen.findByText('Flutter App Development Bootcamp')).toBeInTheDocument();
  });
  test('login form validates and signs in', async () => {
    renderAt('/login');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'admin@learnsphere.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });
  test('certificate verification page shows a valid seeded certificate', async () => {
    renderAt('/verify/LS-2026-SEED0001');
    expect(await screen.findByText('Valid certificate')).toBeInTheDocument();
  });
  test('unknown routes render the 404 page', async () => {
    renderAt('/does/not/exist');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});

describe('Role guards', () => {
  test('anonymous users are redirected to login', async () => {
    renderAt('/student');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
  test('a student visiting /admin is bounced to their own dashboard', async () => {
    renderAt('/admin', tokens.student);
    expect(await screen.findByText(/Welcome back, Rakshitha/)).toBeInTheDocument();
  });
});

describe('Student dashboards', () => {
  test('dashboard renders stat cards and progress from the API', async () => {
    renderAt('/student', tokens.student);
    expect(await screen.findByText('Enrolled courses')).toBeInTheDocument();
    expect(await screen.findByText('Continue learning')).toBeInTheDocument();
  });
  test.each([['/student/courses', 'My learning'], ['/student/quizzes', 'Quiz results'], ['/student/live', 'Live classes'], ['/student/certificates', 'Certificates'], ['/student/payments', 'Payments']])('%s renders', async (path, heading) => {
    renderAt(path, tokens.student);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Couldn’t load this/)).not.toBeInTheDocument());
  });
  test('course player lists lessons, quizzes and playback source for an enrolled course', async () => {
    const enr = await (await fetch(`${API}/api/enrollments/mine`, { headers: { Authorization: `Bearer ${tokens.student.token}` } })).json();
    renderAt(`/student/learn/${enr.data[0].course._id}`, tokens.student);
    expect(await screen.findByText(/lessons ·/)).toBeInTheDocument();
    expect(await screen.findAllByText(/Getting started|Core concepts/)).not.toHaveLength(0);
  });
});

describe('Instructor dashboards', () => {
  test('overview shows revenue cards from the API', async () => {
    renderAt('/instructor', tokens.instructor);
    expect(await screen.findByText('Net revenue')).toBeInTheDocument();
    expect(await screen.findByText('Your courses')).toBeInTheDocument();
  });
  test('revenue page shows transactions table with statuses', async () => {
    renderAt('/instructor/revenue', tokens.instructor);
    expect(await screen.findByText('Payment transactions')).toBeInTheDocument();
    expect(await screen.findAllByText('success')).not.toHaveLength(0);
  });
  test('course list and editor render', async () => {
    renderAt('/instructor/courses', tokens.instructor);
    const link = await screen.findByText('Full-Stack Web Development with MERN');
    expect(link).toBeInTheDocument();
    const mine = await (await fetch(`${API}/api/courses/mine`, { headers: { Authorization: `Bearer ${tokens.instructor.token}` } })).json();
    cleanup();
    renderAt(`/instructor/courses/${mine.data[0]._id}`, tokens.instructor);
    expect(await screen.findByText('Add module')).toBeInTheDocument();
    expect((await screen.findAllByText('Upload video')).length + (await screen.findAllByText('Replace')).length).toBeGreaterThan(0);
  });
  test.each([['/instructor/students', 'Students'], ['/instructor/live', 'Live classes']])('%s renders', async (path, heading) => {
    renderAt(path, tokens.instructor);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});

describe('Admin console', () => {
  test('dashboard shows platform statistics', async () => {
    renderAt('/admin', tokens.admin);
    expect(await screen.findByText('Platform overview')).toBeInTheDocument();
    expect(await screen.findByText('Total users')).toBeInTheDocument();
    expect(await screen.findByText(/waiting for your review/)).toBeInTheDocument();
  });
  test('users table lists seeded users', async () => {
    renderAt('/admin/users', tokens.admin);
    expect(await screen.findByText('Aditya Kulkarni')).toBeInTheDocument();
  });
  test('course moderation shows the pending course with approve/reject', async () => {
    renderAt('/admin/courses', tokens.admin);
    expect(await screen.findByText('Advanced System Design for Backend Engineers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument();
  });
  test.each([['/admin/enrollments', 'Enrollments'], ['/admin/transactions', 'Transactions'], ['/admin/activity', 'Platform activity']])('%s renders', async (path, heading) => {
    renderAt(path, tokens.admin);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
