import type { RouteObject } from 'react-router'
import { RequireAdmin } from '../features/admin/RequireAdmin'
import { GuestOnly, RequireAuth } from '../features/auth/guards'
import { RequireBuyer } from '../features/rfqs/RequireBuyer'
import { RequireSupplier } from '../features/supplier/RequireSupplier'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AppLayout } from './AppLayout'
import { PageLoadError } from './PageLoadError'
import {
  AdminAuditPage,
  AdminCategoriesPage,
  AdminCompaniesPage,
  AdminLayout,
  AdminOverviewPage,
  AdminTriageListPage,
  AdminTriagePage,
  SupplierCategoriesPage,
  SupplierInboxPage,
  SupplierRfqPage,
  NewRfqPage,
  RfqDetailPage,
  RfqListPage,
  AccountPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterChoicePage,
  RegisterPage,
  ResetPasswordPage,
  DesignSpecimenPage,
  NotificationsPage,
} from './LazyPages'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    ErrorBoundary: PageLoadError,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: 'register', element: <GuestOnly><RegisterChoicePage /></GuestOnly> },
      { path: 'register/buyer', element: <GuestOnly><RegisterPage key="buyer" type="buyer" /></GuestOnly> },
      { path: 'register/supplier', element: <GuestOnly><RegisterPage key="supplier" type="supplier" /></GuestOnly> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'account', element: <RequireAuth><AccountPage /></RequireAuth> },
      { path: 'notifications', element: <RequireAuth><NotificationsPage /></RequireAuth> },
      { path: 'rfqs', element: <RequireAuth><RequireBuyer><RfqListPage /></RequireBuyer></RequireAuth> },
      { path: 'rfqs/new', element: <RequireAuth><RequireBuyer><NewRfqPage /></RequireBuyer></RequireAuth> },
      { path: 'rfqs/:id', element: <RequireAuth><RequireBuyer><RfqDetailPage /></RequireBuyer></RequireAuth> },
      { path: 'supplier/categories', element: <RequireAuth><RequireSupplier><SupplierCategoriesPage /></RequireSupplier></RequireAuth> },
      { path: 'supplier/rfqs', element: <RequireAuth><RequireSupplier approved><SupplierInboxPage /></RequireSupplier></RequireAuth> },
      { path: 'supplier/rfqs/:id', element: <RequireAuth><RequireSupplier approved><SupplierRfqPage /></RequireSupplier></RequireAuth> },
      {
        path: 'admin',
        element: <RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>,
        children: [
          { index: true, element: <AdminOverviewPage /> },
          { path: 'companies', element: <AdminCompaniesPage /> },
          { path: 'rfqs', element: <AdminTriageListPage /> },
          { path: 'rfqs/:id', element: <AdminTriagePage /> },
          { path: 'categories', element: <AdminCategoriesPage /> },
          { path: 'audit', element: <AdminAuditPage /> },
        ],
      },
      { path: 'design', element: <DesignSpecimenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
