// === Page.tsx ================================================================
//
// Wrapper component for all pages. Sets the window title on render.
//
// =============================================================================

// -- std imports
import {
  useEffect,
  type PropsWithChildren,
} from 'react';

export interface PageProps {
  title: string;
}

const Page = ({
  title,
  children,
}: PropsWithChildren<PageProps>): React.JSX.Element => {
  // -- set page title on render
  useEffect(
    () => {
      window.document.title = title;
    },
    [title]
  );

  return (
    <div className='min-h-dvh flex flex-col overscroll-none bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.4)_120%)]'>
      {children}
    </div>
  );
};

export default Page;
