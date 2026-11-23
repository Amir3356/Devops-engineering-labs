import { AuthCard } from '../features/auth';

/**
 * HomePage displays the Authentication Portal as the primary view.
 */
export default function HomePage() {
  return (
    <div className="auth-page-container">
      <AuthCard />
    </div>
  );
}
