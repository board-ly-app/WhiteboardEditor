// === Sidebar =================================================================
//
// Container for elements which lie fixed along one side of the page.
//
// Useful for toolbars and menus that need to be visible at all times.
//
// =============================================================================

// -- std imports
import type { PropsWithChildren } from 'react';

export interface SidebarProps {
  side: 'left' | 'right';
  width?: string;  // as a tailwind className
  zIndex?: number;
}

const Sidebar = ({
  side,
  zIndex = 50,
  children,
}: PropsWithChildren<SidebarProps>): React.JSX.Element => {
  // Note that the aside must have the class pointer-events-none to prevent the
  // transparent background from interrupting pointer events to objects beneath it.
  return (
    <aside
      className={`pointer-events-none fixed top-[20%] ${side}-2 flex flex-wrap flex-col items-start justify-center gap-2 max-h-[70vh]`}
      style={{ zIndex }}
    >
      {/** Wrap child(ren) in individual containers which enable pointer events **/}
      {Array.isArray(children)
        && children.map(child => ( <div className="pointer-events-auto" >{child}</div>))
        || (<div className="pointer-events-auto">{children}</div>)
      }
    </aside>
  );
};

export default Sidebar;
