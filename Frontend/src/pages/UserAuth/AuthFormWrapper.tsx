import React from 'react';

export interface AuthFormWrapperProps {
  children: React.ReactNode;
}

export const AuthFormWrapper = ({
  children,
}: AuthFormWrapperProps) => {
  return (
    <div className="rounded-lg border-border border-1 shadow-md bg-card-background py-5 px-2 sm:p-10">
      {children}
    </div>
  );
};// -- end AuthFormWrapper
