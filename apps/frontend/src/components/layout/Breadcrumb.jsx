import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronRight, Home } from 'lucide-react';
import Icon from '../ui/Icon';

export default function Breadcrumb({ mode }) {
  const router = useRouter();

  // Parse path for breadcrumb segments
  const pathSegments = router.asPath.split('?')[0].split('/').filter(p => p);

  const [moduleMap, setModuleMap] = React.useState({});

  React.useEffect(() => {
    // Basic mapping from workspace API
    import('../../lib/api.client').then(({ default: apiClient }) => {
      apiClient.get('/api/v1/workspace').then(res => {
        if (res.data?.success) {
          const map = {};
          res.data.data.forEach(mod => {
            if (mod.shortcuts) {
              mod.shortcuts.forEach(sc => {
                map[sc.target] = { module: mod.name, label: sc.label, icon: sc.icon };
              });
            }
          });
          setModuleMap(map);
        }
      });
    });
  }, []);

  if (pathSegments.length === 0) return null;

  // Let's customize breadcrumb display
  const displaySegments = [];

  if (pathSegments[0] === 'doctype' || pathSegments[0] === 'document') {
    const target = pathSegments[1];
    if (target && moduleMap[target]) {
      displaySegments.push({ label: moduleMap[target].module, href: '#' });
      displaySegments.push({
        label: moduleMap[target].label,
        href: `/doctype/${target}`,
        icon: moduleMap[target].icon
      });

      if (mode) {
        displaySegments.push({ label: mode, href: '#' });
      } else if (pathSegments.length > 2) {
        displaySegments.push({ label: pathSegments[2] === 'new' ? 'New' : pathSegments[2], href: router.asPath });
      }
    } else {
      // Fallback
      displaySegments.push({ label: target, href: `/doctype/${target}` });
      if (mode) {
        displaySegments.push({ label: mode, href: '#' });
      } else if (pathSegments.length > 2) {
        displaySegments.push({ label: pathSegments[2], href: router.asPath });
      }
    }
  } else {
    // Normal mapping
    let currHref = '';
    pathSegments.forEach(seg => {
      currHref += `/${seg}`;
      displaySegments.push({ label: seg.charAt(0).toUpperCase() + seg.slice(1), href: currHref });
    });
  }

  return (
    <nav className="flex items-center text-sm text-(--color-muted) font-medium">
      <Link href="/" className="hover:text-(--color-text) flex items-center gap-1 transition-colors">
        <Home size={14} className="text-(--color-text)" />
      </Link>

      {displaySegments.map((segment, index) => {
        const isLast = index === displaySegments.length - 1;
        return (
          <React.Fragment key={index}>
            <span className="mx-2 text-(--color-muted)">/</span>
            {isLast ? (
              <span className="text-(--color-text) font-semibold flex items-center gap-1.5">
                {segment.label}
              </span>
            ) : (
              <Link href={segment.href} className="hover:text-(--color-text) transition-colors flex items-center gap-1.5">
                {segment.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
