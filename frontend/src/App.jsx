import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import PublicLayout from './components/layout/PublicLayout';
import { PageLoader, ToastHost } from './components/ui';

import Home from './pages/public/Home';
import Catalog from './pages/public/Catalog';
import CourseDetail from './pages/public/CourseDetail';
import { Login, Register } from './pages/public/Auth';
import Verify from './pages/public/Verify';
import NotFound from './pages/public/NotFound';
import Account from './pages/shared/Account';
import StudentDashboard from './pages/student/Dashboard';
import MyCourses from './pages/student/MyCourses';
import Learn from './pages/student/Learn';
import QuizTake from './pages/student/QuizTake';
import QuizResult from './pages/student/QuizResult';
import QuizHistory from './pages/student/QuizHistory';
import StudentLive from './pages/student/Live';
import Certificates from './pages/student/Certificates';
import Payments from './pages/student/Payments';
import InstructorDashboard from './pages/instructor/Dashboard';
import InstructorCourses from './pages/instructor/Courses';
import CourseEditor from './pages/instructor/CourseEditor';
import Students from './pages/instructor/Students';
import InstructorLive from './pages/instructor/Live';
import Revenue from './pages/instructor/Revenue';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminCourses from './pages/admin/Courses';
import { AdminEnrollments, AdminTransactions, AdminActivity } from './pages/admin/Monitors';

const LiveRoom = lazy(() => import('./pages/shared/LiveRoom')); // LiveKit SDK is heavy: load on demand

export default function App() {
  const user = useSelector((s) => s.auth.user);
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/courses" element={<Catalog standalone />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/verify/:certId" element={<Verify />} />
            <Route path="/login" element={user ? <Navigate to={`/${user.role}`} replace /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to={`/${user.role}`} replace /> : <Register />} />
          </Route>

          <Route element={<ProtectedRoute role="student" />}>
            <Route path="/student" element={<DashboardLayout />}>
              <Route index element={<StudentDashboard />} />
              <Route path="courses" element={<MyCourses />} />
              <Route path="learn/:courseId" element={<Learn />} />
              <Route path="quiz/:quizId" element={<QuizTake />} />
              <Route path="results/:attemptId" element={<QuizResult />} />
              <Route path="quizzes" element={<QuizHistory />} />
              <Route path="live" element={<StudentLive />} />
              <Route path="live/:id" element={<LiveRoom />} />
              <Route path="certificates" element={<Certificates />} />
              <Route path="payments" element={<Payments />} />
              <Route path="account" element={<Account />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="instructor" />}>
            <Route path="/instructor" element={<DashboardLayout />}>
              <Route index element={<InstructorDashboard />} />
              <Route path="courses" element={<InstructorCourses />} />
              <Route path="courses/:id" element={<CourseEditor />} />
              <Route path="students" element={<Students />} />
              <Route path="live" element={<InstructorLive />} />
              <Route path="live/:id" element={<LiveRoom />} />
              <Route path="revenue" element={<Revenue />} />
              <Route path="account" element={<Account />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/admin" element={<DashboardLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="enrollments" element={<AdminEnrollments />} />
              <Route path="transactions" element={<AdminTransactions />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="account" element={<Account />} />
            </Route>
          </Route>
          <Route path="*" element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
        </Routes>
      </Suspense>
      <ToastHost />
    </>
  );
}
