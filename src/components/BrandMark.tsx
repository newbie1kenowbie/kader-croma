import React from 'react';

interface BrandMarkProps {
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ className = 'w-7 h-7' }) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Viewfinder aperture corners */}
      <path
        d="M5 10.5V7C5 5.89543 5.89543 5 7 5H10.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21.5 5H25C26.1046 5 27 5.89543 27 7V10.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M27 21.5V25C27 26.1046 26.1046 27 25 27H21.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.5 27H7C5.89543 27 5 26.1046 5 25V21.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Diagonal tone curve wave */}
      <path
        d="M8.5 22.5C12.5 22.5 13.4 16 16 16C18.6 16 19.5 9.5 23.5 9.5"
        stroke="#E5A93C"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* Midtone control node */}
      <circle cx="16" cy="16" r="2.25" fill="#F2F2F0" />
    </svg>
  );
};
