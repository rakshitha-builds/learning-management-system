import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from './authSlice';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const rawBase = fetchBaseQuery({
  baseUrl: `${API_URL}/api`,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});
const baseQuery = async (args, api, extra) => {
  const result = await rawBase(args, api, extra);
  if (result.error?.status === 401 && api.getState().auth.token) api.dispatch(logout());
  return result;
};

const one = (r) => r.data;
const list = (r) => ({ items: r.data, meta: r.meta });
const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};
const post = (url, body, method = 'POST') => ({ url, method, body });

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Me', 'Course', 'Courses', 'Enrollment', 'Progress', 'Quiz', 'Live', 'Payment', 'Revenue', 'Notification', 'Cert', 'Admin'],
  endpoints: (b) => ({
    // auth
    login: b.mutation({ query: (body) => post('/auth/login', body), transformResponse: one }),
    register: b.mutation({ query: (body) => post('/auth/register', body), transformResponse: one }),
    updateProfile: b.mutation({ query: (body) => post('/auth/me', body, 'PATCH'), transformResponse: one }),
    // catalogue
    getCategories: b.query({ query: () => '/categories', transformResponse: one }),
    getCourses: b.query({ query: (p) => `/courses${qs(p)}`, transformResponse: list, providesTags: ['Courses'] }),
    getCourse: b.query({ query: (id) => `/courses/${id}`, transformResponse: one, providesTags: (r, e, id) => [{ type: 'Course', id }] }),
    // instructor courses
    myCourses: b.query({ query: () => '/courses/mine', transformResponse: one, providesTags: ['Courses'] }),
    createCourse: b.mutation({ query: (body) => post('/courses', body), transformResponse: one, invalidatesTags: ['Courses'] }),
    updateCourse: b.mutation({ query: ({ id, ...body }) => post(`/courses/${id}`, body, 'PUT'), invalidatesTags: (r, e, { id }) => [{ type: 'Course', id }, 'Courses'] }),
    deleteCourse: b.mutation({ query: (id) => ({ url: `/courses/${id}`, method: 'DELETE' }), invalidatesTags: ['Courses', 'Admin'] }),
    submitCourse: b.mutation({ query: (id) => post(`/courses/${id}/submit`), invalidatesTags: (r, e, id) => [{ type: 'Course', id }, 'Courses'] }),
    publishCourse: b.mutation({ query: ({ id, publish }) => post(`/courses/${id}/publish`, { publish }, 'PATCH'), invalidatesTags: (r, e, { id }) => [{ type: 'Course', id }, 'Courses'] }),
    uploadThumbnail: b.mutation({ query: ({ id, file }) => { const f = new FormData(); f.append('image', file); return { url: `/courses/${id}/thumbnail`, method: 'POST', body: f }; }, invalidatesTags: (r, e, { id }) => [{ type: 'Course', id }, 'Courses'] }),
    courseStudents: b.query({ query: (id) => `/courses/${id}/students`, transformResponse: one }),
    // curriculum
    createModule: b.mutation({ query: ({ courseId, ...body }) => post(`/courses/${courseId}/modules`, body), invalidatesTags: (r, e, { courseId }) => [{ type: 'Course', id: courseId }] }),
    updateModule: b.mutation({ query: ({ id, courseId, ...body }) => post(`/modules/${id}`, body, 'PUT'), invalidatesTags: (r, e, { courseId }) => [{ type: 'Course', id: courseId }] }),
    deleteModule: b.mutation({ query: ({ id }) => ({ url: `/modules/${id}`, method: 'DELETE' }), invalidatesTags: (r, e, { courseId }) => [{ type: 'Course', id: courseId }] }),
    createLesson: b.mutation({ query: ({ moduleId, courseId, ...body }) => post(`/modules/${moduleId}/lessons`, body), invalidatesTags: (r, e, { courseId }) => [{ type: 'Course', id: courseId }] }),
    updateLesson: b.mutation({ query: ({ id, courseId, ...body }) => post(`/lessons/${id}`, body, 'PUT'), invalidatesTags: (r, e, { courseId }) => [{ type: 'Course', id: courseId }] }),
    deleteLesson: b.mutation({ query: ({ id }) => ({ url: `/lessons/${id}`, method: 'DELETE' }), invalidatesTags: (r, e, { courseId }) => [{ type: 'Course', id: courseId }] }),
    getLesson: b.query({ query: (id) => `/lessons/${id}`, transformResponse: one }),
    getPlayback: b.query({ query: (id) => `/lessons/${id}/playback`, transformResponse: one, keepUnusedDataFor: 0 }),
    retryVideo: b.mutation({ query: (id) => post(`/videos/${id}/retry`), invalidatesTags: (r, e, id) => ['Course'] }),
    deleteVideo: b.mutation({ query: ({ id }) => ({ url: `/videos/${id}`, method: 'DELETE' }), invalidatesTags: (r, e, { courseId }) => [{ type: 'Course', id: courseId }] }),
    // enrollment & progress
    enroll: b.mutation({ query: (courseId) => post('/enrollments', { courseId }), invalidatesTags: ['Enrollment', 'Course', 'Progress'] }),
    myEnrollments: b.query({ query: () => '/enrollments/mine', transformResponse: one, providesTags: ['Enrollment'] }),
    updateLessonProgress: b.mutation({ query: ({ lessonId, ...body }) => post(`/progress/lessons/${lessonId}`, body), invalidatesTags: ['Progress', 'Enrollment'] }),
    courseProgress: b.query({ query: (id) => `/progress/courses/${id}`, transformResponse: one, providesTags: ['Progress'] }),
    progressSummary: b.query({ query: () => '/progress/summary', transformResponse: one, providesTags: ['Progress', 'Enrollment'] }),
    progressHistory: b.query({ query: (page = 1) => `/progress/history?page=${page}`, transformResponse: list, providesTags: ['Progress'] }),
    // quizzes
    courseQuizzes: b.query({ query: (id) => `/courses/${id}/quizzes`, transformResponse: one, providesTags: ['Quiz'] }),
    quizManage: b.query({ query: (id) => `/quizzes/${id}/manage`, transformResponse: one, providesTags: ['Quiz'] }),
    createQuiz: b.mutation({ query: ({ courseId, ...body }) => post(`/courses/${courseId}/quizzes`, body), invalidatesTags: ['Quiz', 'Course'] }),
    updateQuiz: b.mutation({ query: ({ id, ...body }) => post(`/quizzes/${id}`, body, 'PUT'), invalidatesTags: ['Quiz'] }),
    deleteQuiz: b.mutation({ query: (id) => ({ url: `/quizzes/${id}`, method: 'DELETE' }), invalidatesTags: ['Quiz', 'Course'] }),
    quizAttempts: b.query({ query: (id) => `/quizzes/${id}/attempts`, transformResponse: one }),
    startAttempt: b.mutation({ query: (quizId) => post(`/quizzes/${quizId}/attempts`), transformResponse: one }),
    submitAttempt: b.mutation({ query: ({ attemptId, answers }) => post(`/attempts/${attemptId}/submit`, { answers }), transformResponse: one, invalidatesTags: ['Quiz', 'Progress', 'Enrollment', 'Cert'] }),
    attemptResult: b.query({ query: (id) => `/attempts/${id}`, transformResponse: one }),
    myAttempts: b.query({ query: () => '/attempts/mine', transformResponse: one, providesTags: ['Quiz'] }),
    // certificates
    myCertificates: b.query({ query: () => '/certificates/mine', transformResponse: one, providesTags: ['Cert'] }),
    issueCertificate: b.mutation({ query: (courseId) => post(`/certificates/course/${courseId}`), transformResponse: one, invalidatesTags: ['Cert'] }),
    verifyCertificate: b.query({ query: (id) => `/certificates/verify/${id}`, transformResponse: one }),
    // live
    liveList: b.query({ query: (scope = 'upcoming') => `/live?scope=${scope}`, transformResponse: one, providesTags: ['Live'] }),
    liveGet: b.query({ query: (id) => `/live/${id}`, transformResponse: one, providesTags: ['Live'] }),
    scheduleLive: b.mutation({ query: (body) => post('/live', body), invalidatesTags: ['Live'] }),
    startLive: b.mutation({ query: (id) => post(`/live/${id}/start`), invalidatesTags: ['Live'] }),
    endLive: b.mutation({ query: (id) => post(`/live/${id}/end`), invalidatesTags: ['Live'] }),
    cancelLive: b.mutation({ query: (id) => post(`/live/${id}/cancel`), invalidatesTags: ['Live'] }),
    liveToken: b.mutation({ query: (id) => post(`/live/${id}/token`), transformResponse: one }),
    liveMessages: b.query({ query: (id) => `/live/${id}/messages`, transformResponse: one, keepUnusedDataFor: 0 }),
    // payments
    paymentConfig: b.query({ query: () => '/payments/config', transformResponse: one }),
    checkout: b.mutation({ query: (courseId) => post('/payments/checkout', { courseId }), transformResponse: one }),
    verifyPayment: b.mutation({ query: (body) => post('/payments/verify', body), transformResponse: one, invalidatesTags: ['Enrollment', 'Payment', 'Course'] }),
    failPayment: b.mutation({ query: ({ id, reason }) => post(`/payments/${id}/fail`, { reason }), invalidatesTags: ['Payment'] }),
    simulatePayment: b.mutation({ query: ({ id, outcome }) => post(`/payments/${id}/simulate`, { outcome }), transformResponse: one, invalidatesTags: ['Enrollment', 'Payment', 'Course', 'Progress'] }),
    myPayments: b.query({ query: () => '/payments/mine', transformResponse: one, providesTags: ['Payment'] }),
    // revenue
    revenueSummary: b.query({ query: () => '/revenue/summary', transformResponse: one, providesTags: ['Revenue', 'Payment'] }),
    revenueTransactions: b.query({ query: (p) => `/revenue/transactions${qs(p)}`, transformResponse: list, providesTags: ['Revenue', 'Payment'] }),
    // notifications
    notifications: b.query({ query: () => '/notifications', transformResponse: (r) => ({ items: r.data, unread: r.meta.unread }), providesTags: ['Notification'] }),
    markRead: b.mutation({ query: (id) => post(`/notifications/${id}/read`, undefined, 'PATCH'), invalidatesTags: ['Notification'] }),
    markAllRead: b.mutation({ query: () => post('/notifications/read-all', undefined, 'PATCH'), invalidatesTags: ['Notification'] }),
    // admin
    adminStats: b.query({ query: () => '/admin/stats', transformResponse: one, providesTags: ['Admin'] }),
    adminUsers: b.query({ query: (p) => `/admin/users${qs(p)}`, transformResponse: list, providesTags: ['Admin'] }),
    adminCreateUser: b.mutation({ query: (body) => post('/admin/users', body), invalidatesTags: ['Admin'] }),
    adminUserStatus: b.mutation({ query: ({ id, status }) => post(`/admin/users/${id}/status`, { status }, 'PATCH'), invalidatesTags: ['Admin'] }),
    adminCourses: b.query({ query: (p) => `/admin/courses${qs(p)}`, transformResponse: list, providesTags: ['Admin', 'Courses'] }),
    adminReview: b.mutation({ query: ({ id, ...body }) => post(`/admin/courses/${id}/review`, body, 'PATCH'), invalidatesTags: ['Admin', 'Courses'] }),
    adminEnrollments: b.query({ query: (p) => `/admin/enrollments${qs(p)}`, transformResponse: list, providesTags: ['Admin', 'Enrollment'] }),
    adminTransactions: b.query({ query: (p) => `/admin/transactions${qs(p)}`, transformResponse: list, providesTags: ['Admin', 'Payment'] }),
    adminActivity: b.query({ query: (p) => `/admin/activity${qs(p)}`, transformResponse: list, providesTags: ['Admin'] }),
  }),
});

export const {
  useLoginMutation, useRegisterMutation, useUpdateProfileMutation, useGetCategoriesQuery, useGetCoursesQuery, useGetCourseQuery,
  useMyCoursesQuery, useCreateCourseMutation, useUpdateCourseMutation, useDeleteCourseMutation, useSubmitCourseMutation, usePublishCourseMutation, useUploadThumbnailMutation, useCourseStudentsQuery,
  useCreateModuleMutation, useUpdateModuleMutation, useDeleteModuleMutation, useCreateLessonMutation, useUpdateLessonMutation, useDeleteLessonMutation,
  useGetLessonQuery, useGetPlaybackQuery, useRetryVideoMutation, useDeleteVideoMutation,
  useEnrollMutation, useMyEnrollmentsQuery, useUpdateLessonProgressMutation, useCourseProgressQuery, useProgressSummaryQuery, useProgressHistoryQuery,
  useCourseQuizzesQuery, useQuizManageQuery, useCreateQuizMutation, useUpdateQuizMutation, useDeleteQuizMutation, useQuizAttemptsQuery, useStartAttemptMutation, useSubmitAttemptMutation, useAttemptResultQuery, useMyAttemptsQuery,
  useMyCertificatesQuery, useIssueCertificateMutation, useVerifyCertificateQuery,
  useLiveListQuery, useLiveGetQuery, useScheduleLiveMutation, useStartLiveMutation, useEndLiveMutation, useCancelLiveMutation, useLiveTokenMutation, useLiveMessagesQuery,
  usePaymentConfigQuery, useCheckoutMutation, useVerifyPaymentMutation, useFailPaymentMutation, useSimulatePaymentMutation, useMyPaymentsQuery,
  useRevenueSummaryQuery, useRevenueTransactionsQuery, useNotificationsQuery, useMarkReadMutation, useMarkAllReadMutation,
  useAdminStatsQuery, useAdminUsersQuery, useAdminCreateUserMutation, useAdminUserStatusMutation, useAdminCoursesQuery, useAdminReviewMutation, useAdminEnrollmentsQuery, useAdminTransactionsQuery, useAdminActivityQuery,
} = api;
