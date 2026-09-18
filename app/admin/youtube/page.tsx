import AdminDashboard from '../page';

export const metadata = {
  title: 'YouTube Approval Queue | Shorts Automation',
  description: 'Approve and schedule shorts for private upload to YouTube',
};

export default function YouTubeAdminPage() {
  return <AdminDashboard initialPlatform="youtube" />;
}
