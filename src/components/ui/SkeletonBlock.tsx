import React from 'react';

export default function SkeletonBlock({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}
