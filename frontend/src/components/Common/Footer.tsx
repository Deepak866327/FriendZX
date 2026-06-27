import React from 'react';
import { Link } from 'react-router-dom';
import { Globe, MessageCircle, Code2 } from 'lucide-react';
import { Logo } from '@/components/Common/Logo';

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="px-4 py-6">
      <div className="glass rounded-2xl p-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">

          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-1">
            <Logo variant="full" size="sm" />
            <p className="text-xs text-slate-400 mt-1">Find your people, nearby.</p>
          </div>

          {/* Nav links */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
            {[
              { label: 'Login', to: '/login', internal: true },
              { label: 'Register', to: '/register', internal: true },
              { label: 'Privacy', to: '/privacy', internal: false },
              { label: 'Terms', to: '/terms', internal: false },
              { label: 'Contact', to: '/contact', internal: false },
            ].map(({ label, to, internal }) =>
              internal ? (
                <Link key={label} to={to} className="text-xs text-slate-500 hover:text-indigo-600 transition-colors font-medium">
                  {label}
                </Link>
              ) : (
                <a key={label} href={to} className="text-xs text-slate-500 hover:text-indigo-600 transition-colors font-medium">
                  {label}
                </a>
              )
            )}
          </div>

          {/* Social icons */}
          <div className="flex items-center gap-2">
            {[
              { Icon: Globe,          href: 'https://twitter.com',   label: 'Twitter'   },
              { Icon: MessageCircle, href: 'https://instagram.com', label: 'Instagram' },
              { Icon: Code2,         href: 'https://github.com',    label: 'GitHub'    },
            ].map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="btn-icon w-8 h-8 rounded-xl"
              >
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/40 text-center text-xs text-slate-400">
          © {year} FriendZX. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
