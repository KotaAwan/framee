import React from 'react';
import * as LucideIcons from 'lucide-react';

export default function Icon({ name, size = 16, className, fallback = 'Box' }) {
  // If the icon name is missing or invalid, use the fallback
  const IconComponent = LucideIcons[name] || LucideIcons[fallback] || LucideIcons.Box;
  return <IconComponent size={size} className={className} />;
}
