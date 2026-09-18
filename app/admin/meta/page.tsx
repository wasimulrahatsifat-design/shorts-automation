import AdminDashboard from '../page';

export const metadata = {
  title: 'Facebook & Instagram Approval Queue | Shorts Automation',
  description: 'Approve and publish shorts directly to Facebook Page and Instagram Reels',
};

export default function MetaAdminPage() {
  return <AdminDashboard initialPlatform="meta" />;
}
