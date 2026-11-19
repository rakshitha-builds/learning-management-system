import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';

export default function NotFound() {
  return <div className="mx-auto max-w-md px-4 py-24 text-center"><p className="font-display text-7xl font-semibold text-accent">404</p><h1 className="mt-3 font-display text-2xl font-semibold">Page not found</h1><p className="mt-2 text-stone-500">The page you are looking for doesn’t exist or has moved.</p><Link to="/"><Button className="mt-6">Back to home</Button></Link></div>;
}
