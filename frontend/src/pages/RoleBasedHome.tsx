import { useAuth } from '../contexts/AuthContext';
import { AdminHome } from './AdminHome';
import { SmeManagerHome } from './SmeManagerHome';
import { SmeHeroLanding } from './SmeHeroLanding';
import { UserHome } from './UserHome';
import { Layout } from '../components/Layout';
import type { UserRole } from '../types';

export function RoleBasedHome() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Please log in</p>
        </div>
      </Layout>
    );
  }

  switch (user.role as UserRole) {
    case 'admin':
      return <AdminHome />;
    case 'manager':
      return <SmeManagerHome />;
    case 'sme':
      return <SmeHeroLanding />;
    case 'usuario':
    default:
      return <UserHome />;
  }
}
