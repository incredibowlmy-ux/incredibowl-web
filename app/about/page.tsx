import React from 'react';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#FDFBF7] p-20 text-center">
      <h1 className="text-4xl font-bold text-orange-600 mb-6">About Incredibowl</h1>
      <p className="text-lg text-slate-600 max-w-2xl mx-auto">
        We serve food just like we serve to our kids—with a sincere heart and no MSG. 
        每一口都是妈妈的味道。
      </p>
      <a href="/" className="mt-8 inline-block text-orange-500 hover:underline">
        ← Back to Home
      </a>
    </main>
  );
}